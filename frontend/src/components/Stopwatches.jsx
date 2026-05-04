import React, { useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import { useStore, PHASE } from '../store/index.js';

// Human timer pre-seeded at 4h 12m 38s
const HUMAN_SEED = 4 * 3600 + 12 * 60 + 38;

function fmt(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export default function Stopwatches() {
  const phase = useStore((s) => s.phase);
  const [agentS, setAgentS] = useState(0);
  const [humanS, setHumanS] = useState(HUMAN_SEED);
  const agentRef = useRef(null);
  const humanRef = useRef(null);

  useEffect(() => {
    if (phase === PHASE.RUNNING || phase === PHASE.COMPLETE) {
      agentRef.current = setInterval(() => setAgentS((s) => s + 1), 1000);
      humanRef.current = setInterval(() => setHumanS((s) => s + 1), 1000);
    } else {
      clearInterval(agentRef.current);
      clearInterval(humanRef.current);
      if (phase === PHASE.IDLE) {
        setAgentS(0);
        setHumanS(HUMAN_SEED);
      }
    }
    return () => {
      clearInterval(agentRef.current);
      clearInterval(humanRef.current);
    };
  }, [phase]);

  if (phase === PHASE.IDLE) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10">
      {/* Agent */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-teal-accent animate-pulse" />
        <div>
          <div className="text-[9px] font-mono text-teal-accent/60 uppercase tracking-widest">AI Officer</div>
          <div className="text-base font-mono font-bold text-teal-accent tabular-nums">
            {fmt(agentS)}
          </div>
        </div>
      </div>

      <div className="text-slate-700 text-xs font-mono">vs</div>

      {/* Human */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" style={{ animationDuration: '2s' }} />
        <div>
          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Loan Officer</div>
          <div className="text-base font-mono font-bold text-slate-500 tabular-nums">
            {fmt(humanS)}
          </div>
        </div>
      </div>

      <Timer className="w-3.5 h-3.5 text-slate-700 ml-1" />
    </div>
  );
}
