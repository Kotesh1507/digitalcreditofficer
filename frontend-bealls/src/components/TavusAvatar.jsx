import React, { useEffect, useRef, useState } from 'react';
import Daily from '@daily-co/daily-js';
import { Video, Wifi, WifiOff, Loader, Volume2, Mic, MicOff } from 'lucide-react';
import {
  joinConversation,
  ensureConversation,
  bindCall,
  leaveConversation,
} from '../lib/tavusClient';

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
  replicaLabel,
  onCallReady,
  onSpeakingDone,
  onStatusChange,
  onSessionEnded,
  onUserUtterance,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const onCallReadyRef = useRef(onCallReady);
  const onSpeakingDoneRef = useRef(onSpeakingDone);
  const onSessionEndedRef = useRef(onSessionEnded);
  const onUserUtteranceRef = useRef(onUserUtterance);
  const callRef = useRef(null);
  const greetedRef = useRef(false);

  const [status, setStatus] = useState('idle');
  const [audioLocked, setAudioLocked] = useState(false);
  const [errorDetail, setErrorDetail] = useState(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micError, setMicError] = useState(null);

  useEffect(() => {
    onCallReadyRef.current = onCallReady;
    onSpeakingDoneRef.current = onSpeakingDone;
    onSessionEndedRef.current = onSessionEnded;
    onUserUtteranceRef.current = onUserUtterance;
  }, [onCallReady, onSpeakingDone, onSessionEnded, onUserUtterance]);

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
        if (participant?.local) {
          const micOn = participant.audio === true;
          setMicEnabled(micOn);
          if (micOn) setMicError(null);
          return;
        }
        applyTracks(participant);
      });
      call.on('participant-updated', ({ participant }) => {
        if (participant?.local) {
          const micOn = participant.audio === true;
          setMicEnabled(micOn);
          if (micOn) setMicError(null);
          return;
        }
        applyTracks(participant);
      });
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
          const isDone = data.properties.done !== false; // Only process complete utterances
          console.log(`[Tavus] utterance (${role}, done=${isDone}):`, text.slice(0, 120));

          // When user finishes speaking, route to backend for analysis
          if (role === 'user' && text.trim() && isDone && onUserUtteranceRef.current) {
            console.log('[Tavus] User finished speaking - routing to backend:', text.slice(0, 80));
            onUserUtteranceRef.current(text);
          }
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
      .then(async (call) => {
        if (cancelled) return;
        ensureConversation(conversationId);
        bindCall(call, conversationId);
        callRef.current = call;
        bindOngoingListeners(call);
        console.log('[Tavus] Joined meeting');
        const localParticipant = call.participants()?.local;
        setMicEnabled(localParticipant?.audio === true);
        setMicError(null);

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
      if (videoRef.current) videoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
      leaveConversation(Daily).catch(() => {});
    };
  }, [conversationUrl, conversationId]);

  function unlockAudio() {
    audioRef.current?.play().then(() => setAudioLocked(false)).catch(() => {});
  }

  async function enableMicrophone() {
    const call = callRef.current;
    if (!call) return;

    try {
      setMicError(null);

      // Ask browser permission via explicit user gesture.
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }

      // Prefer Daily local audio toggle first.
      // If Daily has not started the local audio device yet, fall back to startCamera.
      try {
        await call.setLocalAudio(true);
      } catch {
        await call.startCamera({ audioSource: true, videoSource: false });
        await call.setLocalAudio(true);
      }

      const localParticipant = call.participants()?.local;
      const micOn = localParticipant?.audio === true;
      setMicEnabled(micOn);
      if (micOn) {
        setMicError(null);
      } else {
        setMicError('Microphone is allowed, but audio is still off in call. Click Enable Mic once more.');
      }
      console.log('[Tavus] Microphone manually enabled:', localParticipant?.audio);
    } catch (err) {
      console.error('[Tavus] Failed to enable microphone:', err);
      setMicEnabled(false);
      setMicError('Microphone permission is blocked. Allow mic in browser site settings, then click Enable Mic again.');
    }
  }

  const isLive = status === 'live';

  return (
    <div className="avatar-frame">
      {!isLive && (
        <div className="avatar-placeholder">
          {status === 'joining' ? (
            <>
              <Loader className="animate-spin" style={{ width: 32, height: 32 }} />
              <p style={{ fontSize: '11px' }}>Connecting to Bealls Analyst...</p>
            </>
          ) : (
            <>
              <Video style={{ width: 48, height: 48 }} />
              <p style={{ fontSize: '11px' }}>
                {status === 'error'
                  ? (errorDetail || 'Connection failed')
                  : 'Click "Start Analyst" below'}
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

      {/* Microphone status indicator */}
      {isLive && !micEnabled && (
        <button
          type="button"
          onClick={enableMicrophone}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(220, 53, 69, 0.9)',
            border: 'none',
            borderRadius: 4,
            padding: '4px 8px',
            color: 'white',
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 10,
          }}
        >
          <MicOff style={{ width: 12, height: 12 }} />
          Enable Mic
        </button>
      )}

      {isLive && micError && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 8,
            maxWidth: 210,
            background: 'rgba(220, 53, 69, 0.92)',
            borderRadius: 4,
            padding: '6px 8px',
            color: 'white',
            fontSize: 10,
            zIndex: 10,
            lineHeight: 1.35,
          }}
        >
          {micError}
        </div>
      )}

      {isLive && micEnabled && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(40, 167, 69, 0.9)',
            borderRadius: 4,
            padding: '4px 8px',
            color: 'white',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 10,
          }}
        >
          <Mic style={{ width: 12, height: 12 }} />
          Mic ON
        </div>
      )}

      <div className="avatar-connection-badge">
        {isLive ? (
          <>
            <Wifi style={{ width: 12, height: 12, color: 'var(--green)' }} />
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--green)' }}>LIVE</span>
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
          <div className="avatar-name">Bealls Analyst</div>
          <div className="avatar-role">
            {replicaLabel ? `${replicaLabel} · ` : ''}Sales Command Center
          </div>
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
