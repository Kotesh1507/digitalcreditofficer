import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useStore } from '../store/index.js';
import { API_BASE } from '../config.js';

const FALLBACK_CHIPS = [
  { id: 'store_0214_down', label: 'Why is Store 0214 down?' },
  { id: 'apparel_forecast', label: '12-week Apparel forecast' },
  { id: 'store_0142_peers', label: 'Why does 0142 lag its cluster?' },
  { id: 'manager_action', label: 'What should the manager do?' },
  { id: 'apparel_problem', label: 'Why is Apparel the problem?' },
  { id: 'peer_318', label: 'How does 318 beat us?' },
];

export default function MayaQAPanel() {
  const qaAnswer = useStore((s) => s.qaAnswer);
  const showQRHighlight = useStore((s) => s.showQRHighlight);
  const askQA = useStore((s) => s.askQA);
  const tavusConversationId = useStore((s) => s.tavusConversationId);

  const [chips, setChips] = useState(FALLBACK_CHIPS);

  useEffect(() => {
    fetch(`${API_BASE}/api/qa-chips`)
      .then((res) => res.json())
      .then((data) => {
        if (data.chips?.length) setChips(data.chips);
      })
      .catch(() => {});
  }, []);

  if (!tavusConversationId) return null;

  return (
    <div className="maya-qa-panel">
      <div className="maya-qa-header">
        <MessageSquare size={13} />
        <span>Ask Maya</span>
        <span className="maya-qa-hint">Chips = scripted · Type below = pilot QR</span>
      </div>

      <div className="maya-qa-chips">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`maya-qa-chip ${qaAnswer?.questionId === chip.id ? 'active' : ''}`}
            onClick={() => askQA(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {qaAnswer && (
        <div className="maya-qa-answer">{qaAnswer.answer}</div>
      )}

      {showQRHighlight && (
        <div className="maya-qa-qr">
          <div className="maya-qa-qr-title">Continue with Bealls Analytics</div>
          <p className="maya-qa-qr-text">
            Scan or visit the pilot link for a full store walkthrough with your data.
          </p>
          <a
            className="maya-qa-qr-link"
            href={import.meta.env.VITE_PILOT_URL || 'https://www.bealls.com'}
            target="_blank"
            rel="noreferrer"
          >
            Open pilot →
          </a>
        </div>
      )}
    </div>
  );
}
