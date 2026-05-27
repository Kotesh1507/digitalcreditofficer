import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Wifi, WifiOff, Loader, Volume2 } from 'lucide-react';
import { useInsuranceStore, PHASE } from '../store/index.js';

const IDLE_GREETING =
  "Hi, I'm Aria — your AI Underwriting Officer at Meridian Commercial Insurance. " +
  "Drop your submission packet on the right, or tap the demo button, and I'll build " +
  "the full underwriting memo in 90 seconds. Every risk flag, every ratio, fully cited.";

export default function TavusAvatar() {
  const conversationUrl     = useInsuranceStore((s) => s.tavusConversationUrl);
  const tavusConversationId = useInsuranceStore((s) => s.tavusConversationId);
  const phase               = useInsuranceStore((s) => s.phase);
  const muted               = useInsuranceStore((s) => s.muted);
  const micEnabled          = useInsuranceStore((s) => s.micEnabled);
  const setCallObject       = useInsuranceStore((s) => s.setCallObject);
  const onStopped           = useInsuranceStore((s) => s.onAvatarStoppedSpeaking);

  const videoRef  = useRef(null);
  const audioRef  = useRef(null);
  const [status, setStatus]           = useState('idle');
  const [audioLocked, setAudioLocked] = useState(false);

  useEffect(() => {
    if (!conversationUrl) return;

    setStatus('joining');
    console.log('[Aria] Creating call for', conversationUrl);

    const call = DailyIframe.createCallObject({
      subscribeToTracksAutomatically: true,
    });

    // Store ref for mic toggle
    window.__ariaCall   = call;
    window.__ariaJoined = false;

    // ── Apply remote participant tracks ──────────────────────────────────────
    function applyTracks(participant) {
      if (!participant || participant.local) return;
      console.log('[Aria] Applying tracks for participant:', participant.session_id,
        'video state:', participant.tracks?.video?.state,
        'audio state:', participant.tracks?.audio?.state);
      const vt = participant.tracks?.video?.persistentTrack;
      const at = participant.tracks?.audio?.persistentTrack;
      if (vt && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([vt]);
        videoRef.current.play().catch(() => {});
        console.log('[Aria] Video track attached');
      }
      if (at && audioRef.current) {
        audioRef.current.srcObject = new MediaStream([at]);
        audioRef.current.play()
          .then(() => setAudioLocked(false))
          .catch(() => setAudioLocked(true));
        console.log('[Aria] Audio track attached');
      }
    }

    // ── Joined ───────────────────────────────────────────────────────────────
    call.on('joined-meeting', () => {
      console.log('[Aria] Joined meeting');
      window.__ariaJoined = true;
      setStatus('live');
      setCallObject(call);
      const existing = call.participants();
      console.log('[Aria] Participants in room:', Object.keys(existing));
      Object.values(existing).forEach(applyTracks);

      // Sync mic state
      try { call.setLocalAudio(micEnabled); } catch (_) {}

      // Send idle greeting
      const { phase: p, tavusConversationId: cid } = useInsuranceStore.getState();
      if (p === PHASE.IDLE || p === PHASE.LANDING) {
        setTimeout(() => {
          try {
            call.sendAppMessage({
              message_type: 'conversation', event_type: 'conversation.echo',
              conversation_id: cid, properties: { text: IDLE_GREETING },
            });
          } catch (e) { console.warn('[Aria] greeting failed:', e.message); }
        }, 2500);
      }
    });

    // ── Participant events ───────────────────────────────────────────────────
    call.on('participant-joined', ({ participant }) => {
      console.log('[Aria] Participant joined:', participant.session_id);
      applyTracks(participant);
    });

    call.on('participant-updated', ({ participant }) => {
      applyTracks(participant);
    });

    call.on('track-started', ({ participant, track }) => {
      console.log('[Aria] track-started', track.kind, 'local:', participant.local);
      if (participant.local) return;
      if (track.kind === 'video' && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([track]);
        videoRef.current.play().catch(() => {});
      }
      if (track.kind === 'audio' && audioRef.current) {
        audioRef.current.srcObject = new MediaStream([track]);
        audioRef.current.play()
          .then(() => setAudioLocked(false))
          .catch(() => setAudioLocked(true));
      }
    });

    // ── Speech queue ─────────────────────────────────────────────────────────
    call.on('app-message', ({ data }) => {
      console.log('[Aria] app-message:', data?.event_type);
      if (
        data?.event_type === 'conversation.replica_stopped_speaking' ||
        data?.event_type === 'conversation.stopped_speaking'
      ) { onStopped(); }
    });

    call.on('error', (e) => {
      console.error('[Aria] Error:', e);
      setStatus('error');
    });

    // Join audio-off (mic toggled separately via button)
    call.join({ url: conversationUrl, startVideoOff: true, startAudioOff: true })
      .catch((err) => {
        console.error('[Aria] Join failed:', err);
        setStatus('error');
      });

    // ── Cleanup — exactly like CDO ────────────────────────────────────────────
    return () => {
      window.__ariaCall   = null;
      window.__ariaJoined = false;
      call.leave().catch(() => {}).finally(() => {
        call.destroy();
        setCallObject(null);
      });
    };
  }, [conversationUrl]); // eslint-disable-line

  // Sync mute → audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // Sync mic button → live call
  useEffect(() => {
    if (!window.__ariaCall || !window.__ariaJoined) return;
    try { window.__ariaCall.setLocalAudio(micEnabled); } catch (_) {}
  }, [micEnabled]);

  function unlockAudio() {
    if (audioRef.current) audioRef.current.play().then(() => setAudioLocked(false)).catch(() => {});
  }

  const isLive = status === 'live';

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="relative flex-1 rounded-xl overflow-hidden border border-white/10 min-h-0"
        style={{ background: '#0a1628' }}>

        <AnimatePresence>
          {!isLive && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                {status === 'joining'
                  ? <Loader className="w-7 h-7 text-teal-accent animate-spin" />
                  : <Video className="w-7 h-7 text-slate-600" />
                }
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-slate-400">Aria</div>
                <div className="text-xs text-slate-600 font-mono mt-1">
                  {status === 'joining' ? 'Connecting...' : 'AI Underwriting Officer'}
                </div>
              </div>
              {phase === PHASE.IDLE && status === 'idle' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div className="w-32 h-32 rounded-full border border-teal-accent/10"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                  <motion.div className="absolute w-24 h-24 rounded-full border border-teal-accent/15"
                    animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.15, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }} />
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
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={unlockAudio}
              className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-teal-accent/20 border border-teal-accent/40 text-teal-accent text-xs font-medium"
            >
              <Volume2 className="w-3 h-3" /> Tap to enable audio
            </motion.button>
          )}
        </AnimatePresence>

        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm z-20">
          {isLive
            ? <><Wifi className="w-3 h-3 text-green-400" /><span className="text-[9px] font-mono text-green-400">LIVE</span></>
            : <><WifiOff className="w-3 h-3 text-slate-600" /><span className="text-[9px] font-mono text-slate-600">{status === 'joining' ? 'CONNECTING' : 'IDLE'}</span></>
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
