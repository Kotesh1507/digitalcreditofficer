import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, CheckCircle } from 'lucide-react';
import { useStore } from '../store/index.js';

export default function MemoColumn() {
  const memoText = useStore((s) => s.memoText);
  const memoComplete = useStore((s) => s.memoComplete);
  const activeScenario = useStore((s) => s.activeScenario);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const queueRef = useRef('');
  const intervalRef = useRef(null);
  const scrollRef = useRef(null);

  // Typewriter effect — drip new characters from memoText into displayText
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
      const charsPerTick = 2;
      const chunk = queueRef.current.slice(0, charsPerTick);
      queueRef.current = queueRef.current.slice(charsPerTick);
      setDisplayText((prev) => prev + chunk);
    }, 12);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [memoText]);

  // Scroll to bottom as text appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayText]);

  // When scenario changes, append the override text
  useEffect(() => {
    if (activeScenario) {
      const override = `\n\n── SCENARIO: ${activeScenario.label.toUpperCase()} ──\nDSCR: ${activeScenario.newDscr}x\n${activeScenario.memoOverride}\n`;
      setDisplayText((prev) => prev + override);
    }
  }, [activeScenario]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/memo/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: activeScenario?.id ?? null,
        }),
      });

      if (!res.ok) throw new Error('PDF generation failed');

      const contentType = res.headers.get('Content-Type');
      if (contentType?.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'credit-memo-lone-star-outdoor.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Fallback — server returned HTML for client-side rendering
        const { html } = await res.json();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Render memo text with visual formatting
  const renderMemo = (text) => {
    return text.split('\n').map((line, i) => {
      // Section headers (ALL CAPS lines)
      if (line === line.toUpperCase() && line.length > 3 && !line.startsWith('$') && !line.startsWith('─')) {
        return (
          <div key={i} className="mt-4 mb-1 text-[10px] font-semibold tracking-widest text-teal-accent/80 font-mono border-b border-teal-accent/10 pb-1">
            {line}
          </div>
        );
      }
      // Scenario dividers
      if (line.startsWith('──')) {
        return (
          <div key={i} className="mt-3 mb-1 text-[10px] font-mono text-amber-400/60">
            {line}
          </div>
        );
      }
      // Bullet points
      if (line.startsWith('- ')) {
        return (
          <div key={i} className="flex gap-1.5 text-[11px] text-slate-300 leading-relaxed py-0.5">
            <span className="text-teal-accent/60 mt-0.5">▸</span>
            <NumberHighlight text={line.slice(2)} />
          </div>
        );
      }
      // Empty lines
      if (!line.trim()) return <div key={i} className="h-1" />;

      return (
        <p key={i} className="text-[11px] text-slate-300 leading-relaxed py-0.5">
          <NumberHighlight text={line} />
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        <span className="text-xs font-mono uppercase tracking-widest text-purple-400/70">
          Credit Memo
        </span>
        {isTyping && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-600 font-mono">
            <div className="w-1 h-1 rounded-full bg-teal-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 rounded-full bg-teal-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 rounded-full bg-teal-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      {/* Memo body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg bg-white/[0.02] border border-white/5 p-4"
      >
        {displayText.length === 0 ? (
          <div className="text-slate-700 text-xs font-mono italic">
            Memo will write itself here...
          </div>
        ) : (
          <div className="font-serif">
            {renderMemo(displayText)}
            {isTyping && (
              <span className="inline-block w-1.5 h-3.5 bg-teal-accent animate-pulse ml-0.5 -mb-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Download button — slides up on completion */}
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
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Credit Memo
                  <CheckCircle className="w-3.5 h-3.5 text-green-300" />
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Highlight numbers in text with a brief amber flash
function NumberHighlight({ text }) {
  const parts = text.split(/(\$[\d,]+(?:\.\d+)?[KMB]?|\d+(?:\.\d+)?(?:x|%)?)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\$[\d,]|^\d+/.test(part) ? (
          <span key={i} className="text-teal-accent/90 font-mono font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
