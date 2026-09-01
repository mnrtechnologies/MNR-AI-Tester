import React from 'react';
import {
  History, Loader2, CheckCircle2, XCircle, Bug, Wrench, CircleSlash,
  GitBranch, Coins, Clock, ChevronRight,
} from 'lucide-react';
import { fmtRelative, fmtDuration } from '../api';

const STATUS_META = {
  completed: { icon: CheckCircle2, tone: 'text-green-600', bg: 'bg-green-50',  label: 'Completed' },
  failed:    { icon: XCircle,      tone: 'text-red-600',   bg: 'bg-red-50',    label: 'Failed' },
  cancelled: { icon: CircleSlash,  tone: 'text-gray-500',  bg: 'bg-gray-100',  label: 'Cancelled' },
  running:   { icon: Loader2,      tone: 'text-orange-600',bg: 'bg-orange-50', label: 'Running' },
  queued:    { icon: Clock,        tone: 'text-gray-400',  bg: 'bg-gray-50',   label: 'Queued' },
};

/** The one-line answer to "what did this run actually find?" — shown inline
 *  so the history is scannable without opening each run. */
function Outcome({ run }) {
  const summary = run.summary;
  if (run.status === 'running' || run.status === 'queued') {
    return <span className="text-xs text-orange-600 capitalize">{run.stage}…</span>;
  }
  if (run.status === 'failed') {
    return <span className="text-xs text-red-500">Did not finish</span>;
  }
  if (!summary || !summary.totals) {
    return <span className="text-xs text-gray-300">No results</span>;
  }

  const passed = summary.totals.passed || 0;
  const bugs = summary.codeBugs || 0;
  const issues = summary.testIssues || 0;

  return (
    <span className="flex items-center gap-2 flex-wrap">
      {bugs > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5">
          <Bug size={10} /> {bugs} bug{bugs === 1 ? '' : 's'}
        </span>
      )}
      {passed > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
          <CheckCircle2 size={10} /> {passed} passed
        </span>
      )}
      {issues > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
          <Wrench size={10} /> {issues} test issue{issues === 1 ? '' : 's'}
        </span>
      )}
      {bugs === 0 && passed === 0 && issues === 0 && (
        <span className="text-xs text-gray-300">Nothing executed</span>
      )}
    </span>
  );
}

/**
 * Recent runs.
 *
 * Shows repo + branch rather than a raw run id: a bare UUID prefix told the
 * user nothing about which run they were looking at, which made the history
 * useless for picking one out. Repo names come from the indexed-repos
 * lookup, since a run doc only carries repoId.
 */
export default function RecentRuns({ runs, repoNames, activeRunId, onSelect, limit = 10 }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-6 text-center">
        <History size={18} className="mx-auto text-gray-300 mb-1.5" />
        <p className="text-sm text-gray-400">No runs yet.</p>
        <p className="text-xs text-gray-300 mt-0.5">Pick a repository above to start your first one.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <History size={14} /> Recent runs
        </h3>
        <span className="text-xs text-gray-400">{runs.length} total</span>
      </div>

      <ul className="divide-y max-h-[420px] overflow-y-auto">
        {runs.slice(0, limit).map((run) => {
          const isActive = run.runId === activeRunId;
          const statusKey = ['completed', 'failed', 'cancelled', 'queued'].includes(run.status)
            ? run.status
            : 'running';
          const meta = STATUS_META[statusKey];
          const StatusIcon = meta.icon;
          const duration = fmtDuration(run.createdAt, run.finishedAt);
          const repoName = repoNames?.[run.repoId];

          return (
            <li key={run.runId}>
              <button
                onClick={() => onSelect(run.runId)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  isActive ? 'bg-orange-50/60' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${meta.bg}`}>
                  <StatusIcon
                    size={14}
                    className={`${meta.tone} ${statusKey === 'running' ? 'animate-spin' : ''}`}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {repoName || 'Unknown repo'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                      <GitBranch size={10} /> {run.branch}
                    </span>
                  </span>
                  <span className="block mt-1"><Outcome run={run} /></span>
                </span>

                <span className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-[11px] text-gray-400">
                  <span>{fmtRelative(run.createdAt)}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {duration && <span className="flex items-center gap-0.5"><Clock size={9} />{duration}</span>}
                    {run.costUsd > 0 && (
                      <span className="flex items-center gap-0.5"><Coins size={9} />${run.costUsd.toFixed(3)}</span>
                    )}
                  </span>
                </span>

                <ChevronRight size={14} className={`shrink-0 ${isActive ? 'text-orange-400' : 'text-gray-300'}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
