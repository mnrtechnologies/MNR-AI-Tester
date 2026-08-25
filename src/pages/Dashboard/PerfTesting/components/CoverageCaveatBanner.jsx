import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Surfaces run.coverage_caveat — set by the backend's discover() task when
 * the requested interaction (e.g. "select Chemistry, select a chapter, ask
 * a question") never actually reached any real backend traffic, meaning the
 * feature is entirely client-side. Without this, the numbers below would
 * silently describe generic/fallback traffic as if it were the requested
 * feature — this banner is the whole point of that backend work.
 */
export default function CoverageCaveatBanner({ caveat }) {
  if (!caveat) return null;
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
      <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Coverage caveat</p>
        <p className="text-sm text-amber-700 leading-relaxed">{caveat}</p>
      </div>
    </div>
  );
}
