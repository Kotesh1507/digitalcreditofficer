import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { User, CreditCard, TrendingUp, BarChart3, Shield, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/index.js';

export default function Dashboard() {
  const tiles = useStore((s) => s.tiles);
  const activeScenario = useStore((s) => s.activeScenario);

  const dscr = activeScenario ? activeScenario.newDscr : tiles.cashflow?.dscr;
  const riskCount = activeScenario ? activeScenario.newRiskCount : tiles.risks?.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-xs font-mono uppercase tracking-widest text-blue-400/70">
          Live Dashboard
        </span>
      </div>

      {/* 3×2 tile grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-3">
        <BorrowerTile data={tiles.borrower} />
        <CreditTile data={tiles.credit} />
        <IndustryTile data={tiles.industry} />
        <CashflowTile
          data={tiles.cashflow}
          activeDscr={dscr}
          dscrChanged={!!activeScenario}
        />
        <CollateralTile data={tiles.collateral} />
        <RiskFlagsTile risks={tiles.risks} activeRiskCount={riskCount} />
      </div>
    </div>
  );
}

// ── Tile wrapper ─────────────────────────────────────────────────────────────
function Tile({ children, populated, colorClass = 'border-white/10', className = '' }) {
  return (
    <div className={`relative rounded-xl border overflow-hidden ${colorClass} ${className}`}>
      {!populated ? (
        <SkeletonTile />
      ) : (
        <motion.div
          className="h-full w-full"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="h-full w-full p-3 flex flex-col gap-2">
      <div className="h-3 w-20 rounded skeleton" />
      <div className="h-6 w-16 rounded skeleton" />
      <div className="h-2 w-full rounded skeleton" />
      <div className="h-2 w-3/4 rounded skeleton" />
    </div>
  );
}

// ── Tile 1: Borrower Snapshot ─────────────────────────────────────────────────
function BorrowerTile({ data }) {
  return (
    <Tile populated={!!data} colorClass="border-teal-accent/20 bg-teal-accent/5">
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-3 h-3 text-teal-accent" />
            <span className="text-[10px] font-mono text-teal-accent/70 uppercase tracking-wider">Borrower</span>
          </div>
          <div className="font-semibold text-white text-sm leading-tight">{data.name}</div>
          <div className="text-slate-400 text-xs mt-1">{data.owner}</div>
          <div className="mt-auto flex items-center gap-3 pt-2 border-t border-white/5">
            <Pill label={`${data.years}yrs`} color="teal" />
            <Pill label={`${data.employees} emp`} color="slate" />
            {data.veteran && <Pill label="Veteran" color="amber" />}
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 2: Credit Profile ────────────────────────────────────────────────────
function CreditTile({ data }) {
  return (
    <Tile populated={!!data} colorClass="border-green-500/20 bg-green-500/5">
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-2">
            <CreditCard className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-mono text-green-400/70 uppercase tracking-wider">Credit</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-green-400 font-mono">
              <CountUp end={data.fico} duration={0.8} />
            </span>
            <span className="text-xs text-slate-500">FICO</span>
          </div>
          <div className="flex gap-3 mt-auto pt-2 border-t border-white/5">
            <MetricSmall label="PAYDEX" value={data.paydex} />
            <MetricSmall label="Intelliscore" value={data.intelliscore} />
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 3: Industry Outlook ──────────────────────────────────────────────────
function IndustryTile({ data }) {
  return (
    <Tile populated={!!data} colorClass="border-blue-400/20 bg-blue-400/5">
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-mono text-blue-400/70 uppercase tracking-wider">Industry</span>
          </div>
          <div className="text-xs text-slate-400 font-mono">NAICS {data.naics}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-2xl font-bold text-blue-300 font-mono">
              <CountUp end={data.cagr} decimals={1} duration={0.8} />%
            </span>
            <span className="text-[10px] text-slate-500">5yr CAGR</span>
          </div>
          <div className="mt-auto">
            <Pill label={data.outlook} color="blue" />
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 4: Cash Flow & DSCR (the hero tile) ──────────────────────────────────
function CashflowTile({ data, activeDscr, dscrChanged }) {
  const displayDscr = activeDscr ?? data?.dscr;
  const dscrColor = !displayDscr ? 'text-slate-500'
    : displayDscr >= 2.0 ? 'text-green-400'
    : displayDscr >= 1.25 ? 'text-amber-400'
    : 'text-red-400';

  return (
    <Tile populated={!!data} colorClass={`border-green-500/30 bg-green-500/5 col-span-2`} className="col-span-2">
      {data && (
        <div className="p-3 h-full">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-mono text-green-400/70 uppercase tracking-wider">Cash Flow & DSCR</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayDscr}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-4xl font-bold font-mono ${dscrColor}`}
                >
                  {displayDscr ? (
                    <CountUp end={displayDscr} decimals={2} duration={0.8} />
                  ) : '—'}
                  <span className="text-xl">x</span>
                </motion.div>
              </AnimatePresence>
              <div className="text-xs text-slate-500 mt-0.5">
                DSCR vs <span className="text-amber-400/80">1.25x</span> floor
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                ${(data.revenue / 1000000).toFixed(2)}M
              </div>
              <div className="text-xs text-slate-500">2024 Revenue</div>
              <div className="text-sm font-semibold text-white mt-1">
                ${(data.ebitda / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-slate-500">EBITDA</div>
            </div>
          </div>

          {/* DSCR bar */}
          <div className="mt-2">
            <DSCRBar dscr={displayDscr} />
          </div>
        </div>
      )}
    </Tile>
  );
}

