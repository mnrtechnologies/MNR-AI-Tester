import React from 'react';

export default function ScoreRing({ score }) {
  const r = 30, circ = 2 * Math.PI * r;
  const filled = ((score ?? 0) / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#f43f5e';
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
      <circle cx="38" cy="38" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 38 38)"
        style={{ transition: 'stroke-dasharray .7s ease' }} />
      <text x="38" y="44" textAnchor="middle" fontSize="15" fontWeight="800" fill={color}>
        {score ?? '—'}
      </text>
    </svg>
  );
}
