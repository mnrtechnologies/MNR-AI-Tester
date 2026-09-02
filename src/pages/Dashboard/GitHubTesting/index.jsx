import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Github, ChevronLeft } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { apiFetch } from './api';
import ConnectGitHub from './components/ConnectGitHub';
import GitHubAccountBadge from './components/GitHubAccountBadge';
import CreditBalanceBadge from './components/CreditBalanceBadge';
import Sidebar from './components/Sidebar';
import RepoOverview from './components/RepoOverview';
import RepoPicker from './components/RepoPicker';
import PathSelector from './components/PathSelector';
import UploadCode from './components/UploadCode';
import RunDetail from './components/RunDetail';

// Keeps sidebar status current while a run is in flight, so navigation and
// the detail pane agree instead of the list showing a stale "running".
const RUNS_POLL_MS = 5000;

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

// What the right-hand pane is showing. Replaces the old one-way wizard: any
// of these is reachable at any time from the sidebar, so you can open an old
// run while another is still going.
const PANE = {
  CONNECT: 'connect',   // legacy alias for NEW; kept so old state cannot blank the page
  NEW: 'new',           // choosing / indexing a repository
  REPO: 'repo',         // a repository's overview + its runs
  CONFIGURE: 'configure', // picking files and starting a run
  RUN: 'run',           // one run's detail
};

