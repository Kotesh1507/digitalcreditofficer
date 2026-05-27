import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Play } from 'lucide-react';
import { useInsuranceStore } from '../store/index.js';

const GREETING_LINES = [
  "Hi, I'm Aria —",
  "your AI Underwriting Officer.",
  "Drop any commercial P&C submission and I'll build",
  "the full underwriting memo in 90 seconds.",
];

export default function LandingScreen() {
  const startConversation = useInsuranceStore((s) => s.startConversation);
  const [visibleLines, setVisibleLines] = useState(0);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timers = [];
    GREETING_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), 300 + i * 700));
    });
    timers.push(setTimeout(() => setShowButton(true), 300 + GREETING_LINES.length * 700 + 200));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-navy-950 relative flex items-center justify-center">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10"
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

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,200,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,200,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <Particles />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-12 max-w-3xl w-full px-8 text-center">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-accent/20 border border-teal-accent/40 flex items-center justify-center">
            <Shield className="w-6 h-6 text-teal-accent" />
          </div>
          <span className="text-sm font-mono uppercase tracking-[0.25em] text-teal-accent/80">
            Meridian Commercial Insurance Carriers
          </span>
        </motion.div>

        {/* Greeting lines — typewriter effect */}
        <div className="flex flex-col items-center gap-3 min-h-[220px] justify-center">
          <AnimatePresence>
            {visibleLines >= 1 && (
              <motion.div
                key="line1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="font-['DM_Serif_Display'] text-6xl md:text-7xl text-teal-accent leading-tight"
              >
                Hi, I'm Aria —
              </motion.div>
            )}
            {visibleLines >= 2 && (
              <motion.div
                key="line2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="font-['DM_Serif_Display'] text-5xl md:text-6xl text-white leading-tight"
              >
                your AI Underwriting Officer.
              </motion.div>
            )}
            {visibleLines >= 3 && (
              <motion.div
                key="line3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-slate-300 text-xl md:text-2xl leading-relaxed mt-2 max-w-2xl"
              >
                Drop any commercial P&amp;C submission and I'll build
              </motion.div>
            )}
            {visibleLines >= 4 && (
              <motion.div
                key="line4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-slate-300 text-xl md:text-2xl leading-relaxed max-w-2xl"
              >
                the full underwriting memo in{' '}
                <span className="text-teal-accent font-semibold">90 seconds.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA Button */}
        <AnimatePresence>
          {showButton && (
            <motion.button
              key="cta"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
              onClick={startConversation}
              className="
                group relative px-14 py-6 rounded-2xl font-bold text-xl
                bg-gradient-to-r from-teal-accent to-teal-dim text-navy-950
                hover:scale-[1.05] active:scale-[0.97] transition-all duration-200
                shadow-[0_0_50px_rgba(0,212,200,0.45)]
              "
            >
              <span className="flex items-center gap-3">
                <Play className="w-6 h-6 fill-current" />
                Start Conversation
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Tagline */}
        {showButton && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-500 text-sm font-mono tracking-widest"
          >
            AI underwriting officer · Live video avatar · Real-time risk analysis
          </motion.p>
        )}
      </div>
    </div>
  );
}

function Particles() {
  const particles = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 10,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-teal-accent"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: 0.15 }}
          animate={{ y: [0, -40, -20, -50, 0], x: [0, 15, -10, 20, 0], opacity: [0.1, 0.25, 0.15, 0.3, 0.1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
