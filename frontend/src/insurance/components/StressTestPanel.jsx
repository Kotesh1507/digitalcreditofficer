/**
 * Insurance Stress Test Panel — PRD Section 7
 * 3 stress tests: Cat 100yr wind, Loss dev +30%, TIV understated -20%
 * 3 Q&A chips:    Why bind?, Cat exposure detail?, What if chief underwriter?
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, TrendingUp, AlertOctagon, MessageSquare, Send } from 'lucide-react';
import { useInsuranceStore } from '../store/index.js';
import QRCodeDisplay from './QRCodeDisplay.jsx';

const SCENARIOS = [
  { id: 'cat-100yr',       label: 'Cat: 1-in-100yr wind', icon: Wind,          color: 'amber'  },
  { id: 'loss-dev-30pct',  label: 'Loss dev +30% adverse', icon: TrendingUp,   color: 'orange' },
  { id: 'tiv-understated', label: 'TIV understated −20%',  icon: AlertOctagon, color: 'red'    },
];

const QA_CHIPS = [
  { id: 'why_bind',         label: 'Why bind this risk?'      },
  { id: 'cat_exposure',     label: 'Cat exposure detail?'     },
  { id: 'chief_underwriter',label: "What if I'm chief underwriter?" },
];

export default function StressTestPanel() {
  const activeScenario  = useInsuranceStore((s) => s.activeScenario);
  const qaAnswer        = useInsuranceStore((s) => s.qaAnswer);
  const showQRHighlight = useInsuranceStore((s) => s.showQRHighlight);
  const runScenario     = useInsuranceStore((s) => s.runScenario);
  const askQA           = useInsuranceStore((s) => s.askQA);
  const askFreeform     = useInsuranceStore((s) => s.askFreeform);

  const [freeformText, setFreeformText]       = useState('');
  const [loadingScenario, setLoadingScenario] = useState(null);
  const debounceRef = useRef({});

  const handleScenario = (scenarioId) => {
    if (debounceRef.current[scenarioId]) return;
    debounceRef.current[scenarioId] = true;
    setTimeout(() => { debounceRef.current[scenarioId] = false; }, 800);
    setLoadingScenario(scenarioId);
    runScenario(scenarioId);
    setTimeout(() => setLoadingScenario(null), 900);
  };

  const handleFreeform = () => {
    if (!freeformText.trim()) return;
    askFreeform(freeformText.trim());
    setFreeformText('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 250, damping: 28 }}
      className="flex flex-col gap-4"
    >
      {/* Stress Test Buttons */}
      <div>
        <div className="font-mono uppercase tracking-widest text-purple-600 mb-2" style={{ fontSize: '12px' }}>
          Stress Test
        </div>
        <div className="flex gap-2">
          {SCENARIOS.map((s) => (
            <ScenarioButton
              key={s.id}
              scenario={s}
              active={activeScenario?.id === s.id}
              loading={loadingScenario === s.id}
              onClick={() => handleScenario(s.id)}
            />
          ))}
        </div>
      </div>

      {/* Scenario result */}
      <AnimatePresence mode="wait">
        {activeScenario && (
          <motion.div
            key={activeScenario.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
          >
            <div className="font-mono text-amber-700" style={{ fontSize: '12px' }}>
              Scenario: {activeScenario.label} →{' '}
              <span className="font-bold">{activeScenario.recommendation}</span>
            </div>
            {activeScenario.newLossRatio && (
              <div className="text-slate-800 font-mono mt-0.5" style={{ fontSize: '12px' }}>
                LR: {activeScenario.newLossRatio} · {activeScenario.memoOverride}
              </div>
            )}
            {activeScenario.coinsurancePenaltyActivates && (
              <div className="text-red-600 font-mono mt-0.5" style={{ fontSize: '12px' }}>
                ⚠ Coinsurance penalty activates — appraisal required
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q&A Panel */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-3.5 h-3.5 text-slate-800" />
          <div className="font-mono uppercase tracking-widest text-purple-600" style={{ fontSize: '12px' }}>
            Ask the underwriting officer
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={freeformText}
            onChange={(e) => setFreeformText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFreeform()}
            placeholder="Ask anything about this submission..."
            className="
              flex-1 px-3 py-2 rounded-lg text-sm
              bg-white border border-purple-200
              text-slate-800 placeholder:text-slate-700
              focus:outline-none focus:border-purple-400
              transition-all duration-200
            "
          />
          <button
            onClick={handleFreeform}
            className="px-3 py-2 rounded-lg bg-purple-100 border border-purple-300 text-purple-600 hover:bg-purple-200 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QA_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => askQA(chip.id)}
              className={`
                px-3 py-1.5 rounded-lg font-medium border transition-all duration-200
                ${qaAnswer?.questionId === chip.id
                  ? 'bg-purple-100 border-purple-400 text-purple-700'
                  : 'bg-white/5 border-white/10 text-purple-500 hover:bg-white/10 hover:text-white'
                }
              `}
              style={{ fontSize: '12px' }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {qaAnswer && (
            <motion.div
              key={qaAnswer.questionId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 p-3 bg-white border border-purple-200 rounded-lg text-slate-700 leading-relaxed"
              style={{ fontSize: '12px' }}
            >
              {qaAnswer.answer}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showQRHighlight && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3"
            >
              <QRCodeDisplay />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ScenarioButton({ scenario, active, loading, onClick }) {
  const colors = {
    amber:  { base: 'border-amber-400/20 text-amber-700 hover:bg-amber-400/10',   active: 'bg-amber-400/20 border-amber-400/40 text-amber-700'  },
    orange: { base: 'border-orange-400/20 text-orange-700 hover:bg-orange-400/10', active: 'bg-orange-400/20 border-orange-400/40 text-orange-700' },
    red:    { base: 'border-red-400/20 text-red-700 hover:bg-red-400/10',          active: 'bg-red-400/20 border-red-400/40 text-red-700'         },
  };
  const c    = colors[scenario.color];
  const Icon = scenario.icon;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`
        flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border font-medium
        transition-all duration-200 active:scale-[0.97]
        ${active ? c.active : `bg-white/5 ${c.base}`}
        disabled:opacity-60
      `}
      style={{ fontSize: '12px' }}
    >
      {loading
        ? <div className="w-3.5 h-3.5 border border-current/30 border-t-current rounded-full animate-spin" />
        : <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      }
      <span className="leading-tight text-center">{scenario.label}</span>
    </button>
  );
}
