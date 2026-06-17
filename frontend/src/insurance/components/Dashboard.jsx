import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { Building2, TrendingDown, MapPin, DollarSign, ClipboardCheck, ShieldCheck, AlertTriangle, X, Maximize2 } from 'lucide-react';
import { useInsuranceStore } from '../store/index.js';
import ExplainPanel from './ExplainPanel.jsx';

export default function Dashboard() {
  const tiles          = useInsuranceStore((s) => s.tiles);
  const activeScenario = useInsuranceStore((s) => s.activeScenario);
  const displayLR        = activeScenario?.newLossRatio ?? tiles.lossRatio?.lr;
  const displayRiskCount = activeScenario?.newRiskCount ?? tiles.risks?.length;
  const [explainKey, setExplainKey]   = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);

  function openExpand(key, hasData) {
    if (hasData) setExpandedKey(key);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-purple-700">Live Dashboard</span>
        {expandedKey == null && (
          <span className="ml-2 text-[10px] text-slate-400 font-mono">click any tile to expand</span>
        )}
      </div>

      {/* 2 rows × 3 cols */}
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-3 min-h-0">
        <LossRatioTile  data={tiles.lossRatio}  activeLR={displayLR}           onExplain={() => setExplainKey('lossRatio')} onExpand={() => openExpand('lossRatio', !!tiles.lossRatio)} />
        <CatPmlTile     data={tiles.catPml}     activeScenario={activeScenario} onExplain={() => setExplainKey('catPml')}    onExpand={() => openExpand('catPml', !!tiles.catPml)} />
        <PremiumTile    data={tiles.premium}                                    onExplain={() => setExplainKey('premium')}   onExpand={() => openExpand('premium', !!tiles.premium)} />
        <IsoClassTile   data={tiles.isoClass}                                   onExplain={() => setExplainKey('isoClass')}  onExpand={() => openExpand('isoClass', !!tiles.isoClass)} />
        <ComplianceTile data={tiles.compliance}                                 onExplain={() => setExplainKey('compliance')} onExpand={() => openExpand('compliance', !!tiles.compliance)} />
        <InsuredTile    data={tiles.insured}                                    onExplain={() => setExplainKey('insured')}   onExpand={() => openExpand('insured', !!tiles.insured)} />
      </div>

      {/* Risk flags */}
      <div className="flex-shrink-0 mt-3">
        <RiskFlagsTile risks={tiles.risks} activeRiskCount={displayRiskCount} onExplain={() => setExplainKey('risks')} onExpand={() => openExpand('risks', tiles.risks?.length > 0)} />
      </div>

      {/* Expanded tile modal */}
      {createPortal(
        <AnimatePresence>
          {expandedKey && (
            <ExpandedModal
              tileKey={expandedKey}
              tiles={tiles}
              activeScenario={activeScenario}
              displayLR={displayLR}
              displayRiskCount={displayRiskCount}
              onClose={() => setExpandedKey(null)}
              onExplain={(k) => { setExpandedKey(null); setTimeout(() => setExplainKey(k), 200); }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Explain panel */}
      {createPortal(
        <AnimatePresence>
          {explainKey && <ExplainPanel tileKey={explainKey} onClose={() => setExplainKey(null)} />}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// ── Expanded Modal ─────────────────────────────────────────────────────────────
function ExpandedModal({ tileKey, tiles, activeScenario, displayLR, displayRiskCount, onClose, onExplain }) {
  const configs = {
    lossRatio:  { label: 'Loss Ratio',         accent: '#16a34a' },
    catPml:     { label: 'Cat PML',             accent: '#3b82f6' },
    premium:    { label: 'Indicated Premium',   accent: '#f59e0b' },
    isoClass:   { label: 'ISO Class',           accent: '#7c3aed' },
    compliance: { label: 'Compliance',          accent: '#16a34a' },
    insured:    { label: 'Insured Profile',     accent: '#06b6d4' },
    risks:      { label: 'Risk Flags',          accent: '#f59e0b' },
  };
  const cfg = configs[tileKey] || { label: tileKey, accent: '#7c3aed' };

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(30,10,60,0.45)', backdropFilter: 'blur(6px)' }} />

      {/* Panel */}
      <motion.div
        className="relative rounded-2xl overflow-hidden flex flex-col"
        style={{
          width: 520, maxHeight: '85vh',
          background: '#fff', border: `1.5px solid ${cfg.accent}40`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px ${cfg.accent}20`,
        }}
        initial={{ scale: 0.88, y: 20, opacity: 0 }}
        animate={{ scale: 1,    y: 0,  opacity: 1 }}
        exit={{    scale: 0.92, y: 12, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${cfg.accent}20`, background: cfg.accent + '08' }}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.accent }} />
            <span className="font-bold text-sm" style={{ color: cfg.accent }}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onExplain(tileKey)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{ background: cfg.accent + '15', border: `1px solid ${cfg.accent}40`, color: cfg.accent }}>
              View AI Reasoning
            </button>
            <button onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6">
          <ExpandedContent
            tileKey={tileKey}
            tiles={tiles}
            activeScenario={activeScenario}
            displayLR={displayLR}
            displayRiskCount={displayRiskCount}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ExpandedContent({ tileKey, tiles, activeScenario, displayLR, displayRiskCount }) {
  if (tileKey === 'lossRatio') return <ExpandedLossRatio data={tiles.lossRatio} activeLR={displayLR} />;
  if (tileKey === 'catPml')    return <ExpandedCatPml    data={tiles.catPml}    activeScenario={activeScenario} />;
  if (tileKey === 'premium')   return <ExpandedPremium   data={tiles.premium} />;
  if (tileKey === 'isoClass')  return <ExpandedIsoClass  data={tiles.isoClass} />;
  if (tileKey === 'compliance')return <ExpandedCompliance data={tiles.compliance} />;
  if (tileKey === 'insured')   return <ExpandedInsured   data={tiles.insured} />;
  if (tileKey === 'risks')     return <ExpandedRisks     risks={tiles.risks} activeRiskCount={displayRiskCount} />;
  return null;
}

// ── Expanded: Loss Ratio ───────────────────────────────────────────────────────
function ExpandedLossRatio({ data, activeLR }) {
  if (!data) return null;
  const lr = activeLR ?? data.lr;
  const lrColor = lr <= 0.45 ? '#16a34a' : lr <= 0.60 ? '#d97706' : '#dc2626';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div className="font-bold font-mono" style={{ fontSize: '4rem', color: lrColor, lineHeight: 1 }}>
          <CountUp end={lr} decimals={2} duration={0.8} />
        </div>
        <div className="mb-2">
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Loss Ratio</div>
          <div className="font-semibold" style={{ fontSize: '13px', color: '#16a34a' }}>
            {Math.round((1 - lr / data.median) * 100)}% below industry median
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <LRBarLarge lr={lr} median={data.median} floor={data.floor} />
        <div className="flex justify-between text-xs font-mono" style={{ color: '#6b7280' }}>
          <span>0.00</span>
          <span style={{ color: '#d97706' }}>Median {data.median}</span>
          <span style={{ color: '#ef4444' }}>Floor {data.floor}</span>
          <span>1.00</span>
        </div>
      </div>

      <Sparkline color="#16a34a" height={60} />

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Total Claims" val={data.totalClaims}  color="#16a34a" />
        <StatBox label="Total Incurred" val={`$${(data.totalIncurred/1000).toFixed(0)}K`} color="#374151" />
        <StatBox label="vs Industry" val={`-${Math.round((1-lr/data.median)*100)}%`} color="#16a34a" />
      </div>

      <SectionTitle>Claim History</SectionTitle>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              {['Year','Type','Incurred','Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-semibold" style={{ fontSize: '11px', color: '#6b7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid #f3f4f6' }}>
              <td className="px-3 py-2 font-mono" style={{ fontSize: '12px' }}>2022</td>
              <td className="px-3 py-2" style={{ fontSize: '12px' }}>Equipment Breakdown</td>
              <td className="px-3 py-2 font-mono" style={{ fontSize: '12px' }}>$47,200</td>
              <td className="px-3 py-2"><Badge label="Closed" color="#16a34a" bg="#dcfce7" /></td>
            </tr>
            <tr style={{ borderTop: '1px solid #f3f4f6' }}>
              <td className="px-3 py-2 font-mono" style={{ fontSize: '12px' }}>2019</td>
              <td className="px-3 py-2" style={{ fontSize: '12px' }}>GL Premises Slip/Fall</td>
              <td className="px-3 py-2 font-mono" style={{ fontSize: '12px' }}>$23,100</td>
              <td className="px-3 py-2"><Badge label="Closed" color="#16a34a" bg="#dcfce7" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Expanded: Cat PML ──────────────────────────────────────────────────────────
function ExpandedCatPml({ data, activeScenario }) {
  if (!data) return null;
  const pmlPct = activeScenario?.pmlPct ?? data.pmlPct;
  const pml    = activeScenario?.pml    ?? data.pml;
  const pmlColor = pmlPct < 30 ? '#2563eb' : pmlPct < 50 ? '#d97706' : '#dc2626';
  const treatyPct = Math.round((pml / data.treaty) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div className="font-bold font-mono" style={{ fontSize: '4rem', color: pmlColor, lineHeight: 1 }}>
          <CountUp end={pmlPct} decimals={1} duration={0.8} />%
        </div>
        <div className="mb-2">
          <div style={{ fontSize: '13px', color: '#6b7280' }}>of TIV · 1-in-100yr PML</div>
          <div className="font-semibold" style={{ fontSize: '13px', color: pmlColor }}>
            ${(pml/1000000).toFixed(1)}M absolute
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: 4 }}>Wind Zone</div>
          <div className="font-bold font-mono" style={{ fontSize: '1.8rem', color: '#2563eb' }}>Zone {data.windZone}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Moderate risk</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: 4 }}>Flood Zone</div>
          <div className="font-bold font-mono" style={{ fontSize: '1.8rem', color: '#16a34a' }}>Zone {data.floodZone}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Minimal flood risk</div>
        </div>
      </div>

      <SectionTitle>Treaty Capacity</SectionTitle>
      <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div className="flex justify-between mb-2" style={{ fontSize: '12px', color: '#6b7280' }}>
          <span>PML ${(pml/1000000).toFixed(1)}M</span>
          <span>Treaty ${(data.treaty/1000000).toFixed(0)}M limit</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#3b82f6,#60a5fa)' }}
            initial={{ width: 0 }} animate={{ width: `${treatyPct}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
        </div>
        <div className="mt-2 flex justify-between" style={{ fontSize: '11px' }}>
          <span style={{ color: '#2563eb', fontWeight: 600 }}>{treatyPct}% of treaty used</span>
          <span style={{ color: '#16a34a' }}>Within capacity</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Seismic Risk" val="Low"  color="#16a34a" />
        <StatBox label="TIV"  val={`$${(data.tiv/1000000).toFixed(1)}M`}  color="#374151" />
        <StatBox label="Treaty Attach." val={`$${(data.treaty/1000000).toFixed(0)}M`} color="#374151" />
      </div>
    </div>
  );
}

// ── Expanded: Premium ──────────────────────────────────────────────────────────
function ExpandedPremium({ data }) {
  if (!data) return null;
  const variance = (((data.total - data.requested) / data.requested) * 100).toFixed(1);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div className="font-bold font-mono" style={{ fontSize: '4rem', color: '#d97706', lineHeight: 1 }}>
          $<CountUp end={data.total / 1000} decimals={0} duration={0.8} />K
        </div>
        <div className="mb-2">
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Indicated Premium</div>
          <div className="font-semibold" style={{ fontSize: '13px', color: '#d97706' }}>
            +{variance}% vs ${(data.requested/1000).toFixed(0)}K requested
          </div>
        </div>
      </div>

      <SectionTitle>Premium Breakdown</SectionTitle>
      <div className="flex flex-col gap-2">
        {[
          { label: 'Commercial Property', val: data.property, color: '#f59e0b' },
          { label: 'General Liability',   val: data.gl,       color: '#3b82f6' },
          { label: 'Inland Marine',       val: data.im,       color: '#8b5cf6' },
          { label: 'Fees & Endorsements', val: data.fees,     color: '#6b7280' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="flex justify-between" style={{ fontSize: '12px' }}>
              <span style={{ color: '#374151' }}>{label}</span>
              <span className="font-mono font-semibold" style={{ color }}>${val.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${(val / data.total) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 flex justify-between items-center" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#92400e' }}>Total Indicated</div>
          <div className="font-bold font-mono" style={{ fontSize: '1.6rem', color: '#d97706' }}>${data.total.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: '11px', color: '#92400e' }}>Requested</div>
          <div className="font-bold font-mono" style={{ fontSize: '1.6rem', color: '#374151' }}>${data.requested.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: '11px', color: '#92400e' }}>Variance</div>
          <div className="font-bold font-mono" style={{ fontSize: '1.6rem', color: '#d97706' }}>+{variance}%</div>
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', color: '#374151' }}>
        Coinsurance 80% check: <span className="font-bold text-green-700">PASS</span> — TIV $8.5M &gt; 80% of RC $8.2M ($6.56M minimum)
      </div>
    </div>
  );
}

// ── Expanded: ISO Class ────────────────────────────────────────────────────────
function ExpandedIsoClass({ data }) {
  if (!data) return null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <div className="font-bold font-mono" style={{ fontSize: '4rem', color: '#5b21b6', lineHeight: 1 }}>{data.code}</div>
        <div className="mb-2">
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{data.description}</div>
          <span className="px-2 py-0.5 rounded-full font-medium mt-1 inline-block"
            style={{ fontSize: '11px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
            Preferred Class
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Rate Factor"  val={data.rateFactor}  color="#7c3aed" />
        <StatBox label="Base Rate"    val={data.baseRate}    color="#374151" />
        <StatBox label="Risk Score"   val={`${data.riskScore}/100`} color="#374151" />
      </div>

      <SectionTitle>D&B Financial Profile</SectionTitle>
      <div className="rounded-xl p-4 flex gap-6" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>D&B Score</div>
          <div className="font-bold font-mono" style={{ fontSize: '2.2rem', color: '#5b21b6' }}>{data.dnbScore}</div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Good standing</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>D&B Rating</div>
          <div className="font-bold font-mono" style={{ fontSize: '2.2rem', color: '#5b21b6' }}>{data.dnbRating}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Financial strength</div>
        </div>
      </div>

      <SectionTitle>ISO Rating Calculation</SectionTitle>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
        {[
          ['ISO Base Rate', `${data.baseRate} per $ TIV`],
          ['Sprinkler Credit Factor', data.rateFactor],
          ['Applied TIV', '$8,500,000'],
          ['Computed Property Premium', '$68,400'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #f3f4f6', fontSize: '12px' }}>
            <span style={{ color: '#6b7280' }}>{k}</span>
            <span className="font-mono font-semibold" style={{ color: '#111827' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Expanded: Compliance ───────────────────────────────────────────────────────
function ExpandedCompliance({ data }) {
  if (!data) return null;
  const allOk = data.ohDoi && data.serff && data.ofac;
  const r = 44, circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-6">
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 104, height: 104 }}>
          <svg width="104" height="104" className="absolute">
            <circle cx="52" cy="52" r={r} fill="none" stroke="#ede9fe" strokeWidth="6" />
            <motion.circle cx="52" cy="52" r={r} fill="none" stroke={allOk ? '#16a34a' : '#e11d48'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: allOk ? 0 : circ * 0.3 }}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
              style={{ transformOrigin: '52px 52px', rotate: '-90deg' }}
            />
          </svg>
          <ShieldCheck className="w-10 h-10" style={{ color: allOk ? '#16a34a' : '#e11d48', zIndex: 1 }} />
        </div>
        <div>
          <div className="font-bold" style={{ fontSize: '1.4rem', color: allOk ? '#16a34a' : '#e11d48' }}>
            {allOk ? 'All Clear' : 'Review Required'}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>All compliance checks passed</div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: 4 }}>State: {data.state} | Form: {data.form}</div>
        </div>
      </div>

      <SectionTitle>Compliance Checks</SectionTitle>
      <div className="flex flex-col gap-3">
        {[
          { label: `${data.state} DOI — Admitted Market`,  ok: data.ohDoi, detail: 'ISO CP 00 10 approved for admitted market use in OH' },
          { label: `Form: ${data.form}`,                    ok: data.serff, detail: 'SERFF filing current, no pending amendments' },
          { label: 'SERFF Filing — Current',               ok: data.serff, detail: 'Filing approved, no regulatory holds' },
          { label: 'OFAC SDN Screening — CLEAR',           ok: data.ofac,  detail: 'Apex Precision Manufacturing LLC — CLEAR | David Chen, CEO — CLEAR' },
        ].map(({ label, ok, detail }) => (
          <div key={label} className="flex items-start gap-3 rounded-xl p-3"
            style={{ background: ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}` }}>
            <div className="flex-shrink-0 rounded-full flex items-center justify-center mt-0.5"
              style={{ width: 20, height: 20, background: ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${ok ? '#86efac' : '#fca5a5'}` }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: ok ? '#16a34a' : '#dc2626' }}>{ok ? '✓' : '✗'}</span>
            </div>
            <div>
              <div className="font-semibold" style={{ fontSize: '12px', color: ok ? '#166534' : '#991b1b' }}>{label}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 2 }}>{detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Expanded: Insured ──────────────────────────────────────────────────────────
function ExpandedInsured({ data }) {
  if (!data) return null;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="font-bold" style={{ fontSize: '1.6rem', color: '#111827', lineHeight: 1.2 }}>{data.name}</div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: 4 }}>{data.principal}, {data.title}</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Years in Business" val={`${data.years} yrs`}    color="#065f46" />
        <StatBox label="Employees"         val={data.employees}          color="#374151" />
        <StatBox label="ISO Class"         val={data.isoClass}            color="#1d4ed8" />
      </div>

      <SectionTitle>Location</SectionTitle>
      <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: '#0284c7' }} />
        <div>
          <div className="font-semibold" style={{ fontSize: '13px', color: '#0c4a6e' }}>{data.city}, {data.state} (Primary)</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>NAICS: {data.naics}</div>
        </div>
      </div>

      <SectionTitle>Classification</SectionTitle>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
        {[
          ['NAICS Code',        data.naics],
          ['ISO Class',         data.isoClass],
          ['Principal',         `${data.principal}, ${data.title}`],
          ['Years in Business', `${data.years} years`],
          ['Employees',         data.employees],
          ['Primary Location',  `${data.city}, ${data.state}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #f3f4f6', fontSize: '12px' }}>
            <span style={{ color: '#6b7280' }}>{k}</span>
            <span className="font-mono font-semibold" style={{ color: '#111827' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Expanded: Risk Flags ───────────────────────────────────────────────────────
function ExpandedRisks({ risks, activeRiskCount }) {
  if (!risks?.length) return null;
  const count = activeRiskCount ?? risks.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" style={{ color: '#f59e0b' }} />
        <div>
          <div className="font-bold" style={{ fontSize: '1.2rem', color: '#92400e' }}>{count} Amber Risk Flags</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>All manageable with binding conditions</div>
        </div>
      </div>

      {risks.map((risk, i) => (
        <motion.div key={risk.id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid #fde68a' }}>
          <div className="px-4 py-3 flex items-start gap-3" style={{ background: '#fffbeb' }}>
            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse" style={{ background: '#f59e0b' }} />
            <div className="flex-1">
              <div className="font-semibold" style={{ fontSize: '13px', color: '#92400e' }}>{risk.title}</div>
              <div style={{ fontSize: '12px', color: '#78350f', marginTop: 2 }}>{risk.finding}</div>
            </div>
            <span className="font-mono font-bold flex-shrink-0" style={{ fontSize: '13px', color: '#d97706' }}>{risk.confidence}%</span>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2" style={{ background: '#fff', borderTop: '1px solid #fde68a' }}>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              <span className="font-semibold">Source:</span> {risk.source}
            </div>
            <div className="rounded-lg p-2" style={{ background: '#f0fdf4', fontSize: '11px', color: '#166534' }}>
              <span className="font-semibold">Mitigant: </span>{risk.mitigant}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Shared Tile shell ──────────────────────────────────────────────────────────
function Tile({ children, populated, accentColor = '#7c3aed', onExplain, onExpand }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer group"
      style={{ background: '#fff', border: '1px solid #ede9fe', boxShadow: '0 1px 8px rgba(109,40,217,0.07)', transition: 'box-shadow 0.15s, transform 0.15s' }}
      onClick={onExpand}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}25`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 8px rgba(109,40,217,0.07)'; e.currentTarget.style.transform = 'none'; }}
    >
      {!populated ? <SkeletonTile accentColor={accentColor} /> : (
        <>
          <motion.div className="h-full w-full flex flex-col"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
            {children}
          </motion.div>

          {/* Expand hint icon — top-right */}
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: accentColor + '20', border: `1px solid ${accentColor}40` }}>
              <Maximize2 className="w-2.5 h-2.5" style={{ color: accentColor }} />
            </div>
          </div>

          {/* Explain button — bottom-right, stop propagation so it doesn't open expand */}
          <button
            onClick={e => { e.stopPropagation(); onExplain(); }}
            className="absolute bottom-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center font-bold transition-all"
            style={{ fontSize: '10px', background: accentColor + '15', border: `1px solid ${accentColor}40`, color: accentColor }}>
            i
          </button>
        </>
      )}
    </div>
  );
}

function SkeletonTile({ accentColor = '#7c3aed' }) {
  return (
    <div className="h-full w-full p-4 flex flex-col gap-3">
      <div className="h-2 w-14 rounded-full animate-pulse" style={{ background: accentColor + '30' }} />
      <div className="h-9 w-20 rounded-lg animate-pulse" style={{ background: accentColor + '15' }} />
      <div className="h-1.5 w-full rounded-full bg-slate-100 animate-pulse" />
      <div className="h-1.5 w-2/3 rounded-full bg-slate-100 animate-pulse" />
    </div>
  );
}

// ── Mini sparkline SVG ─────────────────────────────────────────────────────────
function Sparkline({ color = '#16a34a', filled = true, height = 36 }) {
  const points = [18, 14, 16, 10, 13, 8, 11, 9, 12, 7, 10, 8];
  const max = Math.max(...points), min = Math.min(...points);
  const w = 100, h = height;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map(p => h - ((p - min) / (max - min || 1)) * (h - 4) - 2);
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const fillD = pathD + ` L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {filled && <path d={fillD} fill={color} fillOpacity="0.12" />}
      <path d={pathD} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ highlighted = 8 }) {
  const bars = [3, 5, 4, 7, 6, 8, 5, 9, 7, 10, 8, 11, 9];
  const max = Math.max(...bars);
  return (
    <div className="flex items-end gap-[2px] w-full" style={{ height: '44px' }}>
      {bars.map((b, i) => (
        <motion.div key={i} className="flex-1 rounded-sm"
          style={{ background: i === highlighted ? '#f59e0b' : '#f59e0b30' }}
          initial={{ height: 0 }}
          animate={{ height: `${(b / max) * 100}%` }}
          transition={{ duration: 0.5, delay: i * 0.03, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ── Dot wave (Cat PML) ─────────────────────────────────────────────────────────
function DotWave({ color = '#3b82f6' }) {
  const wave = [0.2, 0.5, 0.8, 1, 0.8, 0.6, 0.4, 0.6, 0.8, 0.5, 0.3, 0.2];
  return (
    <div className="flex flex-col gap-[3px] w-full">
      {Array.from({ length: 4 }).map((_, r) => (
        <div key={r} className="flex gap-[3px]">
          {wave.map((w, c) => (
            <div key={c} className="rounded-full flex-1" style={{
              height: '4px', background: color,
              opacity: Math.max(0.08, w - r * 0.18),
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Animated shield ring (Compliance compact) ──────────────────────────────────
function ShieldRing({ ok }) {
  const r = 28, circ = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" className="absolute">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#ede9fe" strokeWidth="4" />
        <motion.circle cx="36" cy="36" r={r} fill="none" stroke={ok ? '#16a34a' : '#e11d48'}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: ok ? 0 : circ * 0.3 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{ transformOrigin: '36px 36px', rotate: '-90deg' }}
        />
      </svg>
      <ShieldCheck className="w-7 h-7" style={{ color: ok ? '#16a34a' : '#e11d48', zIndex: 1 }} />
    </div>
  );
}

// ── LR bar (compact) ───────────────────────────────────────────────────────────
function LRBar({ lr, median, floor }) {
  if (!lr) return null;
  const pct       = Math.min((lr / 1.0) * 100, 100);
  const medianPct = (median / 1.0) * 100;
  const floorPct  = (floor  / 1.0) * 100;
  return (
    <div className="relative h-1.5 bg-slate-100 rounded-full">
      <motion.div className="absolute top-0 left-0 h-full rounded-full"
        style={{ background: 'linear-gradient(90deg,#16a34a,#4ade80)' }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-amber-400 rounded-full" style={{ left: `${medianPct}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full" style={{ left: `${floorPct}%`, background: '#f87171' }} />
    </div>
  );
}

// ── LR bar (large, for expanded) ───────────────────────────────────────────────
function LRBarLarge({ lr, median, floor }) {
  const pct       = Math.min((lr / 1.0) * 100, 100);
  const medianPct = (median / 1.0) * 100;
  const floorPct  = (floor  / 1.0) * 100;
  return (
    <div className="relative h-3 bg-white rounded-full">
      <motion.div className="absolute top-0 left-0 h-full rounded-full"
        style={{ background: 'linear-gradient(90deg,#16a34a,#4ade80)' }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-400 rounded-full -ml-0.5" style={{ left: `${medianPct}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full -ml-0.5" style={{ left: `${floorPct}%`, background: '#f87171' }} />
    </div>
  );
}

// ── Row helper ─────────────────────────────────────────────────────────────────
function Row({ label, val, valColor = '#111827' }) {
  return (
    <div className="flex justify-between items-center" style={{ fontSize: '11px' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span className="font-semibold" style={{ color: valColor }}>{val}</span>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function StatBox({ label, val, color = '#374151' }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
      <div className="font-bold font-mono" style={{ fontSize: '1.2rem', color }}>{val}</div>
      <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="font-semibold text-xs uppercase tracking-widest" style={{ color: '#9ca3af' }}>{children}</div>;
}

function Badge({ label, color, bg }) {
  return (
    <span className="px-2 py-0.5 rounded-full font-medium"
      style={{ fontSize: '10px', background: bg, color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  );
}

// ── Tile 1: Loss Ratio ─────────────────────────────────────────────────────────
function LossRatioTile({ data, activeLR, onExplain, onExpand }) {
  const lr = activeLR ?? data?.lr;
  const lrColor = !lr ? '#9ca3af' : lr <= 0.45 ? '#16a34a' : lr <= 0.60 ? '#d97706' : '#dc2626';

  return (
    <Tile populated={!!data} accentColor="#16a34a" onExplain={onExplain} onExpand={onExpand}>
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3 h-3" style={{ color: '#16a34a' }} />
            <span className="font-mono uppercase tracking-wider" style={{ fontSize: '10px', color: '#16a34a' }}>Loss Ratio</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={lr} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="font-bold font-mono leading-none" style={{ fontSize: '2.4rem', color: lrColor }}>
              {lr ? <CountUp end={lr} decimals={2} duration={0.8} /> : '—'}
            </motion.div>
          </AnimatePresence>
          <div className="mt-0.5" style={{ fontSize: '11px', color: '#6b7280' }}>
            vs <span style={{ color: '#d97706', fontWeight: 600 }}>{data.median}</span> median
          </div>
          <div className="mt-1.5">
            <LRBar lr={lr} median={data.median} floor={data.floor} />
          </div>
          <div className="mt-1.5 flex-1 min-h-0">
            <Sparkline color="#16a34a" />
          </div>
          <div className="mt-1 font-mono" style={{ fontSize: '10px', color: '#9ca3af' }}>
            {data.totalClaims} claims · ${(data.totalIncurred / 1000).toFixed(0)}K / 5yr
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 2: Cat PML ────────────────────────────────────────────────────────────
function CatPmlTile({ data, activeScenario, onExplain, onExpand }) {
  const pmlPct = activeScenario?.pmlPct ?? data?.pmlPct;
  const pml    = activeScenario?.pml    ?? data?.pml;
  const pmlColor = !pmlPct ? '#9ca3af' : pmlPct < 30 ? '#2563eb' : pmlPct < 50 ? '#d97706' : '#dc2626';

  return (
    <Tile populated={!!data} accentColor="#3b82f6" onExplain={onExplain} onExpand={onExpand}>
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3 h-3" style={{ color: '#3b82f6' }} />
            <span className="font-mono uppercase tracking-wider" style={{ fontSize: '10px', color: '#3b82f6' }}>Cat PML</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={pmlPct} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="font-bold font-mono leading-none" style={{ fontSize: '2.4rem', color: pmlColor }}>
              {pmlPct
                ? <><CountUp end={pmlPct} decimals={1} duration={0.8} /><span style={{ fontSize: '1.6rem' }}>%</span></>
                : '—'}
            </motion.div>
          </AnimatePresence>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>of TIV · 1-in-100yr</div>
          <div className="my-1.5">
            <DotWave color="#3b82f6" />
          </div>
          <div className="flex flex-col gap-1 mt-auto">
            <Row label="Wind Zone"  val={`Zone ${data.windZone}`}  valColor="#2563eb" />
            <Row label="Flood Zone" val={`Zone ${data.floodZone}`} valColor="#16a34a" />
            <Row label="PML $"      val={pml ? `$${(pml/1000000).toFixed(1)}M` : '—'} />
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 3: Indicated Premium ──────────────────────────────────────────────────
function PremiumTile({ data, onExplain, onExpand }) {
  return (
    <Tile populated={!!data} accentColor="#f59e0b" onExplain={onExplain} onExpand={onExpand}>
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3 h-3" style={{ color: '#f59e0b' }} />
            <span className="font-mono uppercase tracking-wider" style={{ fontSize: '10px', color: '#f59e0b' }}>Indicated Premium</span>
          </div>
          <div className="font-bold font-mono leading-none" style={{ fontSize: '2.4rem', color: '#d97706' }}>
            $<CountUp end={data.total / 1000} decimals={0} duration={0.8} />K
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            vs ${(data.requested / 1000).toFixed(0)}K requested
          </div>
          <div className="mt-1.5 flex-1 min-h-0">
            <MiniBarChart highlighted={8} />
          </div>
          <div className="flex flex-col gap-1 mt-1.5">
            <Row label="Property" val={`$${(data.property/1000).toFixed(0)}K`} />
            <Row label="GL"       val={`$${(data.gl/1000).toFixed(0)}K`} />
            <Row label="IM"       val={`$${(data.im/1000).toFixed(0)}K`} />
            <Row label="Fees"     val={`$${(data.fees/1000).toFixed(0)}K`} />
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 4: ISO Class ──────────────────────────────────────────────────────────
function IsoClassTile({ data, onExplain, onExpand }) {
  return (
    <Tile populated={!!data} accentColor="#7c3aed" onExplain={onExplain} onExpand={onExpand}>
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-1">
            <ClipboardCheck className="w-3 h-3" style={{ color: '#7c3aed' }} />
            <span className="font-mono uppercase tracking-wider" style={{ fontSize: '10px', color: '#7c3aed' }}>ISO Class</span>
          </div>
          <div className="font-bold font-mono leading-none" style={{ fontSize: '2.4rem', color: '#5b21b6' }}>{data.code}</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', lineHeight: 1.3 }}>{data.description}</div>
          <div className="mt-1.5">
            <span className="px-2 py-0.5 rounded-full font-medium" style={{
              fontSize: '10px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd'
            }}>Preferred</span>
          </div>
          <div className="flex flex-col gap-1 mt-auto pt-1.5" style={{ borderTop: '1px solid #f3f4f6' }}>
            <Row label="Rate factor" val={data.rateFactor}                        valColor="#7c3aed" />
            <Row label="D&B Score"   val={`${data.dnbScore} / ${data.dnbRating}`} valColor="#16a34a" />
            <Row label="Risk score"  val={`${data.riskScore}/100`}                valColor="#111827" />
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 5: Compliance ─────────────────────────────────────────────────────────
function ComplianceTile({ data, onExplain, onExpand }) {
  const allOk = data && data.ohDoi && data.serff && data.ofac;
  return (
    <Tile populated={!!data} accentColor="#16a34a" onExplain={onExplain} onExpand={onExpand}>
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3 h-3" style={{ color: '#16a34a' }} />
            <span className="font-mono uppercase tracking-wider" style={{ fontSize: '10px', color: '#16a34a' }}>Compliance</span>
          </div>
          <div className="flex justify-center my-1">
            <ShieldRing ok={allOk} />
          </div>
          <div className="flex flex-col gap-1.5">
            <CheckRow label={`${data.state} DOI: Admitted`} ok={data.ohDoi} />
            <CheckRow label={data.form}                     ok={data.serff} />
            <CheckRow label="SERFF Current"                 ok={data.serff} />
            <CheckRow label="OFAC SCN — CLEAR"              ok={data.ofac}  />
          </div>
        </div>
      )}
    </Tile>
  );
}

function CheckRow({ label, ok }) {
  return (
    <div className="flex items-center gap-2">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="flex-shrink-0 rounded-full flex items-center justify-center"
        style={{ width: 16, height: 16, background: ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${ok ? '#86efac' : '#fca5a5'}` }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: ok ? '#16a34a' : '#dc2626' }}>{ok ? '✓' : '✗'}</span>
      </motion.div>
      <span style={{ fontSize: '11px', color: '#374151' }}>{label}</span>
    </div>
  );
}

// ── Tile 6: Insured ────────────────────────────────────────────────────────────
function InsuredTile({ data, onExplain, onExpand }) {
  return (
    <Tile populated={!!data} accentColor="#06b6d4" onExplain={onExplain} onExpand={onExpand}>
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-1">
            <Building2 className="w-3 h-3" style={{ color: '#0891b2' }} />
            <span className="font-mono uppercase tracking-wider" style={{ fontSize: '10px', color: '#0891b2' }}>Insured</span>
          </div>
          <div className="font-bold leading-tight" style={{ fontSize: '14px', color: '#111827' }}>{data.name}</div>
          <div className="mt-1" style={{ fontSize: '11px', color: '#374151' }}>{data.principal}, {data.title}</div>
          <div className="font-mono mt-0.5" style={{ fontSize: '11px', color: '#6b7280' }}>{data.city}, {data.state}</div>
          <div className="font-mono mt-0.5" style={{ fontSize: '11px', color: '#6b7280' }}>NAICS: {data.naics}</div>
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5" style={{ borderTop: '1px solid #f3f4f6' }}>
            <Pill label={`${data.years}yrs`}      bg="#ecfdf5" color="#065f46" border="#6ee7b7" />
            <Pill label={`${data.employees} emp`} bg="#f8fafc" color="#475569" border="#cbd5e1" />
            <Pill label={`ISO ${data.isoClass}`}  bg="#eff6ff" color="#1d4ed8" border="#93c5fd" />
          </div>
        </div>
      )}
    </Tile>
  );
}

function Pill({ label, bg, color, border }) {
  return (
    <span className="px-2 py-0.5 rounded-full font-mono font-medium"
      style={{ fontSize: '10px', background: bg, color, border: `1px solid ${border}` }}>
      {label}
    </span>
  );
}

// ── Risk Flags ─────────────────────────────────────────────────────────────────
function RiskFlagsTile({ risks, activeRiskCount, onExplain, onExpand }) {
  const count     = activeRiskCount ?? risks?.length ?? 0;
  const populated = risks?.length > 0;

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all cursor-pointer group"
      style={{
        background: populated ? '#fff' : '#fafaf9',
        border: `1px solid ${populated ? '#fde68a' : '#e5e7eb'}`,
        boxShadow: populated ? '0 1px 8px rgba(251,191,36,0.10)' : 'none',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onClick={populated ? onExpand : undefined}
      onMouseEnter={e => { if (populated) { e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = populated ? '0 1px 8px rgba(251,191,36,0.10)' : 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {!populated ? (
        <div className="p-3 flex gap-3">
          <div className="h-2.5 w-20 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-2.5 w-36 rounded-full bg-slate-100 animate-pulse" />
        </div>
      ) : (
        <motion.div className="p-3" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            <span className="font-mono uppercase tracking-wider" style={{ fontSize: '10px', color: '#92400e' }}>Risk Flags</span>
            <span className="ml-auto font-mono font-bold" style={{ fontSize: '11px', color: '#d97706' }}>{count} amber</span>
            {/* Expand hint */}
            <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3 h-3" style={{ color: '#d97706' }} />
            </div>
            <button onClick={e => { e.stopPropagation(); onExplain(); }}
              className="ml-1 w-5 h-5 rounded-full flex items-center justify-center font-bold"
              style={{ fontSize: '10px', background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
              i
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {risks.map((risk, i) => (
                <motion.div key={risk.id}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.08 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#92400e' }}>{risk.title}</span>
                  <span className="font-mono" style={{ fontSize: '11px', color: '#d97706', marginLeft: '2px' }}>{risk.confidence}%</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
