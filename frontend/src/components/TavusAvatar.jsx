import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Wifi, WifiOff, Loader, Volume2 } from 'lucide-react';
import { useStore, PHASE } from '../store/index.js';

export default function TavusAvatar() {
  const conversationUrl = useStore((s) => s.tavusConversationUrl);
  const phase           = useStore((s) => s.phase);
  const muted           = useStore((s) => s.muted);
  const setCallObject   = useStore((s) => s.setCallObject);
  const onStopped       = useStore((s) => s.onAvatarStoppedSpeaking);

  const videoRef  = useRef(null);
  const audioRef  = useRef(null);
  const [status, setStatus]         = useState('idle');   // idle | joining | live | error
  const [audioLocked, setAudioLocked] = useState(false);  // browser autoplay gate

  useEffect(() => {
    if (!conversationUrl) return;

    setStatus('joining');
    console.log('[Tavus] Creating call for', conversationUrl);

    const call = DailyIframe.createCallObject({
      subscribeToTracksAutomatically: true,
    });

    // ── Apply a remote participant's tracks to our video/audio elements ──────
    function applyTracks(participant) {
      if (!participant || participant.local) return;

      console.log('[Tavus] Applying tracks for participant:', participant.session_id,
        'video state:', participant.tracks?.video?.state,
        'audio state:', participant.tracks?.audio?.state);

      const vt = participant.tracks?.video?.persistentTrack;
      const at = participant.tracks?.audio?.persistentTrack;

      if (vt && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([vt]);
        videoRef.current.play().catch(() => {});
        console.log('[Tavus] Video track attached');
      }
      if (at && audioRef.current) {
        audioRef.current.srcObject = new MediaStream([at]);
        audioRef.current.play()
          .then(() => setAudioLocked(false))
          .catch(() => setAudioLocked(true));  // browser blocked autoplay
        console.log('[Tavus] Audio track attached');
      }
    }

    // ── Joined — check participants already in the room ─────────────────────
    call.on('joined-meeting', () => {
      console.log('[Tavus] Joined meeting');
      setStatus('live');
      setCallObject(call);

      const existing = call.participants();
      console.log('[Tavus] Participants in room:', Object.keys(existing));
      Object.values(existing).forEach(applyTracks);
    });

    // ── New participant joins after us ───────────────────────────────────────
    call.on('participant-joined', ({ participant }) => {
      console.log('[Tavus] Participant joined:', participant.session_id);
      applyTracks(participant);
    });

    // ── Tracks change state (loading → playable) ─────────────────────────────
    call.on('participant-updated', ({ participant }) => {
      applyTracks(participant);
    });

    // ── Fallback: raw track event ────────────────────────────────────────────
    call.on('track-started', ({ participant, track }) => {
      console.log('[Tavus] track-started', track.kind, 'local:', participant.local);
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

    // ── Advance speech queue when avatar finishes talking ────────────────────
    call.on('app-message', ({ data }) => {
      console.log('[Tavus] app-message:', data?.event_type);
      if (
        data?.event_type === 'conversation.replica_stopped_speaking' ||
        data?.event_type === 'conversation.stopped_speaking'
      ) {
        onStopped();
      }
    });

    call.on('error', (e) => {
      console.error('[Tavus] Error:', e);
      setStatus('error');
    });

    call.join({ url: conversationUrl, startVideoOff: true, startAudioOff: true })
      .catch((err) => {
        console.error('[Tavus] Join failed:', err);
        setStatus('error');
      });

    return () => {
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

  // Unlock audio on first user gesture (browser autoplay policy)
  function unlockAudio() {
    if (audioRef.current) {
      audioRef.current.play().then(() => setAudioLocked(false)).catch(() => {});
    }
  }

  const isLive = status === 'live';

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="relative flex-1 rounded-xl overflow-hidden bg-navy-900 border border-white/10 min-h-0">

        {/* Placeholder / connecting overlay */}
        <AnimatePresence>
          {!isLive && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                {status === 'joining'
                  ? <Loader className="w-7 h-7 text-teal-accent animate-spin" />
                  : <Video className="w-7 h-7 text-slate-600" />
                }
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500 font-medium">Digital Credit Officer</div>
                <div className="text-xs text-slate-700 font-mono mt-1">
                  {status === 'joining' ? 'Connecting...' : 'Ready to review'}
                </div>
              </div>
              {phase === PHASE.IDLE && status === 'idle' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    className="w-32 h-32 rounded-full border border-teal-accent/10"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute w-24 h-24 rounded-full border border-teal-accent/15"
                    animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.15, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Replica video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Hidden audio element */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} autoPlay />

        {/* Audio unlock banner — appears only if browser blocked autoplay */}
        <AnimatePresence>
          {audioLocked && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={unlockAudio}
              className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-teal-accent/20 border border-teal-accent/40 text-teal-accent text-[10px] font-medium"
            >
              <Volume2 className="w-3 h-3" />
              Tap to enable audio
            </motion.button>
          )}
        </AnimatePresence>

        {/* Connection badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm z-20">
          {isLive ? (
            <>
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-[9px] font-mono text-green-400">LIVE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-slate-600" />
              <span className="text-[9px] font-mono text-slate-600">
                {status === 'joining' ? 'CONNECTING' : 'IDLE'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Label */}
      <div className="flex-shrink-0 pt-2 text-center">
        <div className="text-xs font-semibold text-slate-300">Digital Credit Officer</div>
        <div className="text-[10px] text-slate-600 font-mono">Hill Country Community Bank</div>
      </div>
    </div>
  );
}
