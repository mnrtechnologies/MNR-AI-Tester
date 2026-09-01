import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Play, Loader2, KeyRound, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, estimateTokens } from '../api';
import { estimateCreditsForSelection } from '../../../../config/pricing/codeTestMath';
import { creditPreflight } from '../../../../services/operations/creditAPIs';
import EnvVarsEditor, { envVarsToObject } from './EnvVarsEditor';

const LANGUAGE_DOT_COLOR = {
  python: 'bg-blue-400',
  javascript: 'bg-yellow-400',
  typescript: 'bg-sky-500',
  java: 'bg-orange-500',
};

/** Collects every file path under a node (used when a directory checkbox is toggled). */
function collectFilePaths(node, acc = []) {
  if (node.type === 'file') {
    acc.push(node);
  } else {
    (node.children || []).forEach((c) => collectFilePaths(c, acc));
  }
  return acc;
}

function TreeNode({ node, depth, selected, onToggle }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === 'dir';
  const files = useMemo(() => (isDir ? collectFilePaths(node) : [node]), [node, isDir]);
  const selectedCount = files.filter((f) => selected.has(f.path)).length;
  const checked = selectedCount === files.length && files.length > 0;
  const indeterminate = selectedCount > 0 && selectedCount < files.length;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-gray-50 cursor-pointer select-none"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {isDir ? (
          <span onClick={() => setExpanded((e) => !e)} className="text-gray-400">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-[14px]" />
        )}
        <input
          type="checkbox"
          checked={checked}
          ref={(el) => { if (el) el.indeterminate = indeterminate; }}
          onChange={() => onToggle(files, !checked)}
          className="accent-orange-500"
        />
        {isDir ? <Folder size={14} className="text-gray-400" /> : <File size={14} className="text-gray-400" />}
        <span className="text-sm text-gray-700 truncate">{node.name}</span>
        {!isDir && node.language && (
          <span className={`w-1.5 h-1.5 rounded-full ml-1 ${LANGUAGE_DOT_COLOR[node.language] || 'bg-gray-300'}`} />
        )}
      </div>
      {isDir && expanded && (
        <div>
          {(node.children || []).map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} selected={selected} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

const PROVIDERS = [
  { value: 'anthropic', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI' },
];

/**
 * Screen 3 — pick folders/files from the indexed tree, choose a provider +
 * bring-your-own API key, and start a run.
 *
 * The token estimate here is a client-side approximation (see
 * api.js#estimateTokens) purely to give the user a cost signal before they
 * commit — the real, billed count comes from the chosen provider's own
 * tokenizer server-side during the analysis stage.
 */
export default function PathSelector({ repo, onRunStarted, onKeyChange }) {
  const [selected, setSelected] = useState(new Set());
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [envVars, setEnvVars] = useState([]);
  const [starting, setStarting] = useState(false);

  const handleToggle = (files, shouldSelect) => {
    setSelected((prev) => {
      const next = new Set(prev);
      files.forEach((f) => (shouldSelect ? next.add(f.path) : next.delete(f.path)));
      return next;
    });
  };

  const selectedBytes = useMemo(() => {
    const byPath = {};
    const walk = (node) => {
      if (node.type === 'file') byPath[node.path] = node.sizeBytes || 0;
      else (node.children || []).forEach(walk);
    };
    walk(repo.tree);
    return [...selected].reduce((sum, p) => sum + (byPath[p] || 0), 0);
  }, [repo.tree, selected]);

  // An UPPER bound, not a forecast. estimateCreditsForSelection assumes one
  // generated test file per analysed file — the worst case — because a quote
  // that under-promises and then bills more is the one users are entitled to
  // be angry about. Cache hits make the real charge lower, never higher.
  const creditEstimate = useMemo(
    () => estimateCreditsForSelection(selected.size),
    [selected.size],
  );

  const handleStart = async () => {
    if (selected.size === 0) {
      toast.error('Select at least one file or folder.');
      return;
    }
    if (!apiKey.trim()) {
      toast.error(`Enter your ${provider === 'anthropic' ? 'Claude' : 'OpenAI'} API key.`);
      return;
    }
    setStarting(true);
    try {
      // Asked of Express, not of the Python engine. The engine is
      // unauthenticated and the browser posts to it directly, so a gate the
      // ENGINE enforced could be bypassed by skipping the browser — and a
      // gate this component enforced from the balance it happens to hold
      // would be pure theatre. The decision is the server's; this call is
      // how we ask for it, and the estimate above is only ever displayed.
      const preflight = await creditPreflight();
      if (!preflight?.ok) {
        if (preflight?.code === 'INSUFFICIENT_CREDITS') {
          toast.error(
            preflight.message ||
              "You don't have enough credits to start a code test.",
          );
          return;
        }
        throw new Error(preflight?.message || 'Could not verify your credit balance.');
      }

      const { runId } = await apiFetch('/runs', {
        method: 'POST',
        body: JSON.stringify({
          repoId: repo.repoId,
          // Never send undefined: the field is required server-side, and a
          // missing one produces a validation error rather than a useful
          // message. Uploads have no real branch, hence the literal.
          branch: repo.branch || (repo.source === 'upload' ? 'upload' : repo.defaultBranch),
          paths: [...selected],
          provider,
          apiKey: apiKey.trim(),
          envVars: envVarsToObject(envVars),
        }),
      });
      // Carry the key into this page session so a later re-run doesn't
      // re-prompt for something the user just typed (memory only).
      onKeyChange?.(apiKey.trim());
      toast.success('Run started.');
      onRunStarted(runId);
    } catch (err) {
      toast.error(err.message || 'Could not start the run.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-white border rounded-xl">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Select the code to test</h3>
          <p className="text-xs text-gray-400">
            {repo.fullName}{repo.source === 'upload' ? ' · uploaded' : ` @ ${repo.branch}`}
          </p>
        </div>
        <div className="p-2 max-h-[480px] overflow-y-auto">
          <TreeNode node={repo.tree} depth={0} selected={selected} onToggle={handleToggle} />
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 h-fit space-y-4">
        <div>
          <p className="text-sm text-gray-500">Selected</p>
          <p className="text-lg font-semibold text-gray-800">
            {selected.size} file{selected.size === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-gray-400">~{estimateTokens(selectedBytes).toLocaleString()} tokens (estimate)</p>
          {selected.size > 0 && (
            <div className="mt-2 pt-2 border-t flex items-baseline gap-1.5">
              <Coins size={12} className="text-gray-400 self-center" />
              <span className="text-sm font-semibold text-gray-700 tabular-nums">
                up to {creditEstimate}
              </span>
              <span className="text-xs text-gray-400">
                credit{creditEstimate === 1 ? '' : 's'}
              </span>
            </div>
          )}
          {selected.size > 0 && (
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Credits meter our capacity. Files already analysed at this commit
              are reused, so a re-run costs less. Your provider bills the API
              key separately.
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">LLM Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">
            <KeyRound size={12} className="inline mr-1" />
            {provider === 'anthropic' ? 'Claude' : 'OpenAI'} API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-gray-400 mt-1">Encrypted at rest, used only for this run.</p>
        </div>

        <EnvVarsEditor vars={envVars} onChange={setEnvVars} />

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-60"
        >
          {starting ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
          Run Analysis &amp; Tests
        </button>
      </div>
    </div>
  );
}
