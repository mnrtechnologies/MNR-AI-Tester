import React, { useState } from 'react';
import {
  Plus, ChevronRight, ChevronDown, FolderGit2, Loader2,
  CheckCircle2, XCircle, CircleSlash, Clock, Bug,
} from 'lucide-react';
import { fmtRelative } from '../api';

const STATUS_ICON = {
  completed: { icon: CheckCircle2, tone: 'text-green-600' },
  failed:    { icon: XCircle,      tone: 'text-red-500' },
  cancelled: { icon: CircleSlash,  tone: 'text-gray-400' },
  queued:    { icon: Clock,        tone: 'text-gray-400' },
  running:   { icon: Loader2,      tone: 'text-orange-500' },
};

function statusKey(status) {
  return ['completed', 'failed', 'cancelled', 'queued'].includes(status) ? status : 'running';
}

/** The shortest honest summary of a run, sized for a narrow column. */
function RunLabel({ run }) {
  if (!['completed'].includes(run.status)) {
    if (run.status === 'failed') return <span className="text-red-500">Did not finish</span>;
    if (run.status === 'cancelled') return <span className="text-gray-400">Cancelled</span>;
    return <span className="text-orange-600 capitalize">{run.stage}…</span>;
  }
  const s = run.summary || {};
  const bugs = s.codeBugs || 0;
  const passed = (s.totals || {}).passed || 0;
  if (bugs > 0) {
    return (
      <span className="text-red-600 inline-flex items-center gap-1">
        <Bug size={10} /> {bugs} bug{bugs === 1 ? '' : 's'}
      </span>
    );
  }
  if (passed > 0) return <span className="text-green-600">{passed} passed</span>;
  return <span className="text-gray-400">No results</span>;
}

function RepoNode({ repo, runs, activeRunId, activeRepoId, onSelectRepo, onSelectRun, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const isActiveRepo = activeRepoId === repo.repoId && !activeRunId;
  const activeCount = runs.filter((r) => !['completed', 'failed', 'cancelled'].includes(r.status)).length;

  return (
    <li>
      <div
        className={`flex items-center gap-1 pr-2 rounded-lg ${
          isActiveRepo ? 'bg-orange-50' : 'hover:bg-gray-100'
        }`}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button
          onClick={() => onSelectRepo(repo)}
          className="flex items-center gap-1.5 py-1.5 min-w-0 flex-1 text-left"
          title={repo.fullName}
        >
          <FolderGit2 size={13} className={isActiveRepo ? 'text-orange-500 shrink-0' : 'text-gray-400 shrink-0'} />
          <span className={`text-xs truncate ${isActiveRepo ? 'text-orange-700 font-medium' : 'text-gray-700'}`}>
            {/* Owner prefix is noise in a narrow column — the repo name is
                what distinguishes them; full path is in the title tooltip. */}
            {repo.fullName.split('/').pop()}
          </span>
        </button>
        {activeCount > 0 ? (
          <Loader2 size={11} className="animate-spin text-orange-500 shrink-0" />
        ) : runs.length > 0 ? (
          <span className="text-[10px] text-gray-400 shrink-0">{runs.length}</span>
        ) : null}
      </div>

      {open && (
        <ul className="ml-4 border-l pl-1">
          {runs.length === 0 && (
            <li className="text-[11px] text-gray-300 py-1.5 pl-2">no runs yet</li>
          )}
          {runs.map((run) => {
            const meta = STATUS_ICON[statusKey(run.status)];
            const Icon = meta.icon;
            const isActive = run.runId === activeRunId;
            return (
              <li key={run.runId}>
                <button
                  onClick={() => onSelectRun(run.runId)}
                  className={`w-full text-left flex items-start gap-1.5 px-2 py-1.5 rounded-lg ${
                    isActive ? 'bg-orange-50' : 'hover:bg-gray-100'
                  }`}
                >
                  <Icon
                    size={11}
                    className={`${meta.tone} shrink-0 mt-0.5 ${statusKey(run.status) === 'running' ? 'animate-spin' : ''}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] leading-tight truncate">
                      <RunLabel run={run} />
                    </span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      {fmtRelative(run.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/**
 * Persistent navigation: every repository, with its run history nested
 * underneath.
 *
 * Replaces the old bottom-of-page "Recent runs" list. History belongs in
 * navigation, not stacked under the content it competes with -- and this way
 * you can open another run while one is still going, which the previous
 * one-way wizard made impossible.
 */
export default function Sidebar({
  repos, runs, activeRunId, activeRepoId, onNewRun, onSelectRepo, onSelectRun,
}) {
  const runsByRepo = (runs || []).reduce((acc, r) => {
    (acc[r.repoId] = acc[r.repoId] || []).push(r);
    return acc;
  }, {});

  // Repos with the most recent activity first -- what you touched last is
  // what you are most likely to want next.
  const sorted = [...(repos || [])].sort((a, b) => {
    const at = runsByRepo[a.repoId]?.[0]?.createdAt || '';
    const bt = runsByRepo[b.repoId]?.[0]?.createdAt || '';
    return bt.localeCompare(at);
  });

  return (
    <aside className="w-60 shrink-0 border-r bg-gray-50/60 flex flex-col">
      <div className="p-3 border-b">
        <button
          onClick={onNewRun}
          className="w-full flex items-center justify-center gap-1.5 bg-gray-900 text-white text-xs font-medium py-2 rounded-lg hover:bg-gray-800"
        >
          <Plus size={14} /> New run
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-2 pb-1">
          Repositories
        </p>
        {sorted.length === 0 ? (
          <p className="text-[11px] text-gray-400 px-2 py-2">
            None yet — start with “New run”.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sorted.map((repo, i) => (
              <RepoNode
                key={repo.repoId}
                repo={repo}
                runs={runsByRepo[repo.repoId] || []}
                activeRunId={activeRunId}
                activeRepoId={activeRepoId}
                onSelectRepo={onSelectRepo}
                onSelectRun={onSelectRun}
                // Open the repo you are working in, or the most recent one.
                defaultOpen={activeRepoId ? repo.repoId === activeRepoId : i === 0}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
