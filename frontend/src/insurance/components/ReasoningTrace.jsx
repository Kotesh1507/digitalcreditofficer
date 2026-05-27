import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useInsuranceStore } from '../store/index.js';

export default function ReasoningTrace() {
  const traceLines = useInsuranceStore((s) => s.traceLines);
  const scrollRef  = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [traceLines]);

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
        <span className="font-mono uppercase tracking-widest font-bold" style={{ fontSize: '12px', color: '#3b0764' }}>
          Agent Reasoning
        </span>
      </div>

      {/* Scrollable list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 space-y-0.5 pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,212,200,0.2) transparent' }}
      >
        <AnimatePresence initial={false}>
          {traceLines.map((line) => (
            <TraceLine key={line.index} line={line} />
          ))}
        </AnimatePresence>

        {traceLines.length === 0 && (
          <p className="text-slate-800 font-mono italic pt-2" style={{ fontSize: '12px' }}>
            Waiting for documents...
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 mt-2 pt-2 border-t border-white/5 flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3.5 rounded bg-teal-accent" />
          <span className="font-mono text-slate-700" style={{ fontSize: '12px' }}>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span className="font-mono text-slate-700" style={{ fontSize: '12px' }}>Done</span>
        </div>
      </div>
    </div>
  );
}

function TraceLine({ line }) {
  const isActive = line.status === 'active';
  const isDone   = line.status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-2 px-2 py-1.5 rounded-md transition-all duration-300
        ${isActive ? 'bg-teal-accent/5 border-l-2 border-purple-400' : 'border-l-2 border-transparent'}`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isDone ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </motion.div>
        ) : isActive ? (
          <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
        ) : (
          <div className="w-4 h-4 rounded-full border border-slate-700" />
        )}
      </div>

      {/* Text — 13px for comfortable reading */}
      <span style={{ fontSize: '12px', lineHeight: '1.6' }}
        className={`font-mono whitespace-pre-wrap break-words
          ${isDone   ? 'text-slate-700'
          : isActive ? 'text-purple-600'
                     : 'text-slate-800'}`}>
        {isActive ? <TypewriterText text={line.text} /> : line.text}
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
    }, 14);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-1 h-3.5 bg-teal-accent ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  );
}
