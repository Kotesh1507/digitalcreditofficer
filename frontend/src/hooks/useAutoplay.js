import { useEffect, useRef } from 'react';
import { useStore, PHASE } from '../store/index.js';

export function useAutoplay() {
  const phase = useStore((s) => s.phase);
  const startDemo = useStore((s) => s.startDemo);
  const timerRef = useRef(null);

  const resetTimer = () => {
    clearTimeout(timerRef.current);
    if (phase === PHASE.IDLE) {
      timerRef.current = setTimeout(() => {
        startDemo();
      }, 30000); // 30 seconds
    }
  };

  useEffect(() => {
    if (phase !== PHASE.IDLE) {
      clearTimeout(timerRef.current);
      return;
    }

    resetTimer();

    const events = ['mousedown', 'touchstart', 'keydown'];
    events.forEach((e) => window.addEventListener(e, resetTimer));

    return () => {
      clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [phase]); // eslint-disable-line
}
