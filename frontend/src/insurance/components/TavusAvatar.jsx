import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Wifi, WifiOff, Loader, Volume2 } from 'lucide-react';
import { useInsuranceStore, PHASE } from '../store/index.js';

const IDLE_GREETING =
  "Hi, I'm Aria — your AI Underwriting Officer at Meridian Commercial Insurance. " +
  "Drop your submission packet on the right, or tap the demo button, and I'll build " +
  "the full underwriting memo in 90 seconds. Every risk flag, every ratio, fully cited.";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singleton — ONE Daily call instance survives React re-mounts.
// React StrictMode (dev) mounts → unmounts → mounts again. If we create a new
// DailyIframe each mount, the second createCallObject throws
// "Duplicate DailyIframe instances are not allowed".
// Keeping the instance at module scope means cleanup/create is idempotent.
// ─────────────────────────────────────────────────────────────────────────────
let _call       = null;   // live DailyIframe call object
let _callUrl    = null;   // URL the call was created for
let _callJoined = false;  // true after joined-meeting fires

async function destroyExistingCall() {
  const target = _call || (() => {
    try { return DailyIframe.getCallInstance(); } catch (_) { return null; }
  })();
  if (!target) return;

  console.log('[Aria] Destroying previous call…');
  _call       = null;
  _callUrl    = null;
  _callJoined = false;
  window.__ariaCall   = null;
  window.__ariaUrl    = null;
  window.__ariaJoined = false;

  try { await target.leave(); }   catch (_) {}
  try { target.destroy(); }       catch (_) {}
  console.log('[Aria] Previous call destroyed ✓');
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TavusAvatar() {
  const conversationUrl     = useInsuranceStore((s) => s.tavusConversationUrl);
  const tavusConversationId = useInsuranceStore((s) => s.tavusConversationId);
  const phase               = useInsuranceStore((s) => s.phase);
  const muted               = useInsuranceStore((s) => s.muted);
  const micEnabled          = useInsuranceStore((s) => s.micEnabled);
  const setCallObject       = useInsuranceStore((s) => s.setCallObject);
  const onStopped           = useInsuranceStore((s) => s.onAvatarStoppedSpeaking);

  const videoRef      = useRef(null);
  const audioRef      = useRef(null);
  const greetingTimer = useRef(null);
  const trackRetry    = useRef(null);
  const alive         = useRef(true); // false after React unmount

  const [status,      setStatus]      = useState('idle');
  const [audioLocked, setAudioLocked] = useState(false);

  // Track component mount lifecycle
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!conversationUrl) return;

    // ── Same URL already live — just ensure tracks are attached ──────────────
    if (_call && _callJoined && _callUrl === conversationUrl) {
      console.log('[Aria] Same URL already live — skipping re-init');
      if (alive.current) setStatus('live');
      // Re-attach tracks in case refs were replaced (e.g. Reset)
      const avatar = Object.values(_call.participants()).find((p) => !p.local);
      if (avatar) _attachTracks(avatar, videoRef, audioRef, setAudioLocked, alive);
      return;
    }

    let cancelled = false;

    async function init() {
      // Must destroy OLD call BEFORE creating new one — avoids "Duplicate" error
      await destroyExistingCall();
      if (cancelled) return;

      if (alive.current) setStatus('joining');
      console.log('[Aria] Creating Daily call for', conversationUrl);

      let call;
      try {
        call = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
      } catch (e) {
        console.error('[Aria] createCallObject failed:', e.message);
        if (alive.current) setStatus('error');
        return;
      }

      // Register singleton
      _call       = call;
      _callUrl    = conversationUrl;
      _callJoined = false;
      window.__ariaCall   = call;
      window.__ariaUrl    = conversationUrl;
      window.__ariaJoined = false;

      // ── Retry loop: poll until avatar tracks are playable ─────────────────
      // Mirrors reference tavus-avatar doc: setTimeout(tryAttachAvatarTracks, 1500)
      function scheduleRetry() {
        if (trackRetry.current) clearTimeout(trackRetry.current);
        trackRetry.current = setTimeout(() => {
          if (!_call || !_callJoined || cancelled) return;
          const avatar = Object.values(_call.participants()).find((p) => !p.local);
          if (!avatar) { scheduleRetry(); return; }
          const vOk = avatar.tracks?.video?.state === 'playable';
          const aOk = avatar.tracks?.audio?.state === 'playable';
          if (!vOk || !aOk) {
            console.log('[Aria] Tracks not ready (v:', avatar.tracks?.video?.state,
              'a:', avatar.tracks?.audio?.state, ') retrying…');
            scheduleRetry();
          } else {
            _attachTracks(avatar, videoRef, audioRef, setAudioLocked, alive);
          }
        }, 1500);
      }

      // ── Events ──────────────────────────────────────────────────────────────

      call.on('joined-meeting', () => {
        if (cancelled) return;
        console.log('[Aria] joined-meeting ✓');
        _callJoined         = true;
        window.__ariaJoined = true;
        if (alive.current) { setStatus('live'); setCallObject(call); }

        // Try attaching any tracks already in room
        Object.values(call.participants()).forEach((p) =>
          _attachTracks(p, videoRef, audioRef, setAudioLocked, alive)
        );
        // Also kick off the retry loop — tracks nearly always come async
        scheduleRetry();

        // Sync mic
        try { call.setLocalAudio(micEnabled); } catch (_) {}

        // Idle greeting — read store at fire-time (avoids stale closure)
        if (greetingTimer.current) clearTimeout(greetingTimer.current);
        greetingTimer.current = setTimeout(() => {
          if (cancelled || !_callJoined) return;
          const { phase: p, tavusConversationId: cid } = useInsuranceStore.getState();
          if (p === PHASE.IDLE || p === PHASE.LANDING) {
            console.log('[Aria] Sending idle greeting');
            try {
              call.sendAppMessage({
                message_type:    'conversation',
                event_type:      'conversation.echo',
                conversation_id: cid,
                properties:      { text: IDLE_GREETING },
              });
            } catch (e) { console.warn('[Aria] Greeting failed:', e.message); }
          }
        }, 3000);
      });

      call.on('participant-joined', ({ participant }) => {
        console.log('[Aria] participant-joined:', participant.session_id);
        _attachTracks(participant, videoRef, audioRef, setAudioLocked, alive);
        scheduleRetry();
      });

      call.on('participant-updated', ({ participant }) => {
        _attachTracks(participant, videoRef, audioRef, setAudioLocked, alive);
      });

      // track-started fires immediately when a track becomes live — most reliable
      call.on('track-started', ({ participant, track }) => {
        if (!participant || participant.local) return;
        console.log('[Aria] track-started:', track.kind);
        if (track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = new MediaStream([track]);
          videoRef.current.play().catch(() => {});
          console.log('[Aria] ✓ Video via track-started');
        }
        if (track.kind === 'audio' && audioRef.current) {
          audioRef.current.srcObject = new MediaStream([track]);
          audioRef.current.play()
            .then(() => { if (alive.current) setAudioLocked(false); })
            .catch(() => { if (alive.current) setAudioLocked(true); });
          console.log('[Aria] ✓ Audio via track-started');
        }
      });

      // Speech queue drain — Tavus v2 uses DOTS not underscores
      call.on('app-message', ({ data }) => {
        const et = data?.event_type ?? '';
        console.log('[Aria] app-message:', et);
        if (
          et === 'conversation.replica.stopped_speaking' ||  // Tavus v2
          et === 'conversation.replica_stopped_speaking' ||  // legacy
          et === 'conversation.stopped_speaking'
        ) {
          console.log('[Aria] Avatar stopped → draining speech queue');
          onStopped();
        }
      });

      call.on('left-meeting', () => {
        console.log('[Aria] left-meeting');
        _callJoined         = false;
        window.__ariaJoined = false;
        if (alive.current) { setStatus('idle'); setCallObject(null); }
      });

      call.on('error', (e) => {
        console.error('[Aria] Daily error:', e);
        if (alive.current) setStatus('error');
      });

      // Join (video always off, mic controlled by header button)
      if (!cancelled) {
        call.join({ url: conversationUrl, startVideoOff: true, startAudioOff: true })
          .catch((err) => {
            console.error('[Aria] join() failed:', err);
            if (alive.current) setStatus('error');
          });
      }
    }

    init();

    return () => {
      // Mark this render cycle as cancelled — prevents state updates after
      // React unmounts. We do NOT destroy the call here on purpose:
      // React StrictMode calls cleanup then immediately re-mounts with the same
      // conversationUrl. destroyExistingCall() at the top of init() handles it.
      cancelled = true;
      if (greetingTimer.current) clearTimeout(greetingTimer.current);
      if (trackRetry.current)    clearTimeout(trackRetry.current);
    };
  }, [conversationUrl]); // eslint-disable-line

  // Sync mute → audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // Sync mic button → live call
  useEffect(() => {
    if (!_call || !_callJoined) return;
    try { _call.setLocalAudio(micEnabled); } catch (_) {}
    console.log(`[Aria] Mic ${micEnabled ? 'ON' : 'OFF'}`);
  }, [micEnabled]);

  function unlockAudio() {
    audioRef.current?.play()
      .then(() => setAudioLocked(false))
      .catch(() => {});
  }

  const isLive       = status === 'live';
  const isConnecting = status === 'joining';

  return (
    <div className="relative w-full h-full flex flex-col">
      <div
        className="relative flex-1 rounded-xl overflow-hidden border border-white/10 min-h-0"
        style={{ background: '#0a1628' }}
      >
        {/* Overlay while not live */}
        <AnimatePresence>
          {!isLive && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                {isConnecting
                  ? <Loader className="w-7 h-7 text-teal-accent animate-spin" />
                  : <Video  className="w-7 h-7 text-slate-600" />
                }
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-slate-400">Aria</div>
                <div className="text-xs text-slate-600 font-mono mt-1">
                  {isConnecting   ? 'Connecting…'
                  : status === 'error' ? 'Reconnecting…'
                  : 'AI Underwriting Officer'}
                </div>
              </div>

              {phase === PHASE.IDLE && status === 'idle' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div className="w-32 h-32 rounded-full border border-teal-accent/10"
                    animate={{ scale:[1,1.08,1], opacity:[0.3,0.1,0.3] }}
                    transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }} />
                  <motion.div className="absolute w-24 h-24 rounded-full border border-teal-accent/15"
                    animate={{ scale:[1,1.12,1], opacity:[0.4,0.15,0.4] }}
                    transition={{ duration:3, repeat:Infinity, ease:'easeInOut', delay:0.3 }} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <video ref={videoRef} autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover" />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} autoPlay />

        <AnimatePresence>
          {audioLocked && (
            <motion.button
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              onClick={unlockAudio}
              className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-teal-accent/20 border border-teal-accent/40 text-teal-accent text-xs font-medium"
            >
              <Volume2 className="w-3 h-3" /> Tap to enable audio
            </motion.button>
          )}
        </AnimatePresence>

        {/* Connection badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm z-20">
          {isLive
            ? <><Wifi    className="w-3 h-3 text-green-400" /><span className="text-[9px] font-mono text-green-400">LIVE</span></>
            : <><WifiOff className="w-3 h-3 text-slate-600" /><span className="text-[9px] font-mono text-slate-600">{isConnecting ? 'CONNECTING' : 'IDLE'}</span></>
          }
        </div>
      </div>

      <div className="flex-shrink-0 py-2 px-4 text-center">
        <div className="text-sm font-semibold text-slate-700">Aria</div>
        <div className="text-xs text-slate-400 font-mono">AI Underwriting Officer · Meridian</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: attach video/audio tracks from a participant to DOM elements via refs
// Called from multiple event handlers — kept outside component to avoid closure issues
// ─────────────────────────────────────────────────────────────────────────────
function _attachTracks(participant, videoRef, audioRef, setAudioLocked, alive) {
  if (!participant || participant.local) return;
  const vState = participant.tracks?.video?.state;
  const aState = participant.tracks?.audio?.state;

  if (vState !== 'playable' && aState !== 'playable') return; // nothing to attach yet

  const vt = participant.tracks?.video?.persistentTrack;
  const at = participant.tracks?.audio?.persistentTrack;

  if (vt && vState === 'playable' && videoRef.current) {
    videoRef.current.srcObject = new MediaStream([vt]);
    videoRef.current.play().catch(() => {});
    console.log('[Aria] ✓ Video attached (persistentTrack)');
  }
  if (at && aState === 'playable' && audioRef.current) {
    audioRef.current.srcObject = new MediaStream([at]);
    audioRef.current.play()
      .then(() => { if (alive.current) setAudioLocked(false); })
      .catch(() => { if (alive.current) setAudioLocked(true); });
    console.log('[Aria] ✓ Audio attached (persistentTrack)');
  }
}
