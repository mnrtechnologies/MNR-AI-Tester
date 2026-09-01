import React, { useEffect, useState } from 'react';
import { Lock, Loader2, GitBranch, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../api';

/**
 * Screen 2 — pick a repo + branch, then index it.
 *
 * "Index" clones the repo server-side and returns a tree snapshot (see
 * app.py's POST /repos/index) — this is what the path selector (screen 3)
 * renders. Re-indexing is always safe/idempotent: it just clones fresh and
 * overwrites the stored snapshot.
 */
export default function RepoPicker({ onIndexed }) {
  const [repos, setRepos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchesByRepo, setBranchesByRepo] = useState({});
  const [selectedBranch, setSelectedBranch] = useState({});
  const [indexingRepo, setIndexingRepo] = useState(null);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/github/repos');
      setRepos(data);
    } catch (err) {
      toast.error(err.message || 'Could not load your GitHub repositories.');
      setRepos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBranches = async (repo) => {
    if (branchesByRepo[repo.fullName]) return;
    try {
      const branches = await apiFetch(`/github/repos/${repo.fullName}/branches`);
      setBranchesByRepo((prev) => ({ ...prev, [repo.fullName]: branches }));
      setSelectedBranch((prev) => ({ ...prev, [repo.fullName]: prev[repo.fullName] || repo.defaultBranch }));
    } catch (err) {
      toast.error(err.message || `Could not load branches for ${repo.fullName}.`);
    }
  };

  const handleIndex = async (repo) => {
    const branch = selectedBranch[repo.fullName] || repo.defaultBranch;
    setIndexingRepo(repo.fullName);
    try {
      const result = await apiFetch('/repos/index', {
        method: 'POST',
        body: JSON.stringify({
          fullName: repo.fullName,
          branch,
          githubRepoId: repo.id,
          private: repo.private,
          defaultBranch: repo.defaultBranch,
        }),
      });
      toast.success(`Indexed ${repo.fullName} (${result.fileCount} files).`);
      onIndexed({ ...result, fullName: repo.fullName, branch });
    } catch (err) {
      toast.error(err.message || `Failed to index ${repo.fullName}.`);
    } finally {
      setIndexingRepo(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
        <Loader2 className="animate-spin" size={16} /> Loading your repositories…
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-800">Select a repository</h3>
        <button onClick={loadRepos} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50">
          <RefreshCw size={16} />
        </button>
      </div>
      <ul className="divide-y max-h-[420px] overflow-y-auto">
        {repos.length === 0 && (
          <li className="p-6 text-center text-sm text-gray-400">No repositories found on this GitHub account.</li>
        )}
        {repos.map((repo) => (
          <li key={repo.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1" onClick={() => loadBranches(repo)}>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-800 truncate">{repo.fullName}</p>
                {repo.private && <Lock size={12} className="text-gray-400 shrink-0" />}
              </div>
              {repo.description && <p className="text-xs text-gray-400 truncate">{repo.description}</p>}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-sm text-gray-500 border rounded-lg px-2 py-1.5">
                <GitBranch size={14} />
                <select
                  className="bg-transparent outline-none text-sm"
                  value={selectedBranch[repo.fullName] || repo.defaultBranch}
                  onFocus={() => loadBranches(repo)}
                  onChange={(e) => setSelectedBranch((prev) => ({ ...prev, [repo.fullName]: e.target.value }))}
                >
                  {(branchesByRepo[repo.fullName] || [repo.defaultBranch]).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleIndex(repo)}
                disabled={indexingRepo === repo.fullName}
                className="bg-orange-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-60 flex items-center gap-1.5"
              >
                {indexingRepo === repo.fullName && <Loader2 className="animate-spin" size={14} />}
                Index
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
