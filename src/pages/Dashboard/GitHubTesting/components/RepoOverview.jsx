import React from 'react';
import {
  Play, GitBranch, GitCommit, Bug, CheckCircle2, Wrench,
  AlertOctagon, Clock, RefreshCw, Loader2,
} from 'lucide-react';
import { fmtRelative, fmtDuration } from '../api';

function Stat({ label, value, tone = 'text-gray-800', hint }) {
  return (
    <div className="border rounded-lg p-3 bg-white" title={hint}>
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

/**
 * What you see when a repository is selected: its latest state and its runs.
 *
 * Exists because a repo used to be a transient wizard step -- you re-picked
 * and re-indexed it every time, and nothing showed what it currently looks
 * like. Making it a place you can return to is the point of the sidebar.
 */
export default function RepoOverview({ repo, runs, onStartRun, onSelectRun, onReindex, reindexing }) {
  const latest = runs[0];
  const lastCompleted = runs.find((r) => r.status === 'completed');
  const s = lastCompleted?.summary || {};
  const totals = s.totals || {};

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-800 truncate">{repo.fullName}</h2>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <GitBranch size={11} /> {repo.lastIndexedBranch || repo.defaultBranch}
            </span>
            {repo.lastIndexedCommit && (
              <span className="inline-flex items-center gap-1 font-mono">
                <GitCommit size={11} /> {repo.lastIndexedCommit.slice(0, 7)}
              </span>
            )}
            {repo.indexedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} /> indexed {fmtRelative(repo.indexedAt)}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onReindex}
            disabled={reindexing}
            title="Re-read the repository at its latest commit"
            className="flex items-center gap-1.5 text-sm text-gray-600 border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-60"
          >
            {reindexing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Re-index
          </button>
          <button
            onClick={onStartRun}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-gray-800"
          >
            <Play size={14} /> New run
          </button>
        </div>
      </div>

      {lastCompleted ? (
        <>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
            Last completed run · {fmtRelative(lastCompleted.createdAt)}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Contradictions" value={s.contradictions || 0}
                  tone={(s.contradictions || 0) > 0 ? 'text-red-600' : 'text-gray-300'}
                  hint="Places the code disagrees with its own documentation" />
            <Stat label="Code bugs" value={s.codeBugs || 0}
                  tone={(s.codeBugs || 0) > 0 ? 'text-red-600' : 'text-gray-300'}
                  hint="Contract/invariant tests the code failed" />
            <Stat label="Passed" value={totals.passed || 0}
                  tone={(totals.passed || 0) > 0 ? 'text-green-600' : 'text-gray-300'} />
            <Stat label="Coverage"
                  value={s.coverage && Object.keys(s.coverage).length
                    ? `${Object.values(s.coverage)[0]}%` : '—'}
                  tone="text-gray-700"
                  hint="Line coverage of the executed tests" />
          </div>
        </>
      ) : (
        <div className="rounded-xl border bg-white p-5 mb-6 text-center">
          <AlertOctagon size={18} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-600">No completed run yet for this repository.</p>
          <p className="text-xs text-gray-400 mt-1">
            Start one to get its business-logic analysis and generated tests.
          </p>
        </div>
      )}

      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
        Runs {runs.length > 0 && <span className="text-gray-300">({runs.length})</span>}
      </p>
      {runs.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing here yet.</p>
      ) : (
        <ul className="border rounded-xl divide-y bg-white overflow-hidden">
          {runs.map((run) => {
            const rs = run.summary || {};
            const rt = rs.totals || {};
            const duration = fmtDuration(run.createdAt, run.finishedAt);
            const running = !['completed', 'failed', 'cancelled'].includes(run.status);
            return (
              <li key={run.runId}>
                <button
                  onClick={() => onSelectRun(run.runId)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      {running && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-orange-600">
                          <Loader2 size={10} className="animate-spin" /> {run.stage}…
                        </span>
                      )}
                      {run.status === 'failed' && <span className="text-[11px] text-red-500">Did not finish</span>}
                      {run.status === 'cancelled' && <span className="text-[11px] text-gray-400">Cancelled</span>}
                      {run.status === 'completed' && (
                        <>
                          {(rs.codeBugs || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                              <Bug size={10} /> {rs.codeBugs} bug{rs.codeBugs === 1 ? '' : 's'}
                            </span>
                          )}
                          {(rt.passed || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                              <CheckCircle2 size={10} /> {rt.passed} passed
                            </span>
                          )}
                          {(rs.testIssues || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                              <Wrench size={10} /> {rs.testIssues} test issue{rs.testIssues === 1 ? '' : 's'}
                            </span>
                          )}
                          {!rs.codeBugs && !rt.passed && !rs.testIssues && (
                            <span className="text-[11px] text-gray-300">Nothing executed</span>
                          )}
                        </>
                      )}
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-1">
                      {fmtRelative(run.createdAt)}
                      {duration && ` · ${duration}`}
                      {run.costUsd > 0 && ` · $${run.costUsd.toFixed(3)}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
