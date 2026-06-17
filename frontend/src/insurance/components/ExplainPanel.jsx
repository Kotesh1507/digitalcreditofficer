import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Cpu, Database, Brain, AlertTriangle, ChevronRight } from 'lucide-react';

/* ─── Explainability data — mirrors insured.json explainability section ─────── */
const EXPLAIN_DATA = {
  insured: {
    title: 'Insured Snapshot',
    sources: [
      { document: 'ACORD 125', pages: 'pp. 1–2', method: 'direct extraction', confidence: 98 },
    ],
    confidence: 98,
    confidenceLabel: 'Very high — direct extraction, no inference',
    reasoningChain: [
      'Direct field read from ACORD 125 — legal name, NAICS, ISO class, principal, location confirmed across pages 1 and 2.',
    ],
    sensitivity: 'N/A — direct extraction, no inference.',
  },
  lossRatio: {
    title: 'Loss Ratio',
    sources: [
      { document: '5-year loss run report', pages: 'p.1 Summary Table', method: 'computed', confidence: 96 },
      { document: 'Carrier premium records', pages: 'Policy 2021–2025', method: 'computed', confidence: 96 },
    ],
    confidence: 96,
    confidenceLabel: 'Very high — confirmed from loss run and carrier records',
    reasoningChain: [
      'Loss run p.1 summary: total incurred $70,300 over 5 years.',
      'Earned premium from carrier records (adapter): $167,400.',
      'Loss ratio = $70,300 / $167,400 = 0.420.',
      'ISO benchmark for NAICS 332710: 0.58 industry median LR.',
      '0.42 is 28% below median. No adverse multi-year trend detected.',
    ],
    sensitivity: 'If prior year losses develop >65%, LR exceeds 0.70 carrier floor. See stress test: Loss dev +30% adverse.',
  },
  catPml: {
    title: 'Cat PML',
    sources: [
      { document: 'Cat model proxy', pages: 'API query', method: 'api', confidence: 87 },
      { document: 'FEMA Flood Map Service', pages: 'API query', method: 'api', confidence: 95 },
    ],
    confidence: 87,
    confidenceLabel: 'High — cat model proxy cross-referenced with FEMA flood map',
    reasoningChain: [
      'Primary location Columbus OH geocoded: Lat 39.96, Long -82.99.',
      'FEMA flood map query: Zone X (minimal flood risk) confirmed.',
      'NOAA wind zone lookup: Zone 2 (moderate) for Franklin County OH.',
      'Cat proxy model: 1-in-100yr PML = $2,100,000 (24.7% of TIV $8.5M).',
      'PML $2.1M vs treaty attachment $5M — within capacity.',
    ],
    sensitivity: 'If wind zone reclassified to Zone 3, PML estimate increases to ~$3.2M (37.6% of TIV), still within treaty.',
  },
  premium: {
    title: 'Indicated Premium',
    sources: [
      { document: 'ISO CLM via adapter', pages: 'rule-based lookup', method: 'rule-based', confidence: 90 },
      { document: 'ACORD 140 property section', pages: 'direct', method: 'direct extraction', confidence: 96 },
    ],
    confidence: 90,
    confidenceLabel: 'High — computed from ISO base rate and verified TIV',
    reasoningChain: [
      'ISO base rate for Class 3580 sprinklered MNC: 0.00965 per dollar of TIV.',
      'Apply ISO rate factor 0.82 (sprinkler credit + construction credit).',
      'Property premium: 0.00965 × 0.82 × $8,500,000 = $67,183 rounded $68,400.',
      'GL premium: $41,200 per ISO GL tables for NAICS 332710, 187 employees.',
      'IM: $8,800 per scheduled equipment schedule. Fees/endorsements: $5,600.',
      'Total indicated: $68,400 + $41,200 + $8,800 + $5,600 = $124,000.',
    ],
    sensitivity: 'If TIV restated below $6.8M, coinsurance clause activates. See stress test: TIV understated −20%.',
  },
  isoClass: {
    title: 'ISO Classification',
    sources: [
      { document: 'ISO Commercial Lines Manual', pages: 'rule-based', method: 'rule-based', confidence: 94 },
      { document: 'ACORD 125 Section 4', pages: 'direct', method: 'direct extraction', confidence: 98 },
    ],
    confidence: 94,
    confidenceLabel: 'Very high — ISO class confirmed from ACORD occupancy declaration and CLM lookup',
    reasoningChain: [
      'ACORD 125 Section 4: occupancy = machine shop, metal fabrication.',
      'NAICS 332710 maps to ISO Class 3580 (Machine Shops — Sprinklered).',
      'ISO CLM confirms sprinkler credit applies: rate factor 0.82.',
      'FPC 4 confirmed — within ISO eligibility range for Class 3580.',
    ],
    sensitivity: 'If sprinkler system found non-compliant at inspection, class reverts to non-sprinklered 3580 and rate factor increases to 1.15.',
  },
  compliance: {
    title: 'Compliance',
    sources: [
      { document: 'Ohio DOI admitted market database', pages: 'API', method: 'api', confidence: 97 },
      { document: 'SERFF filing database', pages: 'API', method: 'api', confidence: 95 },
      { document: 'OFAC SDN list', pages: 'API', method: 'api', confidence: 99 },
    ],
    confidence: 97,
    confidenceLabel: 'Very high — all three compliance checks returned clean',
    reasoningChain: [
      'Ohio DOI: ISO CP 00 10 form approved for admitted market use in OH.',
      'SERFF: ISO CP 00 10 filing current, no pending amendments.',
      'OFAC SDN check: Apex Precision Manufacturing LLC — CLEAR.',
      'David Chen, CEO — CLEAR.',
    ],
    sensitivity: 'N/A — compliance checks are binary pass/fail. All passed.',
  },
  risks: {
    title: 'Risk Flags',
    sources: [
      { document: 'ACORD 125', pages: 'Section 4, page 3', method: 'direct extraction', confidence: 91 },
      { document: 'Supplemental questionnaire', pages: 'page 2, Q7, Q14–Q15', method: 'direct extraction', confidence: 88 },
      { document: '5-year loss run report', pages: 'Claim GL-2019-0047', method: 'direct extraction', confidence: 84 },
    ],
    confidence: 88,
    confidenceLabel: 'High — flags derived from direct document evidence with supporting ISO benchmarks',
    reasoningChain: [
      'Hot-work flag (91%): ACORD 125 p.3 declares daily welding. No hot work permit found in packet.',
      'Supplier concentration (88%): Supplemental Q14–Q15 shows 67% single-source steel. No backup identified.',
      'GL premises (84%): Loss run claim GL-2019-0047 — slip/fall $23,100 closed. No housekeeping checklist.',
    ],
    sensitivity: 'All three flags are amber (manageable). None escalate to red under base case assumptions.',
  },
};

