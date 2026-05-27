import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useInsuranceStore } from '../store/index.js';
import confetti from 'canvas-confetti';

// In dev, connect directly to port 5001. In production (Docker), same origin on port 5001.
const SERVER_URL = import.meta.env.VITE_INSURANCE_SERVER_URL
  || (window.location.hostname === 'localhost'
      ? 'http://localhost:5002'
      : window.location.origin.replace(/:\d+$/, ':5002'));

const DEFLECT_SCRIPT =
  "Good question. For a deeper conversation, let's set this up properly — scan the QR code and we'll look at your submission together.";

// Session nonce — incremented on every 'connected' event so stale
// 'tavus_session' events from previous sessions are silently dropped.
let _sessionNonce = 0;

export function useWebSocket() {
  const socketRef = useRef(null);

  const {
    setSocket,
    setSessionId,
    setTavusSession,
    processStep,
    setMemoComplete,
    applyScenario,
    setQAAnswer,
    showDeflect,
    addToSpeechQueue,
    sendInterruptAndClear,
    muted,
  } = useInsuranceStore();

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Insurance WS] Connected:', socket.id);
      setSocket(socket);
    });

    socket.on('disconnect', () => {
      console.log('[Insurance WS] Disconnected');
      setSocket(null);
    });

    socket.on('connected', async (data) => {
      // Bump nonce — any tavus_session event carrying an older nonce is stale
      _sessionNonce += 1;
      const myNonce = _sessionNonce;
      console.log('[Insurance WS] connected — session nonce', myNonce);

      setSessionId(data.sessionId);
      // Fully destroy any existing Daily call so TavusAvatar starts fresh
      const existingCall = window.__ariaCall;
      window.__ariaCall   = null;
      window.__ariaUrl    = null;
      window.__ariaJoined = false;
      if (existingCall) {
        try { await existingCall.leave(); }   catch (_) {}
        try { existingCall.destroy(); }       catch (_) {}
      }
      // Also destroy any Daily singleton we don't own
      try {
        const inst = window.DailyIframe?.getCallInstance?.();
        if (inst && inst !== existingCall) {
          try { await inst.leave(); } catch (_) {}
          try { inst.destroy(); }     catch (_) {}
        }
      } catch (_) {}
      useInsuranceStore.getState().setTavusSession(null, null);
      useInsuranceStore.getState().setCallObject(null);
      // Request fresh Tavus session from backend — give Daily time to clean up
      setTimeout(() => {
        if (_sessionNonce === myNonce) {
          console.log('[Insurance WS] Requesting fresh Tavus session (nonce', myNonce, ')');
          socket.emit('init_tavus');
        }
      }, 800);
    });

    socket.on('tavus_session', (data) => {
      // Discard events that arrived before the latest 'connected' cleanup
      const nonce = _sessionNonce;
      console.log('[Insurance WS] tavus_session received (nonce', nonce, '):', data.conversationId, data.conversationUrl?.slice(0,40));
      setTavusSession(data.conversationId, data.conversationUrl);
    });

    socket.on('step', (data) => {
      processStep(data);
      if (data.tavusNarration) {
        addToSpeechQueue(data.tavusNarration);
      }
    });

    socket.on('memo_complete', () => {
      setMemoComplete();
      if (!muted) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#00d4c8', '#ffffff', '#1e3a5f'],
        });
      }
    });

    // Stress test: interrupt ongoing speech and say the scenario line
    socket.on('scenario_result', (data) => {
      applyScenario(data.scenario);
      if (data.scenario.avatarScript) {
        sendInterruptAndClear(data.scenario.avatarScript);
      }
    });

    // Q&A chip: interrupt and speak the scripted answer
    socket.on('qa_answer', (data) => {
      setQAAnswer(data.questionId, data.answer);
      if (data.script) sendInterruptAndClear(data.script);
    });

    // Freeform: show QR + deflect
    socket.on('freeform_deflect', (data) => {
      showDeflect();
      sendInterruptAndClear(data?.script || DEFLECT_SCRIPT);
    });

    socket.on('reset', () => {
      // server ack — store already cleared by reset() action
    });

    return () => {
      socket.disconnect();
    };
  }, []); // eslint-disable-line

  return socketRef;
}