export default function GitHubTesting() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [pane, setPane] = useState(PANE.NEW);
  const [repos, setRepos] = useState([]);
  const [runs, setRuns] = useState([]);
  const [activeRepo, setActiveRepo] = useState(null);   // full repo doc
  const [activeRunId, setActiveRunId] = useState(null);
  const [indexedRepo, setIndexedRepo] = useState(null); // tree payload for the file picker
  const [reindexing, setReindexing] = useState(false);

  // Held in memory for this page session only so a re-run doesn't re-prompt
  // for a key the user already typed. Deliberately NOT localStorage — a
  // provider API key sitting in browser storage is a real leak surface.
  const [sessionKey, setSessionKey] = useState('');
  const pollRef = useRef(null);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const s = await apiFetch('/github/status');
      setStatus(s);
      // Not being connected to GitHub is no longer a dead end — code can be
      // uploaded from the user's machine instead — so the shell stays
      // available either way and CONNECT is only ever a starting point.
      setPane((p) => (p === PANE.CONNECT ? PANE.NEW : p));
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const refreshRepos = useCallback(async () => {
    try {
      setRepos(await apiFetch('/repos'));
    } catch {
      // Sidebar simply shows nothing; never blocks the main flow.
    }
  }, []);

  const refreshRuns = useCallback(async () => {
    try {
      const list = await apiFetch('/runs');
      // Guarded because a non-array here crashes the whole page on the next
      // render (runs.some(...)), which shows as a blank screen with no clue
      // what went wrong — the same failure mode as the dead CONNECT pane.
      const safe = Array.isArray(list) ? list : [];
      setRuns(safe);
      return safe;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshRepos();
    refreshRuns();
  }, [refreshStatus, refreshRepos, refreshRuns]);

  // Poll only while something is actually in flight.
  useEffect(() => {
    const anyActive = runs.some((r) => !TERMINAL.has(r.status));
    clearTimeout(pollRef.current);
    if (!anyActive) return undefined;
    pollRef.current = setTimeout(refreshRuns, RUNS_POLL_MS);
    return () => clearTimeout(pollRef.current);
  }, [runs, refreshRuns]);

  const runsFor = (repoId) => runs.filter((r) => r.repoId === repoId);

  const openRepo = useCallback(async (repo) => {
    setActiveRepo(repo);
    setActiveRunId(null);
    setPane(PANE.REPO);
  }, []);

  const openRun = useCallback((runId) => {
    setActiveRunId(runId);
    // Keep the sidebar expanded on the repo this run belongs to.
    const run = runs.find((r) => r.runId === runId);
    if (run) {
      const repo = repos.find((x) => x.repoId === run.repoId);
      if (repo) setActiveRepo(repo);
    }
    setPane(PANE.RUN);
    refreshRuns();
  }, [runs, repos, refreshRuns]);

  const handleIndexed = (payload) => {
    // payload carries the freshly-built tree the file picker needs.
    setIndexedRepo(payload);
    setPane(PANE.CONFIGURE);
    refreshRepos();
  };

  /** Re-read an already-known repo so the picker has a current tree. */
  const configureExistingRepo = async (repo) => {
    setReindexing(true);
    try {
      // An uploaded project has no branch to re-resolve and nothing to
      // re-clone — the stored archive IS the code. Re-indexing it would mean
      // asking the user to upload the same file again, so the saved tree is
      // read back instead.
      if (repo.source === 'upload') {
        const tree = await apiFetch(`/repos/${repo.repoId}/tree`);
        setIndexedRepo({
          repoId: repo.repoId,
          fullName: repo.fullName,
          branch: 'upload',
          source: 'upload',
          tree: tree.tree,
          detectedStack: tree.detectedStack,
          commitSha: tree.lastIndexedCommit,
        });
        setPane(PANE.CONFIGURE);
        return;
      }

      const result = await apiFetch('/repos/index', {
        method: 'POST',
        body: JSON.stringify({
          fullName: repo.fullName,
          branch: repo.lastIndexedBranch || repo.defaultBranch,
          githubRepoId: repo.githubRepoId || 0,
          private: repo.private || false,
          defaultBranch: repo.defaultBranch,
        }),
      });
      setIndexedRepo({
        ...result,
        fullName: repo.fullName,
        branch: repo.lastIndexedBranch || repo.defaultBranch,
      });
      setPane(PANE.CONFIGURE);
      refreshRepos();
    } catch (err) {
      toast.error(err.message || 'Could not read that repository.');
    } finally {
      setReindexing(false);
    }
  };

  const deleteUploadedRepo = async (repo) => {
    if (!window.confirm(`Delete "${repo.fullName}"? The uploaded code is removed from the server and its runs can no longer be re-run.`)) return;
    try {
      await apiFetch(`/repos/${repo.repoId}`, { method: 'DELETE' });
      toast.success('Project removed.');
      setActiveRepo(null);
      setPane(PANE.NEW);
      refreshRepos();
    } catch (err) {
      toast.error(err.message || 'Could not remove that project.');
    }
  };

  const handleRunStarted = (runId) => {
    setActiveRunId(runId);
    setPane(PANE.RUN);
    refreshRuns();
  };

  const handleDisconnected = () => {
    // Drop everything tied to the old account so a reconnect starts clean.
    setStatus({ connected: false });
    // Uploaded projects belong to the user, not to the GitHub account, so
    // they survive a disconnect. Re-reading the list keeps them and drops
    // only what came from GitHub.
    refreshRepos();
    setRuns([]);
    setActiveRepo(null);
    setActiveRunId(null);
    setIndexedRepo(null);
    setSessionKey('');
    // NOT PANE.CONNECT. Disconnecting GitHub must not strand the user:
    // uploading from their own machine is still fully available, and sending
    // them to a connect-only pane made the page look broken and forced a
    // reconnect just to upload a file.
    setPane(PANE.NEW);
  };

  const connected = status?.connected;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <Toaster position="top-right" />

      <header className="flex items-center justify-between gap-3 px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Github size={20} className="text-gray-800 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight">GitHub Code Testing</h1>
            <p className="text-[11px] text-gray-400 truncate">
              AI reads your code’s business logic, then tests it against what it claims to do.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <CreditBalanceBadge />
          <GitHubAccountBadge status={status} onDisconnected={handleDisconnected} />
        </div>
      </header>

      {(
        <div className="flex-1 flex min-h-0">
          <Sidebar
            repos={repos}
            runs={runs}
            activeRunId={pane === PANE.RUN ? activeRunId : null}
            activeRepoId={activeRepo?.repoId}
            onNewRun={() => { setActiveRunId(null); setPane(PANE.NEW); }}
            onSelectRepo={openRepo}
            onSelectRun={openRun}
          />

          <main className="flex-1 overflow-y-auto min-w-0">
            {/* CONNECT is treated as NEW rather than given its own branch: it
                has no separate screen any more, and a pane with no matching
                branch renders an empty page with no way out. */}
            {(pane === PANE.NEW || pane === PANE.CONNECT) && (
              <div className="p-6 max-w-3xl space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-800 mb-1">Start a new run</h2>
                  <p className="text-xs text-gray-400">
                    Bring your code from GitHub or straight from your computer — everything after
                    this point is the same either way.
                  </p>
                </div>

                {/* Upload first: it is the path that needs no account and no
                    setup, so it should not be buried under a connect flow. */}
                <UploadCode onIndexed={handleIndexed} />

                <div className="flex items-center gap-3">
                  <div className="h-px bg-gray-200 flex-1" />
                  <span className="text-[11px] uppercase tracking-wide text-gray-400">or</span>
                  <div className="h-px bg-gray-200 flex-1" />
                </div>

                {connected ? (
                  <RepoPicker onIndexed={handleIndexed} />
                ) : (
                  <ConnectGitHub
                    status={status}
                    loadingStatus={loadingStatus}
                    onStatusChange={refreshStatus}
                  />
                )}
              </div>
            )}

            {pane === PANE.REPO && activeRepo && (
              <RepoOverview
                repo={activeRepo}
                runs={runsFor(activeRepo.repoId)}
                reindexing={reindexing}
                onStartRun={() => configureExistingRepo(activeRepo)}
                onReindex={() => configureExistingRepo(activeRepo)}
                onDelete={() => deleteUploadedRepo(activeRepo)}
                onSelectRun={openRun}
              />
            )}

            {pane === PANE.CONFIGURE && indexedRepo && (
              <div className="p-6">
                <button
                  onClick={() => (activeRepo ? setPane(PANE.REPO) : setPane(PANE.NEW))}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <PathSelector
                  repo={indexedRepo}
                  onRunStarted={handleRunStarted}
                  onKeyChange={setSessionKey}
                />
              </div>
            )}

            {pane === PANE.RUN && activeRunId && (
              <div className="p-6">
                <RunDetail
                  runId={activeRunId}
                  onOpenRun={openRun}
                  sessionKey={sessionKey}
                  onKeyChange={setSessionKey}
                />
              </div>
            )}

            {pane === PANE.REPO && !activeRepo && (
              <div className="p-6 text-sm text-gray-400">Select a repository from the left.</div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
