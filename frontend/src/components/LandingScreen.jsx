import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Play } from 'lucide-react';
import { useStore } from '../store/index.js';

export default function LandingScreen() {
  const startConversation = useStore((s) => s.startConversation);

  return (
    <div className="h-screen w-screen overflow-hidden bg-navy-950 relative flex items-center justify-center">
      {/* Background gradient */}
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

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,200,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,200,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Particles */}
      <Particles />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-10 max-w-xl w-full px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-teal-accent/20 border border-teal-accent/40 flex items-center justify-center">
            <Zap className="w-7 h-7 text-teal-accent" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-teal-accent/70 mb-3">
              Hill Country Community Bank
            </div>
            <h1 className="font-['DM_Serif_Display'] text-5xl text-white mb-3 leading-tight">
              Digital Credit Officer
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              AI-powered SBA 7(a) loan analysis — complete credit memos in 90 seconds.
            </p>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onClick={startConversation}
          className="
            group relative px-10 py-5 rounded-xl font-semibold text-lg
            bg-gradient-to-r from-teal-accent to-teal-dim text-navy-950
            hover:scale-[1.04] active:scale-[0.97] transition-all duration-200
            shadow-[0_0_40px_rgba(0,212,200,0.35)]
          "
        >
          <span className="flex items-center gap-3">
            <Play className="w-5 h-5 fill-current" />
            Start Conversation
          </span>
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-slate-600 text-xs font-mono"
        >
          AI officer · Live video avatar · Real-time credit analysis
        </motion.p>
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