/* ─── Method color coding ────────────────────────────────────────────────────── */
function methodStyle(method) {
  const m = (method || '').toLowerCase();
  if (m.includes('direct'))   return { bg: 'bg-green-500/15',  border: 'border-green-500/30',  text: 'text-green-400',  label: 'Direct' };
  if (m.includes('computed')) return { bg: 'bg-teal-500/15',   border: 'border-teal-500/30',   text: 'text-teal-accent', label: 'Computed' };
  if (m.includes('rule'))     return { bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   text: 'text-blue-400',   label: 'Rule-based' };
  if (m.includes('api'))      return { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', label: 'API query' };
  /* LLM inference — amber */
  return                         { bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  text: 'text-amber-400',  label: 'LLM inference' };
}

function confidenceColor(pct) {
  if (pct >= 85) return { bar: 'from-green-500 to-green-400', text: 'text-green-400' };
  if (pct >= 70) return { bar: 'from-amber-500 to-amber-400', text: 'text-amber-400' };
  return               { bar: 'from-red-500 to-red-400',   text: 'text-red-400' };
}

/* ─── Method icon ────────────────────────────────────────────────────────────── */
function MethodIcon({ method }) {
  const m = (method || '').toLowerCase();
  const cls = 'w-3 h-3';
  if (m.includes('direct'))   return <FileText className={cls} />;
  if (m.includes('computed')) return <Cpu className={cls} />;
  if (m.includes('rule'))     return <Database className={cls} />;
  if (m.includes('api'))      return <Database className={cls} />;
  return <Brain className={cls} />;
}

/* ─── Main panel ─────────────────────────────────────────────────────────────── */
export default function ExplainPanel({ tileKey, onClose }) {
  const explain = EXPLAIN_DATA[tileKey];
  const [visibleSteps, setVisibleSteps] = useState(0);

  /* Animate reasoning chain in — one step every 150ms */
  useEffect(() => {
    if (!explain) return;
    setVisibleSteps(0);
    const chain = explain.reasoningChain;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVisibleSteps(i);
      if (i >= chain.length) clearInterval(timer);
    }, 150);
    return () => clearInterval(timer);
  }, [tileKey, explain]);

  if (!explain) return null;

  const conf      = explain.confidence;
  const confStyle = confidenceColor(conf);

  return (
    <motion.div
      key={tileKey}
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="fixed top-0 bottom-0 right-0 z-50 flex flex-col"
      style={{ width: '420px', background: 'rgba(6,11,22,0.97)', borderLeft: '1px solid rgba(0,212,200,0.25)', boxShadow: '-8px 0 32px rgba(0,0,0,0.6)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-teal-accent/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-teal-accent/15 border border-teal-accent/30 flex items-center justify-center">
            <span className="text-[9px] font-bold text-teal-accent">?</span>
          </div>
          <span className="text-sm font-semibold text-white">How did I compute this?</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,212,200,0.2) transparent' }}>

        {/* Tile name */}
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-teal-accent/50">Tile</span>
          <div className="text-base font-semibold text-white mt-0.5">{explain.title}</div>
        </div>

        {/* ── Source documents ── */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Source Documents</span>
          </div>
          <div className="space-y-2">
            {explain.sources.map((src, i) => {
              const style = methodStyle(src.method);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${style.bg} ${style.border}`}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${style.text}`}>
                    <MethodIcon method={src.method} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 font-medium leading-tight">{src.document}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{src.pages}</div>
                  </div>
                  <div className={`flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${style.bg} ${style.border} ${style.text}`}>
                    <span>{style.label}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: 'Direct', ...methodStyle('direct extraction') },
              { label: 'Computed', ...methodStyle('computed') },
              { label: 'Rule-based', ...methodStyle('rule-based') },
              { label: 'API query', ...methodStyle('api') },
              { label: 'LLM inference', ...methodStyle('llm') },
            ].map((m) => (
              <span key={m.label} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${m.bg} ${m.border} ${m.text}`}>
                {m.label}
              </span>
            ))}
          </div>
        </section>

        {/* ── Confidence score ── */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-3.5 h-3.5 rounded-full border border-slate-500 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Confidence</span>
          </div>
          <div className={`text-3xl font-bold font-mono ${confStyle.text} mb-1`}>{conf}%</div>
          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${confStyle.bar}`}
              initial={{ width: 0 }}
              animate={{ width: `${conf}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
          <p className="text-xs text-slate-400 font-mono leading-relaxed">{explain.confidenceLabel}</p>
        </section>

        {/* ── Reasoning chain ── */}
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Reasoning Chain</span>
          </div>
          <div className="space-y-2">
            {explain.reasoningChain.map((step, i) => (
              <AnimatePresence key={i}>
                {i < visibleSteps && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2.5"
                  >
                    <div className="flex-shrink-0 mt-1 w-4 h-4 rounded-full bg-teal-accent/10 border border-teal-accent/20 flex items-center justify-center">
                      <span className="text-[8px] font-mono text-teal-accent">{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-300 font-mono leading-relaxed">{step}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
            {visibleSteps < explain.reasoningChain.length && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 mt-1 w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-teal-accent animate-pulse" />
                </div>
                <p className="text-sm text-slate-600 font-mono">thinking...</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Sensitivity ── */}
        {explain.sensitivity && explain.sensitivity !== 'N/A — direct extraction, no inference.' && (
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70" />
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Sensitivity</span>
            </div>
            <div className="p-3 rounded-lg border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <p className="text-xs text-amber-200/80 font-mono leading-relaxed">{explain.sensitivity}</p>
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-teal-accent/10">
        <p className="text-[10px] text-slate-600 font-mono text-center">
          All AI decisions carry full source citations · Meridian Commercial Insurance
        </p>
      </div>
    </motion.div>
  );
}
