import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Shield } from 'lucide-react';
import { useInsuranceStore } from '../store/index.js';

export default function IdleScreen() {
  const startDemo   = useInsuranceStore((s) => s.startDemo);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    startDemo();
  }, [startDemo]);

  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleFileChange = useCallback(() => { startDemo(); }, [startDemo]);
  const handleZoneClick  = () => { fileInputRef.current?.click(); };

  return (
    <div className="h-full w-full relative overflow-y-auto overflow-x-hidden">

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl w-full mx-auto px-8 py-8">

        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
              <Shield className="w-5 h-5" style={{ color: '#7c3aed' }} />
            </div>
            <span className="text-sm font-mono uppercase tracking-[0.25em] font-semibold"
              style={{ color: '#7c3aed' }}>
              Memo Layer
            </span>
          </div>

          <h1 className="font-['DM_Serif_Display'] text-5xl mb-3 leading-tight"
            style={{ color: '#1e1b4b' }}>
            Build an underwriting memo
            <br />
            <span style={{ color: '#7c3aed', fontStyle: 'italic' }}>in 90 seconds.</span>
          </h1>

          <p className="text-lg leading-relaxed max-w-xl mx-auto"
            style={{ color: '#374151' }}>
            Drop your ACORD forms, loss runs, and supplemental questionnaire —
            I'll deliver every risk flag, every ratio, and a full binding recommendation.
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
            className="relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300"
            style={{
              borderColor: dragOver ? '#7c3aed' : '#c4b5fd',
              background: dragOver ? '#ede9fe' : 'rgba(255,255,255,0.7)',
              transform: dragOver ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300"
                style={{ background: dragOver ? '#ddd6fe' : '#f3f0ff' }}>
                <Upload className="w-7 h-7 transition-colors" style={{ color: dragOver ? '#7c3aed' : '#a78bfa' }} />
              </div>

              <div>
                <p className="text-xl font-semibold mb-1" style={{ color: '#1e1b4b' }}>
                  Drop your submission packet here
                </p>
                <p className="text-base" style={{ color: '#6b7280' }}>
                  ACORD 125 · ACORD 126 · ACORD 140 · Loss Runs · Supplemental Q
                </p>
              </div>

              {/* Document type badges */}
              <div className="flex flex-wrap justify-center gap-2">
                {['ACORD 125', 'ACORD 126', 'ACORD 140', 'Loss Run (5yr)', 'Supplemental Q', 'Financial Stmts'].map((label) => (
                  <span key={label} className="px-3 py-1 text-sm rounded-full font-medium"
                    style={{ background: '#f3f0ff', border: '1px solid #c4b5fd', color: '#5b21b6' }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* OR divider + demo button */}
        <motion.div
          className="w-full flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px" style={{ background: '#e9d5ff' }} />
            <span className="text-base font-mono" style={{ color: '#9ca3af' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#e9d5ff' }} />
          </div>

          <button
            onClick={startDemo}
            className="group relative px-10 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff',
              boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
            }}
          >
            <span className="relative z-10 flex items-center gap-3">
              <FileText className="w-5 h-5" />
              Use demo packet — Apex Precision Manufacturing
            </span>
          </button>

          <p className="text-sm font-mono tracking-wide" style={{ color: '#9ca3af' }}>
            ISO 3580 · Columbus, OH · TIV $8.5M · 90-second demo
          </p>
        </motion.div>
      </div>
    </div>
  );
}
