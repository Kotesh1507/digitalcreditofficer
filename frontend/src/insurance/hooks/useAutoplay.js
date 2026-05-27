// Auto-starts the demo after 30s of idle — same pattern as CDO
import { useEffect, useRef } from 'react';
import { useInsuranceStore, PHASE } from '../store/index.js';

export function useAutoplay() {
  const phase     = useInsuranceStore((s) => s.phase);
  const startDemo = useInsuranceStore((s) => s.startDemo);
  const timerRef  = useRef(null);

  const resetTimer = () => {
    clearTimeout(timerRef.current);
    if (phase === PHASE.IDLE) {
      timerRef.current = setTimeout(() => {
        startDemo();
      }, 30000);
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
