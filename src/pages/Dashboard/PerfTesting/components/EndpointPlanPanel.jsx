import React from 'react';
import { Target } from 'lucide-react';

/**
 * What the load is actually being aimed at, in direct-endpoints mode.
 *
 * This panel exists because that mode leaves the user watching a progress bar
 * with nothing to read. The exploring modes fill the left rail with live
 * screenshots — you can see the engine working. Direct mode has no browser and
 * no screenshots, so the same space sat empty while the most important fact
 * about the run went unstated: which endpoints are being hit, and in what
 * proportion.
 *
 * The proportion in particular is routinely misread. A weight of 20 next to a
 * weight of 1 does NOT mean "20 requests" or "20 users" — it is a share of the
 * traffic, and the two numbers together mean 95% / 5%. Users have asked
 * directly what the number means, which is a sign the UI should have been
 * answering it rather than waiting to be asked. So the percentage is computed
 * and shown, and the raw weight is demoted to a secondary detail.
 */
export default function EndpointPlanPanel({ scenario, virtualUsers }) {
  const tasks = (scenario?.user_classes || []).flatMap((u) => u.tasks || []);
  if (!tasks.length) return null;

  const total = tasks.reduce((sum, t) => sum + (Number(t.weight) || 1), 0);
  const rows = tasks
    .map((t) => {
      const weight = Number(t.weight) || 1;
      return { ...t, weight, share: (weight / total) * 100 };
    })
    .sort((a, b) => b.share - a.share);

  const methodClass = (m) => ({
    GET: 'bg-sky-50 text-sky-700 border-sky-200',
    POST: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PUT: 'bg-amber-50 text-amber-700 border-amber-200',
    PATCH: 'bg-amber-50 text-amber-700 border-amber-200',
    DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  }[(m || 'GET').toUpperCase()] || 'bg-slate-50 text-slate-600 border-slate-200');

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Target size={14} className="text-orange-500" />
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          What the load is aimed at
        </h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">
        You supplied these, so nothing is being explored. Every virtual user runs
        this same list, picking one at random each time — weighted as below.
      </p>

      <div className="space-y-3">
        {rows.map((t, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${methodClass(t.method)}`}>
                {(t.method || 'GET').toUpperCase()}
              </span>
              <span className="text-xs font-mono text-slate-700 truncate flex-1 min-w-0">
                {t.path}
              </span>
              <span className="text-sm font-bold text-slate-800 tabular-nums shrink-0">
                {t.share >= 99.5 ? '100' : t.share.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(t.share, 1.5)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              weight {t.weight} of {total}
              {t.json_body ? ' · sends a JSON body' : ''}
            </p>
          </div>
        ))}
      </div>

      {virtualUsers > 0 && (
        <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
          At peak, <b className="font-semibold text-slate-700">{virtualUsers.toLocaleString()}</b> virtual
          users are running this list at once. Each one hits every endpoint —
          the percentages are how often, not how many users go where.
        </p>
      )}
    </div>
  );
}
