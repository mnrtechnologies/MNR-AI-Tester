import React, { useState } from 'react';
import { RotateCw, Loader2, X, KeyRound, GitCommit } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../api';
import { creditPreflight } from '../../../../services/operations/creditAPIs';
import EnvVarsEditor, { envVarsToObject } from './EnvVarsEditor';

/**
 * Re-run an earlier run with the same repo, branch, file selection and
 * provider.
 *
 * The API key has to be asked for again every time: it is deliberately never
 * persisted (see the backend's StartRunRequest), so there is nothing to
 * carry over. `sessionKey` lets the parent hold the key the user already
 * typed earlier in this browsing session so they aren't re-prompted on every
 * re-run — kept in React state only, never written to localStorage, since a
 * provider key sitting in browser storage is a real leak surface.
 */
export default function RerunDialog({ run, sessionKey, keyRejected, onKeyChange, onClose, onStarted }) {
  const [apiKey, setApiKey] = useState(sessionKey || '');
  const [envVars, setEnvVars] = useState([]);
  const [useOriginalCommit, setUseOriginalCommit] = useState(false);
  const [starting, setStarting] = useState(false);

  const providerLabel = run.provider === 'anthropic' ? 'Claude' : 'OpenAI';

  const start = async () => {
    if (!apiKey.trim()) {
      toast.error(`Enter your ${providerLabel} API key.`);
      return;
    }
    setStarting(true);
    try {
      // A re-run is a run and costs credits like any other, so it goes
      // through the same gate as PathSelector. Without this the dialog would
      // be a way to keep starting work on an account with no balance left —
      // and a re-run is precisely what someone does repeatedly.
      const preflight = await creditPreflight();
      if (!preflight?.ok) {
        if (preflight?.code === 'INSUFFICIENT_CREDITS') {
          toast.error(
            preflight.message || "You don't have enough credits to start a re-run.",
          );
          return;
        }
        throw new Error(preflight?.message || 'Could not verify your credit balance.');
      }

      const { runId } = await apiFetch(`/runs/${run.runId}/rerun`, {
        method: 'POST',
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          envVars: envVarsToObject(envVars),
          useOriginalCommit,
        }),
      });
      onKeyChange?.(apiKey.trim());
      toast.success('Re-run started.');
      onStarted(runId);
    } catch (err) {
      toast.error(err.message || 'Could not start the re-run.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <RotateCw size={16} /> Re-run this analysis
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-xs text-gray-500 bg-gray-50 border rounded-lg p-3 space-y-1">
            <p><span className="text-gray-400">Branch:</span> <span className="font-mono">{run.branch}</span></p>
            <p>
              <span className="text-gray-400">Files:</span>{' '}
              {run.selectedPaths?.length || 0} previously selected
            </p>
            <p><span className="text-gray-400">Provider:</span> {providerLabel}</p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useOriginalCommit}
              onChange={(e) => setUseOriginalCommit(e.target.checked)}
              className="accent-orange-500 mt-0.5"
            />
            <span className="text-xs">
              <span className="font-medium text-gray-700 flex items-center gap-1">
                <GitCommit size={11} /> Pin to the original commit
              </span>
              <span className="block text-gray-400 mt-0.5">
                {useOriginalCommit
                  ? `Reproduces the original result exactly (${(run.commitSha || '').slice(0, 7)}).`
                  : 'Off: runs against the latest commit on this branch — use this to check whether a fix worked.'}
              </span>
            </span>
          </label>

          <div>
            <label className={`text-xs font-medium block mb-1 ${keyRejected ? 'text-amber-700' : 'text-gray-500'}`}>
              <KeyRound size={12} className="inline mr-1" />
              {providerLabel} API Key
              {keyRejected && <span className="ml-1 font-normal">— the previous one was rejected</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              // Focused when we are here BECAUSE the key failed: it is the
              // one thing that must change, so put the cursor in it.
              autoFocus={keyRejected}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                keyRejected ? 'border-amber-400 bg-amber-50/40' : ''
              }`}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {keyRejected
                ? 'Paste a working key — the repository, branch and file selection are unchanged.'
                : 'Keys are never stored, so this is needed again for each run.'}
            </p>
          </div>

          <EnvVarsEditor vars={envVars} onChange={setEnvVars} />
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            onClick={start}
            disabled={starting}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60"
          >
            {starting ? <Loader2 className="animate-spin" size={14} /> : <RotateCw size={14} />}
            Re-run
          </button>
        </div>
      </div>
    </div>
  );
}
