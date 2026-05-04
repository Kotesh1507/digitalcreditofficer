import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Volume2, VolumeX, Zap, Mic, MicOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { useStore, PHASE } from './store/index.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useAutoplay } from './hooks/useAutoplay.js';

import IdleScreen from './components/IdleScreen.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import TavusAvatar from './components/TavusAvatar.jsx';
import ReasoningTrace from './components/ReasoningTrace.jsx';
import Dashboard from './components/Dashboard.jsx';
import MemoColumn from './components/MemoColumn.jsx';
import StressTestPanel from './components/StressTestPanel.jsx';
import Stopwatches from './components/Stopwatches.jsx';

export default function App() {
  useWebSocket();
  useAutoplay();

  const phase        = useStore((s) => s.phase);
  const memoComplete = useStore((s) => s.memoComplete);
  const muted        = useStore((s) => s.muted);
  const micEnabled   = useStore((s) => s.micEnabled);
  const reset        = useStore((s) => s.reset);
  const toggleMute   = useStore((s) => s.toggleMute);
  const toggleMic    = useStore((s) => s.toggleMic);

  if (phase === PHASE.LANDING) {
    return <LandingScreen />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-navy-950 relative flex flex-col">
      <BackgroundGradient />

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-accent/20 border border-teal-accent/40 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-teal-accent" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">Digital Credit Officer</div>
            <div className="text-[10px] font-mono text-slate-600 leading-tight">SBA 7(a) · Hill Country Community Bank</div>
          </div>
        </div>

        <Stopwatches />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title={muted ? 'Unmute speaker' : 'Mute speaker'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleMic}
            className={`p-2 rounded-lg border transition-all ${
              micEnabled
                ? 'bg-teal-accent/15 border-teal-accent/40 text-teal-accent hover:bg-teal-accent/25'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={micEnabled ? 'Mute mic' : 'Unmute mic'}
          >
            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {phase !== PHASE.IDLE && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </header>

      {/* Main content — avatar always in left panel */}
      <main className="relative z-10 flex-1 overflow-hidden flex">

        {/* LEFT: Avatar (always visible — idle greet through memo complete) */}
        <div className="w-64 xl:w-72 flex-shrink-0 flex flex-col p-4 border-r border-white/5">
          <div className="flex-1 min-h-0">
            <TavusAvatar />
          </div>

          {/* Lead capture QR — only shown in workspace */}
          <AnimatePresence>
            {phase !== PHASE.IDLE && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex-shrink-0 mt-3 pt-3 border-t border-white/5 overflow-hidden"
              >
                <LeadCaptureSmall />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: Idle screen or workspace */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {phase === PHASE.IDLE ? (
              <motion.div
                key="idle"
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                <IdleScreen />
              </motion.div>
            ) : (
              <motion.div
                key="workspace"
                className="h-full flex flex-col overflow-hidden"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                {/* Three analysis columns */}
                <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
                  {/* Reasoning trace */}
                  <div className="w-64 xl:w-72 flex-shrink-0 p-4 border-r border-white/5 overflow-hidden flex flex-col">
                    <ReasoningTrace />
                  </div>

                  {/* Dashboard */}
                  <div className="flex-1 p-4 border-r border-white/5 overflow-hidden flex flex-col min-w-0">
                    <Dashboard />
                  </div>

                  {/* Credit memo */}
                  <div className="flex-1 p-4 overflow-hidden flex flex-col min-w-0">
                    <MemoColumn />
                  </div>
                </div>

                {/* Stress test + Q&A panel slides up when memo completes */}
                <AnimatePresence>
                  {memoComplete && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 28 }}
                      className="flex-shrink-0 border-t border-white/5 overflow-hidden"
                    >
                      <div className="p-4">
                        <StressTestPanel />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ── Background gradient ────────────────────────────────────────────────────────
function BackgroundGradient() {
  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00d4c8 0%, transparent 70%)' }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #1a3a6c 0%, transparent 70%)' }}
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,200,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,200,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </>
  );
}

// ── Lead capture QR ────────────────────────────────────────────────────────────
function LeadCaptureSmall() {
  const url = import.meta.env.VITE_LEAD_CAPTURE_URL || 'https://yourdomain.com/pilot';
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-teal-accent/5 border border-teal-accent/10">
      <div className="bg-white rounded p-1 flex-shrink-0">
        <QRCodeSVG value={url} size={40} level="M" fgColor="#0a1628" />
      </div>
      <div>
        <div className="text-[10px] text-teal-accent/80 font-medium">Run on your borrowers?</div>
        <div className="text-[9px] text-slate-600">Scan to start pilot</div>
      </div>
    </div>
  );
}
