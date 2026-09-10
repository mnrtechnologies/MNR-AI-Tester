import React from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PHASE_ORDER } from '../constants';

/**
 * Horizontal stepper filtered down to only the phases this specific run's
 * plan actually walks through — e.g. a plan with test_types=["smoke","load"]
 * never shows Stress/Spike/Soak, and Auth only shows when login credentials
 * were supplied for the run. Visually mirrors DBTesting's AssessmentTab
 * pipeline block, generalized to a dynamic phase list.
 */
export default function PhasePipeline({ plan, hasAuth, currentPhase, runStatus, directMode }) {
  const testTypes = plan?.test_types || [];
  const wantsWebVitals = (plan?.pages_to_audit || []).length > 0;

  const phases = PHASE_ORDER.filter((p) => {
    // A direct-endpoints run supplies its own endpoints and its own scenario,
    // so discovery and scenario generation never do any work. Showing them as
    // completed steps claims the engine explored something it did not, and
    // invites the reader to look for discovery results that will never appear.
    if (directMode && (p.id === 'discovery' || p.id === 'scenario_generation')) return false;
    if (p.id === 'auth') return hasAuth;
    if (p.testType) return testTypes.includes(p.testType);
    if (p.needsPages) return wantsWebVitals;
    return p.always;
  });

  // Compare canonical PHASE_ORDER positions, not positions within the filtered
  // list. A run can legitimately sit in a phase that is hidden here — a direct
  // run passes through `discovery` in seconds even though it does no
  // discovering — and matching on the filtered list would return -1, leaving
  // every step grey and the stepper looking broken at exactly the moment the
  // user is watching it move.
  const ordinal = (id) => PHASE_ORDER.findIndex((p) => p.id === id);
  const currentOrd = ordinal(currentPhase);
  const currentIdx = phases.findIndex((p) => p.id === currentPhase);
  const failed = runStatus === 'failed';
  const cancelled = runStatus === 'cancelled';

  return (
    <div className="flex items-center gap-0 overflow-x-auto hide-scroll pb-1">
      {phases.map((p, i) => {
        const done = runStatus === 'completed'
          || (currentOrd >= 0 && ordinal(p.id) < currentOrd);
        // When the live phase is hidden, light up the next visible step rather
        // than nothing: it is the one about to run, and it keeps the stepper
        // honest about forward progress.
        const active = runStatus === 'running' && (
          currentIdx >= 0
            ? i === currentIdx
            : currentOrd >= 0
              && ordinal(p.id) > currentOrd
              && !phases.slice(0, i).some((q) => ordinal(q.id) > currentOrd)
        );
        const erroredHere = (failed || cancelled) && (
          currentIdx >= 0 ? i === currentIdx : ordinal(p.id) === currentOrd
        );
        return (
          <React.Fragment key={p.id}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ${
                erroredHere ? 'bg-rose-500' : done ? 'bg-emerald-500' : active ? 'bg-orange-500' : 'bg-slate-200'
              }`}>
                {erroredHere ? <XCircle size={14} className="text-white" /> :
                 done ? <CheckCircle2 size={14} className="text-white" /> :
                 active ? <Loader2 size={13} className="text-white animate-spin" /> :
                          <div className="w-2 h-2 rounded-full bg-slate-400" />}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                erroredHere ? 'text-rose-600' : done ? 'text-emerald-600' : active ? 'text-orange-600' : 'text-slate-400'
              }`}>{p.label}</span>
            </div>
            {i < phases.length - 1 && (
              <div className={`h-[2px] w-8 mb-4 shrink-0 transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
