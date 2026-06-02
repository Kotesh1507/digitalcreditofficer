import React from 'react';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  PackageX,
} from 'lucide-react';
import { useStore } from '../store/index.js';

export default function Dashboard() {
  const tiles = useStore((s) => s.tiles);
  const storeLabel = useStore((s) => s.storeLabel);
  const sendQuery = useStore((s) => s.sendQuery);
  const askQA = useStore((s) => s.askQA);

  const ALERT_QA = {
    alert_1: 'alert_apparel_traffic',
    alert_2: 'alert_oos',
    alert_3: 'alert_footwear',
  };

  const kpis = tiles.kpis || [];
  const alerts = tiles.alerts || [];

  return (
    <div className="dashboard">
      <div className="center-label">
        {storeLabel || 'Sales Command Center'}
      </div>

      {/* Alerts - appear progressively */}
      {alerts.length > 0 && (
        <div className="alert-strip">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`alert-chip alert-${alert.type} tile-enter`}
              style={{ animationDelay: `${i * 0.1}s` }}
              onClick={() => {
                const qaId = ALERT_QA[alert.id];
                if (qaId) askQA(qaId);
                else if (alert.pre_seeded_prompt) sendQuery(alert.pre_seeded_prompt);
              }}
            >
              {alert.type === 'red' && <AlertTriangle size={11} />}
              {alert.type === 'amber' && <PackageX size={11} />}
              {alert.type === 'green' && <TrendingUp size={11} />}
              {alert.text}
            </div>
          ))}
        </div>
      )}

      {/* KPIs - appear progressively */}
      {kpis.length > 0 && (
        <div className="kpi-row">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className={`kpi-card ${kpi.active ? 'active' : ''} tile-enter`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="kpi-label">{kpi.label}</div>
              <div
                className="kpi-val"
                style={{
                  color:
                    kpi.color === 'red'
                      ? 'var(--red)'
                      : kpi.color === 'green'
                      ? 'var(--green)'
                      : 'var(--text1)',
                }}
              >
                {kpi.value}
              </div>
              <div
                className="kpi-delta"
                style={{
                  color:
                    kpi.color === 'red'
                      ? 'var(--red)'
                      : kpi.color === 'green'
                      ? 'var(--green)'
                      : 'var(--text2)',
                }}
              >
                {kpi.delta_direction === 'down' && <TrendingDown size={10} />}
                {kpi.delta_direction === 'up' && <TrendingUp size={10} />}
                {kpi.delta}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder when no data yet */}
      {kpis.length === 0 && alerts.length === 0 && (
        <div className="dashboard-empty">
          <div className="dashboard-empty-text">
            Waiting for analysis...
          </div>
        </div>
      )}

      {/* Category Chart - appears when available */}
      {tiles.categories && (
        <div className="chart-card tile-enter">
          <div className="chart-header">
            <div>
              <div className="chart-title">Category sell-through vs plan</div>
              <div className="chart-sub">Last 2 weeks</div>
            </div>
          </div>
          <svg viewBox="0 0 500 100" style={{ width: '100%', height: '100px' }}>
            {tiles.categories.map((cat, i) => (
              <g key={cat.name} transform={`translate(0, ${i * 18})`}>
                <text x="0" y="12" fontSize="9" fill="#555f7a">
                  {cat.name}
                </text>
                <rect
                  x="70"
                  y="4"
                  width={cat.plan}
                  height="6"
                  rx="2"
                  fill="#323b55"
                  opacity="0.7"
                />
                <rect
                  x="70"
                  y="4"
                  width={cat.actual}
                  height="6"
                  rx="2"
                  fill={cat.color}
                />
                <text
                  x={75 + Math.max(cat.actual, cat.plan)}
                  y="12"
                  fontSize="9"
                  fill={cat.color}
                >
                  {cat.comp > 0 ? '+' : ''}
                  {cat.comp}%
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Waterfall Chart - appears when available */}
      {tiles.waterfall && (
        <div className="chart-card tile-enter">
          <div className="chart-header">
            <div>
              <div className="chart-title">Comp sales variance waterfall</div>
              <div className="chart-sub">Contribution breakdown</div>
            </div>
          </div>
          <svg viewBox="0 0 500 80" style={{ width: '100%', height: '80px' }}>
            {tiles.waterfall.map((item, i) => (
              <g key={item.name} transform={`translate(${i * 100}, 0)`}>
                <rect
                  x="10"
                  y={item.val > 0 ? 45 : 25}
                  width={item.width}
                  height={Math.abs(item.val) * 5}
                  rx="3"
                  fill={item.val > 0 ? 'var(--green-muted)' : 'var(--red-muted)'}
                  opacity={i === tiles.waterfall.length - 1 ? 1 : 0.7}
                />
                <text
                  x="10"
                  y="15"
                  fontSize="9"
                  fill={item.val > 0 ? 'var(--green-muted)' : 'var(--red-muted)'}
                >
                  {item.val > 0 ? '+' : ''}
                  {item.val}pp
                </text>
                <text
                  x="40"
                  y="75"
                  textAnchor="middle"
                  fontSize="9"
                  fill="#555f7a"
                >
                  {item.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Forecast Chart - appears when available */}
      {tiles.forecast && (
        <div className="chart-card tile-enter">
          <div className="chart-header">
            <div>
              <div className="chart-title">{tiles.forecast.title || '12-Week Forecast'}</div>
              <div className="chart-sub">{tiles.forecast.subtitle}</div>
            </div>
          </div>
          <div className="forecast-range">
            <span className="forecast-low">${tiles.forecast.low}M</span>
            <div className="forecast-bar">
              <div className="forecast-fill" style={{ width: '70%' }} />
            </div>
            <span className="forecast-high">${tiles.forecast.high}M</span>
          </div>
        </div>
      )}

      {/* Peer Comparison - appears when available */}
      {tiles.peers && (
        <div className="chart-card tile-enter">
          <div className="chart-header">
            <div>
              <div className="chart-title">Peer Comparison</div>
              <div className="chart-sub">{tiles.peers.cluster}</div>
            </div>
          </div>
          <div className="peer-list">
            {tiles.peers.stores?.map((store, i) => (
              <div key={i} className={`peer-row ${store.isTarget ? 'target' : ''}`}>
                <span className="peer-name">{store.id}</span>
                <span className="peer-comp" style={{ color: store.comp >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {store.comp >= 0 ? '+' : ''}{store.comp}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
