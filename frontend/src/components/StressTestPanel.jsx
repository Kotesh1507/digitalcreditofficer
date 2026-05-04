import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, UserMinus, AlertCircle, MessageSquare, Send } from 'lucide-react';
import { useStore } from '../store/index.js';
import QRCodeDisplay from './QRCodeDisplay.jsx';

const SCENARIOS = [
  { id: 'ratesUp200bps',    label: 'Rates rise 200bps',   icon: TrendingDown, color: 'amber'  },
  { id: 'topCustomerLeaves',label: 'Top customer leaves',  icon: UserMinus,    color: 'orange' },
  { id: 'revenueDown20',    label: 'Revenue drops 20%',    icon: AlertCircle,  color: 'red'    },
];

const QA_CHIPS = [
  { id: 'why_approve',   label: 'Why approve?'          },
  { id: 'what_worries',  label: 'What worries you?'     },
  { id: 'chair',         label: "What if I'm the chair?" },
];

export default function StressTestPanel() {
  const activeScenario  = useStore((s) => s.activeScenario);
  const qaAnswer        = useStore((s) => s.qaAnswer);
  const showQRHighlight = useStore((s) => s.showQRHighlight);
  const runScenario     = useStore((s) => s.runScenario);
  const askQA           = useStore((s) => s.askQA);
  const askFreeform     = useStore((s) => s.askFreeform);

  const [freeformText, setFreeformText]   = useState('');
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
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
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
            className="bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2"
          >
            <div className="text-xs font-mono text-amber-300">
              Scenario: {activeScenario.label} →{' '}
              <span className="font-bold">DSCR {activeScenario.newDscr}x</span>
              {' · '}
              <span className="text-slate-400">{activeScenario.recommendation}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q&A Panel */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-3 h-3 text-slate-500" />
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Ask the credit officer
          </div>
        </div>

        {/* Free-form input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={freeformText}
            onChange={(e) => setFreeformText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFreeform()}
            placeholder="Ask anything about this deal..."
            className="
              flex-1 px-3 py-2 rounded-lg text-sm
              bg-white/5 border border-white/10
              text-white placeholder:text-slate-600
              focus:outline-none focus:border-teal-accent/40
              transition-all duration-200
            "
          />
          <button
            onClick={handleFreeform}
            className="px-3 py-2 rounded-lg bg-teal-accent/10 border border-teal-accent/20 text-teal-accent hover:bg-teal-accent/20 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-2">
          {QA_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => askQA(chip.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200
                ${qaAnswer?.questionId === chip.id
                  ? 'bg-teal-accent/20 border-teal-accent/40 text-teal-accent'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Answer display */}
        <AnimatePresence mode="wait">
          {qaAnswer && (
            <motion.div
              key={qaAnswer.questionId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 leading-relaxed"
            >
              {qaAnswer.answer}
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR deflect */}
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
    amber:  { base: 'border-amber-400/20 text-amber-300 hover:bg-amber-400/10',  active: 'bg-amber-400/20 border-amber-400/40 text-amber-200'  },
    orange: { base: 'border-orange-400/20 text-orange-300 hover:bg-orange-400/10', active: 'bg-orange-400/20 border-orange-400/40 text-orange-200' },
    red:    { base: 'border-red-400/20 text-red-300 hover:bg-red-400/10',         active: 'bg-red-400/20 border-red-400/40 text-red-200'         },
  };
  const c = colors[scenario.color];
  const Icon = scenario.icon;

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`
        flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium
        transition-all duration-200 active:scale-[0.97]
        ${active ? c.active : `bg-white/5 ${c.base}`}
        disabled:opacity-60
      `}
    >
      {loading
        ? <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
        : <Icon className="w-3 h-3 flex-shrink-0" />
      }
      <span className="leading-tight text-center">{scenario.label}</span>
    </button>
  );
}
