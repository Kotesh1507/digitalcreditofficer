import React from 'react';
import { useStore } from '../store/index.js';
import { Stethoscope, LineChart, Store } from 'lucide-react';

export default function ReasoningTrace() {
  const traceLines = useStore((s) => s.traceLines);
  const agentId = useStore((s) => s.agentId);
  const agentName = useStore((s) => s.agentName);
  const loading = useStore((s) => s.loading);

  const agentIcon = agentId === 'forecast' ? <LineChart size={12} /> :
                    agentId === 'store_comparison' ? <Store size={12} /> :
                    <Stethoscope size={12} />;

  const agentBadgeClass = agentId === 'forecast' ? 'badge-fore' :
                          agentId === 'store_comparison' ? 'badge-comp' : 'badge-diag';

  return (
    <div className="reasoning-panel">
      <div className="reasoning-header">
        {agentName ? (
          <span className={`agent-badge ${agentBadgeClass}`}>
            {agentIcon}
            {agentName}
          </span>
        ) : (
          <span>Agent reasoning</span>
        )}
      </div>

      <div className="reasoning-list">
        {traceLines.map((step, i, arr) => (
          <div key={i} className="reasoning-step">
            <div className="step-line">
              <div className={`step-dot ${step.status}`} />
              {i < arr.length - 1 && <div className="step-connector" />}
            </div>
            <div className={`step-text ${step.status}`}>
              {step.text?.includes('(') ? (
                <>Called <code>{step.text}</code></>
              ) : (
                step.text
              )}
            </div>
          </div>
        ))}

        {loading && traceLines.length === 0 && (
          <div className="reasoning-loading">
            <div className="step-dot active" />
            <span>Starting analysis...</span>
          </div>
        )}

        {!loading && traceLines.length === 0 && (
          <div className="reasoning-empty">
            Ask a question to see agent reasoning
          </div>
        )}
      </div>
    </div>
  );
}
