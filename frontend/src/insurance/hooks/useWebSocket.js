import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useInsuranceStore } from '../store/index.js';
import confetti from 'canvas-confetti';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SERVER_URL = import.meta.env.VITE_INSURANCE_SERVER_URL
  || (IS_DEV ? 'http://localhost:5002' : window.location.origin);

const DEFLECT_SCRIPT =
  "Good question. For a deeper conversation, let's set this up properly — scan the QR code and we'll look at your submission together.";

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

    socket.on('connected', (data) => {
      setSessionId(data.sessionId);
    });

    socket.on('tavus_session', (data) => {
      console.log('[Insurance WS] tavus_session:', data.conversationId, data.conversationUrl?.slice(0, 40));
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

    socket.on('scenario_result', (data) => {
      applyScenario(data.scenario);
      if (data.scenario.avatarScript) {
        sendInterruptAndClear(data.scenario.avatarScript);
      }
    });

    socket.on('qa_answer', (data) => {
      setQAAnswer(data.questionId, data.answer);
      if (data.script) sendInterruptAndClear(data.script);
    });

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
