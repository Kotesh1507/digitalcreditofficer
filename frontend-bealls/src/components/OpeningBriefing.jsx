import React, { useEffect, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { API_BASE } from '../config.js';

const KPI_DEFINITIONS = [
  {
    id: 'ytd_sales',
    metric: 'YTD Sales',
    infoBar: 'Total net sales from Jan 1 to today across all comp stores',
    computation: 'SUM(net_sales) WHERE date >= Jan 1 AND date <= today',
  },
  {
    id: 'comp_store_sales',
    metric: 'Comp Store Sales',
    infoBar: 'Year-over-year sales growth for stores open at least 12 months in both periods',
    computation: '(TY YTD Sales - LY YTD Sales) / LY YTD Sales x 100',
  },
  {
    id: 'conversion_rate',
    metric: 'Conversion Rate',
    infoBar: 'Share of store visitors who completed a purchase',
    computation: 'Transactions / Total Store Traffic x 100',
  },
  {
    id: 'avg_transaction_value',
    metric: 'Average Transaction Value',
    infoBar: 'Average dollars spent per customer per visit',
    computation: 'Total Net Sales / Total Transactions',
  },
  {
    id: 'sell_through_rate',
    metric: 'Sell-Through Rate',
    infoBar: 'Share of received inventory sold, benchmarked against the same weeks last year',
    computation: 'Units Sold / Units Received x 100',
  },
  {
    id: 'repeat_rate',
    metric: 'Repeat Rate',
    infoBar: 'Share of customers who shopped more than once in the last 90 days',
    computation: 'Customers with 2+ transactions in 90 days / Total Customers x 100',
  },
];

const FALLBACK_KPIS = [
  { id: 'ytd_sales', label: 'YTD Sales', valueText: '$308M', deltaText: '+6.2% vs LY', delta_direction: 'up', color: 'green' },
  { id: 'comp_store_sales', label: 'Comp Store Sales', valueText: '+5.8%', deltaText: 'vs LY same period', delta_direction: 'up', color: 'green' },
  { id: 'conversion_rate', label: 'Conversion Rate', valueText: '40.0%', deltaText: '-3.5pp vs LY', delta_direction: 'down', color: 'red' },
  { id: 'avg_transaction_value', label: 'Avg Transaction', valueText: '$43.38', deltaText: '-$1.34 vs LY', delta_direction: 'down', color: 'red' },
  { id: 'sell_through_rate', label: 'Sell-Through', valueText: '75%', deltaText: '-7pp vs LY', delta_direction: 'down', color: 'red' },
  { id: 'repeat_rate', label: 'Repeat Rate', valueText: '41.1%', deltaText: '-2.3pp vs LY', delta_direction: 'down', color: 'red' },
];

const DRAFT_PROMPTS = {
  ytd_sales: 'What is driving YTD sales right now?',
  comp_store_sales: 'Why is comp store sales changing?',
  conversion_rate: 'Why is conversion rate changing?',
  avg_transaction_value: 'Why is average transaction value changing?',
  sell_through_rate: 'Why is sell-through underperforming?',
  repeat_rate: 'Why is repeat rate changing?',
};

export default function OpeningBriefing({ onDraftPrompt }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState([]);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setApiError(false);

    fetch(`${API_BASE}/api/opening-briefing`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.kpis) ? data.kpis : [];
        setKpis(rows);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setApiError(true);
        setKpis(FALLBACK_KPIS);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const safeKpis = useMemo(() => {
    if (kpis?.length) return kpis;
    if (loading) return [];
    return FALLBACK_KPIS;
  }, [kpis, loading]);

  const displayMap = new Map(safeKpis.map((k) => [k.id, k]));

  return (
    <div className="opening-briefing">
      <div className="briefing-title">Opening KPI Briefing</div>

      <div className="opening-def-table" role="table" aria-label="KPI definitions">
        <div className="opening-def-header opening-def-row">
          <div>Metric</div>
          <div>Info Bar Definition</div>
          <div>Computation</div>
          <div>Current Display</div>
        </div>
        {KPI_DEFINITIONS.map((def) => {
          const live = displayMap.get(def.id);
          return (
            <div key={def.id} className="opening-def-row">
              <div className="opening-def-metric">{def.metric}</div>
              <div className="opening-def-cell">{def.infoBar}</div>
              <div className="opening-def-code">{def.computation}</div>
              <div className="opening-def-code">
                {live ? `${live.valueText} / ${live.deltaText}` : loading ? 'Loading...' : 'N/A'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="briefing-kpi-subtitle">
        Click any metric to draft a prompt in chat.
        {apiError && ' (Showing fallback values while backend data loads.)'}
      </div>

      <div className="briefing-kpi-row">
        {safeKpis.map((kpi) => {
          const isUp = kpi.delta_direction === 'up';
          const prompt = DRAFT_PROMPTS[kpi.id] || '';
          return (
            <div
              key={kpi.id}
              className="kpi-card opening-briefing-kpi-card"
              onClick={() => onDraftPrompt?.(prompt)}
              title={`Click to ask about ${kpi.label || kpi.id}`}
            >
              <div className="kpi-label">{kpi.label || kpi.id}</div>
              <div className="kpi-val" style={{ color: kpi.color === 'red' ? 'var(--red)' : 'var(--green)' }}>
                {kpi.valueText}
              </div>
              <div
                className="kpi-delta"
                style={{ color: isUp ? 'var(--green)' : 'var(--red)' }}
              >
                {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {kpi.deltaText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
