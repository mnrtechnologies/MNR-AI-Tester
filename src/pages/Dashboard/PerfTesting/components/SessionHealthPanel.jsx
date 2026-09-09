import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';

/**
 * What the journey actually ran, as opposed to what was asked for.
 *
 * Two numbers here change how every timing on the page should be read, and
 * both are easy to hide:
 *
 *   achieved vs requested — a run that could only launch 40 of 200 requested
 *   browser contexts measured something quite different from what the caller
 *   ordered. FeatureJourneyMetrics is explicit that this must be surfaced
 *   rather than smoothed over.
 *
 *   identities vs sessions — without a credential pool every session signs in
 *   as the SAME user. Playwright contexts isolate cookies, so they never
 *   collide in the browser; on the server they are one account N times over,
 *   and per-user caching, rate limits or single-session enforcement can push
 *   the numbers in either direction. Ten sessions on one login is not a
 *   ten-user concurrency test, and nobody can tell from the percentiles alone.
 */
export default function SessionHealthPanel({ metrics }) {
  if (!metrics) return null;

  const {
    requested_concurrency: requested,
    achieved_concurrency: achieved,
    launch_failures: failures,
    identities = 1,
    sessions_completed_full_journey: completed,
    sessions_failed_midway: midway,
  } = metrics;

  const shortfall = achieved < requested;
  const sharedAccount = identities < achieved;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-orange-500" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Session Health
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Requested" value={requested} />
        <Stat label="Achieved" value={achieved} warn={shortfall} />
        <Stat label="Launch fails" value={failures} warn={failures > 0} />
        <Stat label="Identities" value={identities} suffix={`/ ${achieved}`} warn={sharedAccount} />
      </div>

      {(completed !== undefined || midway !== undefined) && (
        <p className="text-[11px] text-slate-500 mt-3">
          {completed} session{completed === 1 ? '' : 's'} walked the full journey
          {midway ? `, ${midway} stopped partway` : ''}.
        </p>
      )}

      {shortfall && (
        <Note>
          Only {achieved} of {requested} sessions launched, so the percentiles above are
          across the sessions that actually ran — not the number requested.
        </Note>
      )}

      {sharedAccount && (
        <Note>
          All {achieved} sessions signed in as the same account. Per-user caching, rate
          limits or single-session enforcement can distort these timings — supply a
          credential pool for genuinely distinct concurrent users.
        </Note>
      )}
    </div>
  );
}

function Stat({ label, value, suffix, warn }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-lg font-mono font-semibold tabular-nums
        ${warn ? 'text-amber-600' : 'text-slate-800'}`}>
        {value ?? '—'}
        {suffix && <span className="text-xs text-slate-400 font-normal ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function Note({ children }) {
  return (
    <div className="flex gap-2 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
      <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-900 leading-relaxed">{children}</p>
    </div>
  );
}
