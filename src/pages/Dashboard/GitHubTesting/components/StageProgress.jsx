import React from 'react';
import { Check, Loader2, X, GitBranch, Brain, FlaskConical, Play, FileBarChart, Clock } from 'lucide-react';

// Each stage carries a human sentence, not just its internal name — during a
// run that lasts minutes, "analyzing" alone tells the user nothing about what
// the engine is actually doing or why it is taking a while.
export const STAGES = [
  { key: 'cloning',    label: 'Clone',     icon: GitBranch,    doing: 'Downloading your repository…' },
  { key: 'analyzing',  label: 'Analyze',   icon: Brain,        doing: 'Reading your code and extracting its business rules…' },
  { key: 'generating', label: 'Generate',  icon: FlaskConical, doing: 'Writing test cases from those rules…' },
  { key: 'executing',  label: 'Execute',   icon: Play,         doing: 'Installing dependencies and running the tests…' },
  { key: 'reporting',  label: 'Report',    icon: FileBarChart, doing: 'Sorting real bugs from test problems…' },
];

const STAGE_INDEX = STAGES.reduce((acc, s, i) => ({ ...acc, [s.key]: i }), {});

export const isTerminal = (status) => ['completed', 'failed', 'cancelled'].includes(status);

/** "4m 12s" — a run legitimately takes minutes, so a live elapsed counter is
 *  the difference between "working" and "frozen" from the user's side. */
export function formatElapsed(ms) {
  if (ms < 0 || Number.isNaN(ms)) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/**
 * Live detail of what the current stage is actually working on.
 *
 * A stage label alone looks identical at minute 1 and minute 30, so a
 * healthy long run is indistinguishable from a hung one. This names the
 * file(s) in flight and how far through the stage is.
 */
function StageDetail({ progress }) {
  if (!progress || !progress.total) return null;
  const { current = 0, total, label, unit = 'files' } = progress;
  const pct = Math.min(100, Math.round((current / total) * 100));

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-gray-500 truncate font-mono min-w-0">{label || '…'}</span>
        <span className="text-gray-400 shrink-0 tabular-nums">
          {current} / {total} {unit}
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-orange-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function StageProgress({ stage, status, elapsedMs, progress }) {
  const done = status === 'completed';
  const failed = status === 'failed' || status === 'cancelled';
  const currentIdx = done ? STAGES.length : (STAGE_INDEX[stage] ?? -1);
  const active = STAGES[currentIdx];

  return (
    <div>
      <div className="flex items-stretch">
        {STAGES.map((s, i) => {
          const isDone = i < currentIdx || done;
          const isCurrent = i === currentIdx && !done && !failed;
          const isFailedHere = failed && i === currentIdx;
          const Icon = s.icon;

          return (
            <div key={s.key} className="flex-1 flex flex-col items-center relative">
              {/* connector rail, drawn behind the node */}
              {i > 0 && (
                <span
                  className={`absolute top-4 right-1/2 w-full h-0.5 ${
                    isDone || isCurrent ? 'bg-orange-300' : 'bg-gray-200'
                  }`}
                />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full grid place-items-center border-2 transition-colors ${
                  isFailedHere
                    ? 'bg-red-500 border-red-500 text-white'
                    : isDone
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : isCurrent
                    ? 'bg-white border-orange-500 text-orange-500'
                    : 'bg-white border-gray-200 text-gray-300'
                }`}
              >
                {isFailedHere ? <X size={14} />
                  : isDone ? <Check size={14} />
                  : isCurrent ? <Loader2 size={14} className="animate-spin" />
                  : <Icon size={14} />}
              </div>
              <span
                className={`mt-1.5 text-[11px] font-medium ${
                  isFailedHere ? 'text-red-600' : isDone || isCurrent ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 min-w-0">
          {!done && !failed && <Loader2 size={14} className="animate-spin text-orange-500 shrink-0" />}
          {/* Cancelled is deliberately NOT shown in red like a failure --
              the user asked for it, so presenting it as an error is wrong. */}
          <span className={`truncate ${
            status === 'cancelled' ? 'text-gray-500'
              : failed ? 'text-red-600'
              : done ? 'text-green-700'
              : 'text-gray-600'
          }`}>
            {status === 'cancelled'
              ? 'Cancelled by you'
              : failed
              ? 'Run stopped'
              : done
              ? 'Finished'
              : stage === 'queued'
              ? 'Waiting for a worker to pick this up…'
              : active?.doing || 'Working…'}
          </span>
        </span>
        {elapsedMs != null && (
          <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 tabular-nums">
            <Clock size={12} /> {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      {/* Only while running -- a finished run's last-in-flight file is noise. */}
      {!done && !failed && <StageDetail progress={progress} />}
    </div>
  );
}
