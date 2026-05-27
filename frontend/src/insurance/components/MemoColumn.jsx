import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, CheckCircle } from 'lucide-react';
import { useInsuranceStore } from '../store/index.js';

export default function MemoColumn() {
  const memoText       = useInsuranceStore((s) => s.memoText);
  const memoComplete   = useInsuranceStore((s) => s.memoComplete);
  const activeScenario = useInsuranceStore((s) => s.activeScenario);

  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const queueRef    = useRef('');
  const intervalRef = useRef(null);
  const scrollRef   = useRef(null);

  // Typewriter effect
  useEffect(() => {
    const newChars = memoText.slice(displayText.length + queueRef.current.length);
    if (!newChars) return;
    queueRef.current += newChars;
    if (intervalRef.current) return;
    setIsTyping(true);
    intervalRef.current = setInterval(() => {
      if (queueRef.current.length === 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsTyping(false);
        return;
      }
      const chunk = queueRef.current.slice(0, 1);
      queueRef.current = queueRef.current.slice(1);
      setDisplayText((prev) => prev + chunk);
    }, 25);
    return () => { clearInterval(intervalRef.current); intervalRef.current = null; };
  }, [memoText]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayText]);

  // Append scenario override text
  useEffect(() => {
    if (activeScenario) {
      const override = `\n\n── SCENARIO: ${activeScenario.label.toUpperCase()} ──\n${activeScenario.memoOverride}\n`;
      setDisplayText((prev) => prev + override);
    }
  }, [activeScenario]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/insurance-api/memo/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: activeScenario?.id ?? null }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const contentType = res.headers.get('Content-Type');
      if (contentType?.includes('application/pdf')) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'underwriting-memo-apex-precision.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const { html } = await res.json();
        const blob = new Blob([html], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const renderMemo = (text) =>
    text.split('\n').map((line, i) => {
      if (line === line.toUpperCase() && line.length > 3 && !line.startsWith('$') && !line.startsWith('─') && !line.startsWith('[')) {
        return (
          <div key={i} className="mt-4 mb-1.5 font-semibold tracking-widest text-purple-700 font-mono border-b border-purple-200 pb-1" style={{ fontSize: '12px' }}>
            {line}
          </div>
        );
      }
      if (line.startsWith('──')) {
        return <div key={i} className="mt-3 mb-1 font-mono text-amber-600" style={{ fontSize: '12px' }}>{line}</div>;
      }
      if (line.startsWith('[AMBER') || line.startsWith('[GREEN') || line.startsWith('[RED')) {
        return (
          <div key={i} className="flex gap-1.5 text-amber-700 leading-relaxed py-0.5" style={{ fontSize: '12px' }}>
            <span className="text-amber-600 mt-0.5">⚠</span>
            <NumberHighlight text={line} />
          </div>
        );
      }
      if (line.match(/^\d+\./)) {
        return (
          <div key={i} className="flex gap-1.5 text-slate-800 leading-relaxed py-0.5" style={{ fontSize: '12px' }}>
            <span className="text-purple-700 mt-0.5">▸</span>
            <NumberHighlight text={line} />
          </div>
        );
      }
      if (!line.trim()) return <div key={i} className="h-1.5" />;
      return (
        <p key={i} className="text-slate-800 leading-relaxed py-0.5" style={{ fontSize: '12px' }}>
          <NumberHighlight text={line} />
        </p>
      );
    });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
        <span className="font-mono uppercase tracking-widest font-bold" style={{ fontSize: '12px', color: '#3b0764' }}>
          Underwriting Memo
        </span>
        {isTyping && (
          <div className="ml-auto flex items-center gap-1 text-slate-800 font-mono" style={{ fontSize: '12px' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-teal-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-teal-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-teal-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg bg-white/[0.02] border border-slate-100 p-4">
        {displayText.length === 0 ? (
          <div className="text-slate-700 text-xs font-mono italic">Memo will write itself here...</div>
        ) : (
          <div className="font-serif">
            {renderMemo(displayText)}
            {isTyping && <span className="inline-block w-1.5 h-3.5 bg-teal-accent animate-pulse ml-0.5 -mb-0.5" />}
          </div>
        )}
      </div>

      <AnimatePresence>
        {memoComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex-shrink-0 mt-3"
          >
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="
                w-full py-3 px-4 rounded-xl font-semibold text-sm
                flex items-center justify-center gap-2
                bg-gradient-to-r from-purple-600 to-purple-500
                hover:from-purple-500 hover:to-purple-400
                text-white transition-all duration-200
                hover:scale-[1.02] active:scale-[0.98]
                disabled:opacity-60 disabled:cursor-not-allowed
                shadow-[0_0_20px_rgba(168,85,247,0.25)]
              "
            >
              {downloading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating PDF...</>
              ) : (
                <><Download className="w-4 h-4" /> Download Underwriting Memo <CheckCircle className="w-3.5 h-3.5 text-green-300" /></>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NumberHighlight({ text }) {
  const parts = text.split(/(\$[\d,]+(?:\.\d+)?[KMB]?|\d+(?:\.\d+)?(?:x|%)?)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\$[\d,]|^\d+/.test(part) ? (
          <span key={i} className="text-purple-700 font-mono font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
