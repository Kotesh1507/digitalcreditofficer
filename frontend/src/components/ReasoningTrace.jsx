import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useStore } from '../store/index.js';

export default function ReasoningTrace() {
  const traceLines = useStore((s) => s.traceLines);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [traceLines]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-teal-accent animate-pulse" />
        <span className="text-xs font-mono uppercase tracking-widest text-teal-accent/70">
          Agent Reasoning
        </span>
      </div>

      {/* Trace lines */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 pr-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        <AnimatePresence initial={false}>
          {traceLines.map((line) => (
            <TraceLine key={line.index} line={line} />
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {traceLines.length === 0 && (
          <div className="text-slate-600 text-xs font-mono italic">
            Waiting for documents...
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 mt-3 pt-3 border-t border-white/5 flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 rounded bg-teal-accent" />
          <span className="text-[10px] font-mono text-slate-600">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-ok" />
          <span className="text-[10px] font-mono text-slate-600">Done</span>
        </div>
      </div>
    </div>
  );
}

function TraceLine({ line }) {
  const isActive = line.status === 'active';
  const isDone = line.status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`
        flex items-start gap-2.5 px-2 py-1.5 rounded text-xs font-mono
        transition-all duration-300
        ${isActive ? 'bg-teal-accent/5 border-l-2 border-teal-accent' : 'border-l-2 border-transparent'}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isDone ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          </motion.div>
        ) : isActive ? (
          <Loader2 className="w-3.5 h-3.5 text-teal-accent animate-spin" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-slate-700" />
        )}
      </div>

      {/* Text */}
      <span
        className={`
          leading-tight
          ${isDone ? 'text-slate-400' : isActive ? 'text-teal-accent' : 'text-slate-600'}
        `}
      >
        {isActive ? (
          <TypewriterText text={line.text} />
        ) : (
          line.text
        )}
      </span>
    </motion.div>
  );
}

function TypewriterText({ text }) {
  const [displayed, setDisplayed] = React.useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-1.5 h-3 bg-teal-accent ml-0.5 animate-pulse" />
      )}
    </span>
  );
}
