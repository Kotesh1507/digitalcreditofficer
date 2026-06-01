import React from 'react';
import { BarChart3, TrendingUp, Store, Stethoscope, LineChart, Users } from 'lucide-react';
import { useStore } from '../store/index.js';

const PERSONA_CARDS = [
  {
    id: 'store_manager',
    name: 'Store Manager',
    color: '#f05252',
    icon: Stethoscope,
    tagline: 'Diagnose performance issues',
    sample: '"Why is my store down this week?"',
    qaId: 'store_0214_down',
  },
  {
    id: 'merchandiser',
    name: 'Merchandiser',
    color: '#4f7ef8',
    icon: LineChart,
    tagline: 'Forecast & plan ahead',
    sample: '"What does next quarter look like for Apparel?"',
    qaId: 'apparel_forecast',
  },
  {
    id: 'regional_vp',
    name: 'Regional VP',
    color: '#22d3b8',
    icon: Users,
    tagline: 'Compare stores & clusters',
    sample: '"How does Store 0142 stack up against its peers?"',
    qaId: 'store_0142_peers',
  },
];

export default function IdleScreen() {
  const askQA = useStore((s) => s.askQA);
  const sendQuery = useStore((s) => s.sendQuery);
  const suggestedPrompts = useStore((s) => s.suggestedPrompts);
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);

  const handlePromptClick = (text, qaId) => {
    if (qaId) askQA(qaId);
    else sendQuery(text);
  };

  return (
    <div className="idle-screen">
      <div className="idle-content">
        {/* Hero */}
        <div className="idle-hero">
          <div className="idle-logo">
            <BarChart3 size={28} />
          </div>
          <h1>Bealls Sales Command Center</h1>
          <p>
            Ask Maya about store performance, forecasts, or peer comparisons.
            <br />
            Select a persona and ask a question to get started.
          </p>
        </div>

        {/* Persona Cards */}
        <div className="persona-cards">
          {PERSONA_CARDS.map((p) => {
            const Icon = p.icon;
            const isActive = persona.id === p.id;
            return (
              <div
                key={p.id}
                className={`persona-card ${isActive ? 'active' : ''}`}
                style={{ '--persona-color': p.color }}
                onClick={() => setPersona({ id: p.id, name: p.name, color: p.color })}
              >
                <div className="persona-icon">
                  <Icon size={20} />
                </div>
                <div className="persona-info">
                  <div className="persona-name">{p.name}</div>
                  <div className="persona-tagline">{p.tagline}</div>
                </div>
                <div className="persona-sample" onClick={(e) => { e.stopPropagation(); handlePromptClick(p.sample.replace(/"/g, ''), p.qaId); }}>
                  {p.sample}
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="idle-divider">
          <span>or ask directly</span>
        </div>

        {/* Suggested Prompts */}
        <div className="idle-prompts">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              className="idle-prompt-btn"
              onClick={() => handlePromptClick(prompt.text, prompt.qaId)}
            >
              {prompt.icon === 'store' && <Store size={14} />}
              {prompt.icon === 'trending-up' && <TrendingUp size={14} />}
              {prompt.icon === 'chart' && <BarChart3 size={14} />}
              {prompt.text}
            </button>
          ))}
        </div>

        {/* Hint */}
        <div className="idle-hint">
          Start Maya above, then ask a question
        </div>
      </div>
    </div>
  );
}
