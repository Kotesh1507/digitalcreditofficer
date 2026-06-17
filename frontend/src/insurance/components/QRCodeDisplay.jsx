import React from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink } from 'lucide-react';

const LEAD_CAPTURE_URL = import.meta.env.VITE_INSURANCE_LEAD_CAPTURE_URL
  || import.meta.env.VITE_LEAD_CAPTURE_URL
  || 'https://yourdomain.com/insurance-pilot';

export default function QRCodeDisplay() {
  return (
    <motion.div
      className="flex items-center gap-4 p-3 rounded-xl bg-teal-accent/5 border border-teal-accent/30"
      animate={{
        boxShadow: [
          '0 0 0 0 rgba(0,212,200,0.0)',
          '0 0 0 8px rgba(0,212,200,0.1)',
          '0 0 0 0 rgba(0,212,200,0.0)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="flex-shrink-0 bg-white rounded-lg p-1.5">
        <QRCodeSVG value={LEAD_CAPTURE_URL} size={72} level="M" fgColor="#0a1628" />
      </div>
      <div>
        <div className="text-sm font-semibold text-white mb-0.5">
          Run Memo Layer on your submission flow?
        </div>
        <div className="text-xs text-slate-400 mb-2">
          Scan to start a pilot conversation.
        </div>
        <div className="flex items-center gap-1 text-[10px] text-teal-accent/70 font-mono">
          <ExternalLink className="w-3 h-3" />
          {LEAD_CAPTURE_URL}
        </div>
      </div>
    </motion.div>
  );
}
