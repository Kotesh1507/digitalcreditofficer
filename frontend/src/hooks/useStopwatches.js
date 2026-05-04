import { useEffect, useRef } from 'react';
import { useStore, PHASE } from '../store/index.js';

// Human timer is pre-seeded at 4h 12m 38s = 15158 seconds
const HUMAN_START_SECONDS = 15158;

export function useStopwatches() {
  const phase = useStore((s) => s.phase);
  const agentElapsed = useStore((s) => s.agentElapsed);
  const tickAgent = useStore((s) => s.tickAgent);
  const agentRef = useRef(null);
  const humanRef = useRef(null);
  const humanElapsedRef = useRef(HUMAN_START_SECONDS);

  // Agent timer
  useEffect(() => {
    if (phase === PHASE.RUNNING || phase === PHASE.COMPLETE) {
      agentRef.current = setInterval(() => tickAgent(), 1000);
    } else {
      clearInterval(agentRef.current);
    }
    return () => clearInterval(agentRef.current);
  }, [phase, tickAgent]);

  // Human timer — starts same time as agent, just pre-seeded way ahead
  useEffect(() => {
    if (phase === PHASE.RUNNING || phase === PHASE.COMPLETE) {
      humanRef.current = setInterval(() => {
        humanElapsedRef.current += 1;
      }, 1000);
    } else {
      clearInterval(humanRef.current);
    }
    return () => clearInterval(humanRef.current);
  }, [phase]);

  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  return {
    agentTime: formatTime(agentElapsed),
    humanTime: () => formatTime(humanElapsedRef.current),
  };
}