function DSCRBar({ dscr }) {
  if (!dscr) return null;
  const max = 4;
  const pct = Math.min((dscr / max) * 100, 100);
  const floorPct = (1.25 / max) * 100;
  const sbaMinPct = (1.10 / max) * 100;

  return (
    <div className="relative h-2 bg-white/10 rounded-full overflow-visible">
      <motion.div
        className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Floor marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-amber-400"
        style={{ left: `${floorPct}%` }}
      />
      {/* SBA min marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-red-400/60"
        style={{ left: `${sbaMinPct}%` }}
      />
    </div>
  );
}

// ── Tile 5: Collateral ────────────────────────────────────────────────────────
function CollateralTile({ data }) {
  const coverageColor = !data ? 'text-slate-500'
    : data.coverage >= 1.5 ? 'text-green-400'
    : data.coverage >= 1.0 ? 'text-amber-400'
    : 'text-red-400';

  return (
    <Tile populated={!!data} colorClass="border-amber-400/20 bg-amber-400/5">
      {data && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">Collateral</span>
          </div>
          <div className={`text-3xl font-bold font-mono ${coverageColor}`}>
            <CountUp end={data.coverage} decimals={2} duration={0.8} />x
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Coverage ratio</div>
          <div className="mt-auto text-xs text-slate-400">
            $<CountUp end={data.total / 1000} suffix="K" duration={0.6} /> advance / $850K loan
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Tile 6: Risk Flags ────────────────────────────────────────────────────────
function RiskFlagsTile({ risks, activeRiskCount }) {
  const count = activeRiskCount ?? risks?.length ?? 0;
  const populated = risks?.length > 0;

  return (
    <Tile
      populated={populated}
      colorClass={`border-red-500/30 ${populated ? 'bg-red-500/5' : ''}`}
    >
      {populated && (
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">Risk Flags</span>
            <span className="ml-auto text-xs font-mono font-bold text-amber-400">
              {count}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
            <AnimatePresence>
              {risks.map((risk, i) => (
                <motion.div
                  key={risk.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                    delay: i * 0.1,
                  }}
                  className="flex items-center gap-2 p-1.5 rounded bg-amber-400/10 border border-amber-400/20 risk-pulse"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-[10px] text-amber-200 leading-tight">{risk.title}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Tile>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function Pill({ label, color }) {
  const colors = {
    teal: 'bg-teal-accent/10 text-teal-accent border-teal-accent/20',
    slate: 'bg-white/5 text-slate-400 border-white/10',
    amber: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
    blue: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
    green: 'bg-green-400/10 text-green-300 border-green-400/20',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${colors[color] || colors.slate}`}>
      {label}
    </span>
  );
}

function MetricSmall({ label, value }) {
  return (
    <div>
      <div className="text-sm font-bold text-white font-mono">{value}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  );
}
