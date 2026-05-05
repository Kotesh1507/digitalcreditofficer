import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Zap } from 'lucide-react';
import { useStore } from '../store/index.js';

export default function IdleScreen() {
  const startDemo = useStore((s) => s.startDemo);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    startDemo();
  }, [startDemo]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileChange = useCallback(() => {
    startDemo();
  }, [startDemo]);

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center justify-center h-full w-full relative overflow-hidden">
      {/* Animated background particles */}
      <Particles />

      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,212,200,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,200,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-12 max-w-2xl w-full px-8">
        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-teal-accent/20 border border-teal-accent/40 flex items-center justify-center">
              <Zap className="w-5 h-5 text-teal-accent" />
            </div>
            <span className="text-xs font-mono uppercase tracking-[0.3em] text-teal-accent/70">
              Clair
            </span>
          </div>

          <h1 className="font-['DM_Serif_Display'] text-5xl text-white mb-3 leading-tight">
            Build a credit memo
            <br />
            <span className="text-teal-accent italic">in 90 seconds.</span>
          </h1>

          <p className="text-slate-400 text-base leading-relaxed max-w-md mx-auto">
            Drop any small business loan packet and watch an AI credit officer 
            build the complete credit memo — every ratio, every risk, every recommendation.
          </p>
        </motion.div>

        {/* Drop zone */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleZoneClick}
            className={`
              relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
              transition-all duration-300
              ${dragOver
                ? 'border-teal-accent bg-teal-accent/10 scale-[1.02]'
                : 'border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.05]'
              }
            `}
          >
            <div className="flex flex-col items-center gap-4">
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${dragOver ? 'bg-teal-accent/20 scale-110' : 'bg-white/10'}
              `}>
                <Upload className={`w-7 h-7 transition-colors ${dragOver ? 'text-teal-accent' : 'text-slate-400'}`} />
              </div>

              <div>
                <p className="text-white font-medium mb-1">Drop a loan packet here</p>
                <p className="text-slate-500 text-sm">
                  Tax returns, bank statements, SBA forms — any files
                </p>
              </div>

              {/* Document type badges */}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['1120-S / 1040', 'Bank Statements', 'SBA Form 1919', 'Personal FS 413', 'Appraisal'].map((label) => (
                  <span key={label} className="px-2 py-0.5 text-xs rounded bg-white/5 border border-white/10 text-slate-500">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* OR divider + tap to start */}
        <motion.div
          className="w-full flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-slate-500 text-sm font-mono">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={startDemo}
            className="
              group relative px-8 py-4 rounded-xl font-semibold text-base
              bg-gradient-to-r from-teal-accent to-teal-dim text-navy-950
              hover:scale-[1.03] active:scale-[0.98] transition-all duration-200
              shadow-[0_0_30px_rgba(0,212,200,0.3)]
            "
          >
            <span className="relative z-10 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Use demo packet — Lone Star Outdoor Supply
            </span>
          </button>

          <p className="text-slate-600 text-xs font-mono">
            Auto-starts in 30s if idle
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Subtle floating background particles
function Particles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
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
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: 0.15,
          }}
          animate={{
            y: [0, -40, -20, -50, 0],
            x: [0, 15, -10, 20, 0],
            opacity: [0.1, 0.25, 0.15, 0.3, 0.1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
