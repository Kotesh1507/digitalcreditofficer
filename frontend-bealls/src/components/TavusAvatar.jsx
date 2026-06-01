import React, { useEffect, useRef, useState } from 'react';
import Daily from '@daily-co/daily-js';
import { Video, Wifi, WifiOff, Loader, Volume2 } from 'lucide-react';
import { joinConversation, ensureConversation, bindCall } from '../lib/tavusClient';

export {
  sendEchoMessage,
  sendInterruptMessage,
  isCallJoined,
  getCallObject,
  leaveConversation,
} from '../lib/tavusClient';

function TavusAvatar({
  conversationUrl,
  conversationId,
  onCallReady,
  onSpeakingDone,
  onStatusChange,
  onSessionEnded,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const onCallReadyRef = useRef(onCallReady);
  const onSpeakingDoneRef = useRef(onSpeakingDone);
  const onSessionEndedRef = useRef(onSessionEnded);
  const callRef = useRef(null);
  const greetedRef = useRef(false);

  const [status, setStatus] = useState('idle');
  const [audioLocked, setAudioLocked] = useState(false);
  const [errorDetail, setErrorDetail] = useState(null);

  useEffect(() => {
    onCallReadyRef.current = onCallReady;
    onSpeakingDoneRef.current = onSpeakingDone;
    onSessionEndedRef.current = onSessionEnded;
  }, [onCallReady, onSpeakingDone, onSessionEnded]);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!conversationUrl || !conversationId) {
      setStatus('idle');
      setErrorDetail(null);
      greetedRef.current = false;
      return undefined;
    }

    let cancelled = false;
    setStatus('joining');
    setErrorDetail(null);

    function applyTracks(participant) {
      if (!participant || participant.local) return;

      const vt = participant.tracks?.video?.persistentTrack;
      const at = participant.tracks?.audio?.persistentTrack;

      if (vt && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([vt]);
        videoRef.current.play().catch(() => {});
      }
      if (at && audioRef.current) {
        audioRef.current.srcObject = new MediaStream([at]);
        audioRef.current
          .play()
          .then(() => setAudioLocked(false))
          .catch(() => setAudioLocked(true));
      }
    }

    function bindOngoingListeners(call) {
      call.on('participant-joined', ({ participant }) => {
        if (!participant.local) applyTracks(participant);
      });
      call.on('participant-updated', ({ participant }) => applyTracks(participant));
      call.on('track-started', ({ participant, track }) => {
        if (participant?.local) return;
        if (track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = new MediaStream([track]);
          videoRef.current.play().catch(() => {});
        }
        if (track.kind === 'audio' && audioRef.current) {
          audioRef.current.srcObject = new MediaStream([track]);
          audioRef.current
            .play()
            .then(() => setAudioLocked(false))
            .catch(() => setAudioLocked(true));
        }
      });
      call.on('left-meeting', () => {
        if (!cancelled) {
          console.log('[Tavus] Left meeting');
          setStatus('idle');
        }
      });
      call.on('app-message', ({ data }) => {
        const type = data?.event_type;
        if (type) console.log('[Tavus] app-message:', type, data?.properties?.text?.slice?.(0, 60) || '');

        if (type === 'conversation.utterance' && data?.properties) {
          const role = data.properties.role;
          const text = data.properties.speech || data.properties.text || '';
          console.log(`[Tavus] utterance (${role}):`, text.slice(0, 120));
        }

        if (type === 'conversation.ended') {
          console.warn('[Tavus] Conversation ended by Tavus');
          if (!cancelled && onSessionEndedRef.current) {
            onSessionEndedRef.current();
          }
          return;
        }

        if (
          type === 'conversation.replica_stopped_speaking' ||
          type === 'conversation.replica.stopped_speaking' ||
          type === 'conversation.stopped_speaking'
        ) {
          if (onSpeakingDoneRef.current) onSpeakingDoneRef.current();
        }
      });
    }

    ensureConversation(conversationId);

    joinConversation(conversationUrl, conversationId, Daily)
      .then((call) => {
        if (cancelled) return;
        ensureConversation(conversationId);
        bindCall(call, conversationId);
        callRef.current = call;
        bindOngoingListeners(call);
        console.log('[Tavus] Joined meeting');
        setStatus('live');
        Object.values(call.participants()).forEach(applyTracks);

        if (!greetedRef.current && onCallReadyRef.current) {
          greetedRef.current = true;
          onCallReadyRef.current(call);
        }
      })
      .catch((err) => {
        console.error('[Tavus] Join failed:', err);
        if (!cancelled) {
          setStatus('error');
          setErrorDetail(err?.message || String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationUrl, conversationId]);

  function unlockAudio() {
    audioRef.current?.play().then(() => setAudioLocked(false)).catch(() => {});
  }

  const isLive = status === 'live';

  return (
    <div className="avatar-frame">
      {!isLive && (
        <div className="avatar-placeholder">
          {status === 'joining' ? (
            <>
              <Loader className="animate-spin" style={{ width: 32, height: 32 }} />
              <p style={{ fontSize: '11px' }}>Connecting to Maya...</p>
            </>
          ) : (
            <>
              <Video style={{ width: 48, height: 48 }} />
              <p style={{ fontSize: '11px' }}>
                {status === 'error'
                  ? (errorDetail || 'Connection failed')
                  : 'Click "Start Maya" below'}
              </p>
            </>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLive ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />

      <audio ref={audioRef} autoPlay />

      {audioLocked && isLive && (
        <button type="button" onClick={unlockAudio} className="avatar-unlock-audio">
          <Volume2 style={{ width: 12, height: 12 }} />
          Tap to enable audio
        </button>
      )}

      <div className="avatar-connection-badge">
        {isLive ? (
          <>
            <Wifi style={{ width: 12, height: 12, color: '#34c97a' }} />
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#34c97a' }}>LIVE</span>
          </>
        ) : (
          <>
            <WifiOff style={{ width: 12, height: 12, color: '#555f7a' }} />
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#555f7a' }}>
              {status === 'joining' ? 'CONNECTING' : status === 'error' ? 'OFFLINE' : 'IDLE'}
            </span>
          </>
        )}
      </div>

      {isLive && (
        <div className="avatar-status-bar">
          <div className="avatar-name">Maya – AI Analyst</div>
          <div className="avatar-role">Sales Command Center · Bealls</div>
          <div className="avatar-audio">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="audio-bar" />
            ))}
            <div className="speaking-dot" />
          </div>
        </div>
      )}
    </div>
  );
}

export default TavusAvatar;
