import React from 'react';
import { BarChart3, ChevronRight, Clock, PackageX, Copy, Stethoscope, LineChart, Store } from 'lucide-react';
import { useStore } from '../store/index.js';

export default function MemoColumn() {
  const verdict = useStore((s) => s.verdict);
  const findings = useStore((s) => s.findings);
  const decomposition = useStore((s) => s.decomposition);
  const drillDowns = useStore((s) => s.drillDowns);
  const agentId = useStore((s) => s.agentId);
  const agentName = useStore((s) => s.agentName);
  const loading = useStore((s) => s.loading);
  const sendQuery = useStore((s) => s.sendQuery);
  const askQA = useStore((s) => s.askQA);

  const DRILL_QA = {
    'OOS SKUs in week 2': 'alert_oos',
    'Apparel traffic by hour of day': 'alert_apparel_traffic',
    'Cluster conversion comparison': 'store_0142_peers',
  };

  const agentIcon = agentId === 'forecast' ? <LineChart size={12} /> :
                    agentId === 'store_comparison' ? <Store size={12} /> :
                    <Stethoscope size={12} />;

  const agentBadgeClass = agentId === 'forecast' ? 'badge-fore' :
                          agentId === 'store_comparison' ? 'badge-comp' : 'badge-diag';

  const verdictClass = agentId === 'forecast' ? 'forecast' :
                       agentId === 'store_comparison' ? 'comparison' : 'diag';

  if (loading) {
    return (
      <div className="memo-column">
        <div className="memo-loading">
          <div className="loading-spinner" />
          <span>Analyzing...</span>
        </div>
      </div>
    );
  }

  if (!verdict) {
    return (
      <div className="memo-column">
        <div className="memo-empty">
          <Stethoscope size={36} />
          <p>Analysis results will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="memo-column">
      {/* Verdict */}
      <div className="memo-section">
        <span className={`agent-badge ${agentBadgeClass}`}>
          {agentIcon}
          {agentName}
        </span>
        <div className={`verdict-box ${verdictClass} tile-enter`}>
          {verdict}
        </div>
      </div>

      {/* Findings */}
      {findings && findings.length > 0 && (
        <div className="memo-section tile-enter" style={{ animationDelay: '0.1s' }}>
          <div className="section-title">
            <BarChart3 size={13} />
            Findings
          </div>
          {findings.map((finding, i) => (
            <div key={i} className="finding-row">
              <div className={`fn-num ${finding.severity === 'green' ? 'fn-green' : 'fn-red'}`}>
                {i + 1}
              </div>
              <div className="fn-text">{finding.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Decomposition */}
      {decomposition && (
        <div className="memo-section tile-enter" style={{ animationDelay: '0.2s' }}>
          <div className="section-title">Variance decomposition</div>
          {Object.entries(decomposition).map(([key, val]) => (
            <div key={key} className="decomp-row">
              <span className="decomp-lbl">{key.replace('_', ' ')}</span>
              <div className="dbar-wrap">
                <div
                  className={`dbar ${val.contribution_pp < 0 ? 'dbar-neg' : 'dbar-pos'}`}
                  style={{ width: `${Math.min(Math.abs(val.contribution_pp) * 10, 100)}%` }}
                />
              </div>
              <span
                className="decomp-pct"
                style={{ color: val.contribution_pp < 0 ? 'var(--red)' : 'var(--green)' }}
              >
                {val.contribution_pp > 0 ? '+' : ''}{val.contribution_pp}pp
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drill-downs */}
      {drillDowns && drillDowns.length > 0 && (
        <div className="memo-section tile-enter" style={{ animationDelay: '0.3s' }}>
          <div className="section-title">
            <ChevronRight size={13} />
            Drill-down suggestions
          </div>
          {drillDowns.map((drill, i) => (
            <div
              key={i}
              className="drill-row"
              onClick={() => {
                const qaId = DRILL_QA[drill.text];
                if (qaId) askQA(qaId);
                else sendQuery(drill.text);
              }}
            >
              <div className="drill-icon">
                {drill.icon === 'clock' && <Clock size={13} />}
                {drill.icon === 'package-off' && <PackageX size={13} />}
                {drill.icon === 'chart-bar' && <BarChart3 size={13} />}
              </div>
              <div className="drill-text">{drill.text}</div>
              <div className="drill-arrow">→</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="memo-footer">
        <button className="copy-btn">
          <Copy size={12} />
          Copy markdown
        </button>
      </div>
    </div>
  );
}
