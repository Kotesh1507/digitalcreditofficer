import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useStore } from '../store/index.js';
import confetti from 'canvas-confetti';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

const DEFLECT_SCRIPT =
  "Good question. Let me grab my notes. Actually — let's set up a real conversation. Scan the QR code and we'll dig in.";

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
  } = useStore();

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected:', socket.id);
      setSocket(socket);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      setSocket(null);
    });

    // ── Server → Client ─────────────────────────────────────────────────────

    socket.on('connected', (data) => {
      setSessionId(data.sessionId);
    });

    // Avatar session arrives early (created on socket connect in backend)
    socket.on('tavus_session', (data) => {
      setTavusSession(data.conversationId, data.conversationUrl);
    });

    // Each analysis step: update UI and queue the narration
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
          colors: ['#00d4c8', '#ffffff', '#1a3a6c'],
        });
      }
    });

    // Stress test: interrupt any ongoing speech and say the scenario line immediately
    socket.on('scenario_result', (data) => {
      applyScenario(data.scenario);
      sendInterruptAndClear(data.scenario.avatarScript);
    });

    // Q&A chip: interrupt and speak the scripted answer
    socket.on('qa_answer', (data) => {
      setQAAnswer(data.questionId, data.answer);
      sendInterruptAndClear(data.script);
    });

    // Freeform: interrupt and say the deflect line, show QR
    socket.on('freeform_deflect', () => {
      showDeflect();
      sendInterruptAndClear(DEFLECT_SCRIPT);
    });

    socket.on('reset', () => {
      // Server acknowledged reset — store already cleared by reset() action
    });

    return () => {
      socket.disconnect();
    };
  }, []); // eslint-disable-line

  return socketRef;
}
