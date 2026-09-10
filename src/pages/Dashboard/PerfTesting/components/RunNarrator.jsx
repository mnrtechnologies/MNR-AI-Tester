import React from 'react';
import { Activity, Users, Timer, AlertTriangle } from 'lucide-react';
import { PHASE_EXPECTATIONS, LOAD_PHASE_INFO, LOADGEN_PHASES } from '../constants';
import { fmtMs } from '../api';

/**
 * "What is happening right now, and is it going well?"
 *
 * A running test used to answer neither. The pipeline stepper says WHICH phase
 * is active but not what that phase does; the charts carry live numbers but no
 * sense of whether those numbers are good; and the log is a developer's
 * transcript, not an explanation. Between them a user could watch a run for
 * ten minutes and still not be able to say what the machine was doing.
 *
 * So this states it in one sentence, then puts the four numbers that actually
 * matter next to it, large enough to read at a glance and labelled in words
 * rather than in metric names.
 *
 * The error-rate reading is deliberately phase-aware. The same 4% means
 * opposite things in two different phases — in `load` it is a problem, in
 * `stress` it is the entire point of the exercise — so the verdict is drawn
 * from LOAD_PHASE_INFO's `errorsAreExpected` rather than from a fixed
 * threshold that would cry wolf through every stress run.
 */

const PHASE_HEADLINE = {
  queued: 'Waiting for a free worker',
  planning: 'Working out what to run',
  discovery: 'Exploring your site',
  auth: 'Signing in to your site',
  scenario_generation: 'Building the load test',
  feature_journey: 'Timing each feature',
  web_vitals: 'Measuring page experience',
  analysis: 'Working out what it all means',
  report: 'Building your report',
};

function Stat({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const toneClass = {
    slate: 'text-slate-800',
    orange: 'text-orange-600',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
  }[tone];
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={11} className="text-slate-400 shrink-0" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className={`text-xl font-bold tabular-nums leading-tight ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{sub}</div>}
    </div>
  );
}

export default function RunNarrator({ phase, phaseLabel, status, latestSample, targetVus, directMode }) {
  if (!phase || ['completed', 'failed', 'cancelled'].includes(status)) return null;

  const isLoadgen = LOADGEN_PHASES.has(phase);
  const info = LOAD_PHASE_INFO[phase];

  // Direct mode genuinely skips discovery and scenario generation — the user
  // already supplied both. Saying "exploring your site" there would describe
  // work that is not happening.
  const headline = isLoadgen
    ? info?.question || phaseLabel
    : (directMode && (phase === 'discovery' || phase === 'scenario_generation'))
      ? 'Getting straight to the load test'
      : PHASE_HEADLINE[phase] || phaseLabel || 'Working';

  const explanation = isLoadgen
    ? info?.what
    : (directMode && (phase === 'discovery' || phase === 'scenario_generation'))
      ? 'You named the endpoints and the payloads, so there is nothing to explore and nothing to guess. This step is a formality and passes in seconds.'
      : PHASE_EXPECTATIONS[phase];

  const s = latestSample;
  const errPct = s?.error_rate_pct ?? null;
  const errorsExpected = info?.errorsAreExpected;
  const errTone = errPct === null || errPct === 0
    ? 'emerald'
    : errorsExpected ? 'orange' : 'rose';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
            Happening now
          </span>
        </div>
        <h3 className="text-base font-bold text-slate-800 leading-snug">{headline}</h3>
        {explanation && (
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{explanation}</p>
        )}
        {isLoadgen && info?.reading && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            <b className="font-semibold text-slate-600">Reading it: </b>{info.reading}
          </p>
        )}
      </div>

      {isLoadgen && s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4 bg-slate-50/70 border-t border-slate-100">
          <Stat
            icon={Users}
            label="Users right now"
            value={(s.vus ?? 0).toLocaleString()}
            sub={targetVus ? `ramping to ${targetVus.toLocaleString()}` : null}
            tone="orange"
          />
          <Stat
            icon={Activity}
            label="Requests / sec"
            value={(s.rps ?? 0).toFixed(1)}
            sub="handled by your server"
          />
          <Stat
            icon={Timer}
            label="Slow responses"
            value={fmtMs(s.p95_ms)}
            sub="the unluckiest 1 in 20"
          />
          <Stat
            icon={AlertTriangle}
            label="Failing"
            value={errPct === null ? '—' : `${errPct.toFixed(1)}%`}
            sub={
              errPct === 0 ? 'nothing failing'
                : errorsExpected ? 'expected in this phase'
                  : 'requests erroring'
            }
            tone={errTone}
          />
        </div>
      )}
    </div>
  );
}
