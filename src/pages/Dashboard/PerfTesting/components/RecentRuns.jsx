import React, { useCallback, useEffect, useState } from 'react';
import { Clock, RefreshCw, Loader2, ChevronRight, AlertTriangle, Globe, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, fmtDate } from '../api';
import { stCfg } from '../constants';

const TYPE_CHIP = 'px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wide';

export default function RecentRuns({ onSelect, refreshKey }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  // Collapsed by default. History is reference material you go looking for,
  // not something you need while watching a run — and left open it added
  // twenty rows of scrolling below the results every single time.
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch('/api/perf/runs?limit=20');
      setRuns(d.runs || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch only once opened, so a collapsed panel costs nothing. refreshKey
  // still re-fetches, but only while it is actually being shown.
  useEffect(() => { if (open) load(); }, [open, load, refreshKey]);

  return (
    <div className="bg-white rounded-3xl px-6 py-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider
                     hover:text-slate-600 transition-colors rounded
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <Clock size={12} />
          Recent Runs
          <ChevronRight
            size={13}
            className={`transition-transform ${open ? 'rotate-90' : ''}`}
          />
          {!open && runs.length > 0 && (
            <span className="text-slate-300 font-normal normal-case">{runs.length}</span>
          )}
        </button>
        {open && (
          <button onClick={load} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
        )}
      </div>

      {!open ? null : loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
      ) : runs.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">No runs yet — start your first test above.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {runs.map((r) => {
            const c = stCfg[r.status] || stCfg.queued;
            const breachCount = (r.sla_breaches || []).length;
            const testTypes = (r.plan?.test_types) || [];
            const isClean = r.status === 'completed' && breachCount === 0 && !r.coverage_caveat;
            return (
              <button key={r.run_id} onClick={() => onSelect(r.run_id)}
                className="flex flex-col gap-2.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:bg-white hover:border-orange-200 hover:shadow-md transition-all text-left group">

                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold ${c.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} /> {c.label}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">{fmtDate(r.created_at)}</span>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <Globe size={12} className="text-slate-300 shrink-0" />
                  <span className="text-xs text-slate-700 font-medium truncate">{r.target_url}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {testTypes.map((t) => <span key={t} className={TYPE_CHIP}>{t}</span>)}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.coverage_caveat && (
                      <span title={r.coverage_caveat}><AlertTriangle size={13} className="text-amber-500" /></span>
                    )}
                    {breachCount > 0 && (
                      <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-1.5 py-0.5">
                        {breachCount} target{breachCount === 1 ? '' : 's'} missed
                      </span>
                    )}
                    {isClean && <CheckCircle2 size={13} className="text-emerald-500" />}
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-orange-400 transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
