import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Volume2, VolumeX, Shield, Mic, MicOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { useInsuranceStore, PHASE } from './store/index.js';
import { useWebSocket }  from './hooks/useWebSocket.js';
import { useAutoplay }   from './hooks/useAutoplay.js';

import LandingScreen    from './components/LandingScreen.jsx';
import IdleScreen       from './components/IdleScreen.jsx';
import TavusAvatar      from './components/TavusAvatar.jsx';
import ReasoningTrace   from './components/ReasoningTrace.jsx';
import Dashboard        from './components/Dashboard.jsx';
import MemoColumn       from './components/MemoColumn.jsx';
import StressTestPanel  from './components/StressTestPanel.jsx';
import Stopwatches      from './components/Stopwatches.jsx';

const LEAD_CAPTURE_URL = import.meta.env.VITE_INSURANCE_LEAD_CAPTURE_URL
  || import.meta.env.VITE_LEAD_CAPTURE_URL
  || 'https://yourdomain.com/insurance-pilot';

export default function InsuranceApp() {
  useWebSocket();
  useAutoplay();

  const phase        = useInsuranceStore((s) => s.phase);
  const memoComplete = useInsuranceStore((s) => s.memoComplete);
  const muted        = useInsuranceStore((s) => s.muted);
  const micEnabled   = useInsuranceStore((s) => s.micEnabled);
  const reset        = useInsuranceStore((s) => s.reset);
  const toggleMute   = useInsuranceStore((s) => s.toggleMute);
  const toggleMic    = useInsuranceStore((s) => s.toggleMic);

  if (phase === PHASE.LANDING) return <LandingScreen />;

  const isIdle = phase === PHASE.IDLE;

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#ece8f8] relative flex flex-col">
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(120,80,200,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(120,80,200,0.05) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[2px] bg-gradient-to-r from-transparent via-purple-300/40 to-transparent" />

      {/* ── TOP BAR ── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-2.5 border-b border-purple-200 flex-shrink-0 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-300 flex items-center justify-center">
            <Shield className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 tracking-wide">Aria</div>
            <div className="text-[10px] font-mono text-purple-700 tracking-widest uppercase">
              AI Underwriting Officer · Meridian Commercial Insurance
            </div>
          </div>
        </div>

        <Stopwatches />

        <div className="flex items-center gap-2">
          <button onClick={toggleMute}
            className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 hover:border-purple-400 transition-all"
            title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={async () => {
              if (!micEnabled) {
                // Request browser mic permission first
                try {
                  await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                } catch (e) {
                  console.warn('[Mic] Permission denied — click the lock icon in the address bar → allow microphone');
                  return;
                }
              }
              toggleMic();
            }}
            className={`relative p-2 rounded-lg border transition-all ${micEnabled
              ? 'bg-green-50 border-green-400 text-green-700'
              : 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100'}`}
            title={micEnabled ? 'Click to mute mic' : 'Click to speak to Aria'}>
            {micEnabled
              ? <><Mic className="w-4 h-4" /><span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /></>
              : <MicOff className="w-4 h-4" />}
          </button>
          {micEnabled && (
            <span className="text-xs font-medium text-green-700 animate-pulse">Listening...</span>
          )}
          {phase !== PHASE.IDLE && (
            <button onClick={reset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 transition-all text-xs font-medium">
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="relative z-10 flex-1 overflow-hidden flex min-h-0">

        {isIdle ? (
          /* ── IDLE: Aria left, drop zone right ── */
          <>
            <div className="flex-shrink-0 flex flex-col" style={{ width: '340px' }}>
              <TavusAvatar />
            </div>
            <div className="flex-1 overflow-hidden">
              <IdleScreen />
            </div>
          </>
        ) : (
          /* ── WORKSPACE: War Room layout ── */
          <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* ── LEFT COLUMN: Aria + Reasoning Trace ── */}
            <div className="flex-shrink-0 flex flex-col border-r border-purple-200" style={{ width: '320px' }}>
              {/* Avatar — top half */}
              <div style={{ height: '300px', flexShrink: 0 }}>
                <TavusAvatar />
              </div>

              {/* QR lead capture */}
              <AnimatePresence>
                {memoComplete && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex-shrink-0 px-3 py-2 border-t border-purple-100 overflow-hidden"
                  >
                    <LeadCaptureSmall url={LEAD_CAPTURE_URL} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reasoning trace — fills rest */}
              <div className="flex-1 min-h-0 border-t border-purple-100 p-4 overflow-hidden">
                <ReasoningTrace />
              </div>
            </div>

            {/* ── CENTER: Dashboard tiles ── */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-purple-200 p-4 overflow-hidden">
              <Dashboard />
            </div>

            {/* ── RIGHT: Memo ── */}
            <div className="flex-shrink-0 flex flex-col p-4 overflow-hidden" style={{ width: '360px' }}>
              <MemoColumn />
            </div>
          </div>
        )}
      </main>

      {/* ── STRESS TEST PANEL — slides up on memo complete ── */}
      <AnimatePresence>
        {memoComplete && phase !== PHASE.IDLE && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
            className="flex-shrink-0 border-t border-purple-800/50 overflow-hidden relative z-20 bg-[#ece8f8]"
          >
            <div className="px-4 py-3">
              <StressTestPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadCaptureSmall({ url }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 border border-purple-200">
      <div className="bg-white rounded p-1 flex-shrink-0">
        <QRCodeSVG value={url} size={36} level="M" fgColor="#0a1628" />
      </div>
      <div>
        <div className="text-[10px] text-purple-600 font-medium">Run on your submission flow?</div>
        <div className="text-[9px] text-slate-700">Scan to start pilot</div>
      </div>
    </div>
  );
}
