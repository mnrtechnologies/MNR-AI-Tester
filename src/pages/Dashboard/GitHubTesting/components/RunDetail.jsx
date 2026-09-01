import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  XCircle, FileText, FlaskConical, Bug, Coins, GitCommit,
  RotateCw, ArrowRight, TrendingDown, TrendingUp, Minus, Ban, Loader2, KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, fmtDate } from '../api';
import { creditsAccruedSoFar } from '../../../../config/pricing/codeTestMath';
import StageProgress, { isTerminal } from './StageProgress';
import BusinessLogicTab from './BusinessLogicTab';
import GeneratedTestsTab from './GeneratedTestsTab';
import ResultsTab from './ResultsTab';
import RerunDialog from './RerunDialog';

/**
 * Before/after strip shown when this run was launched as a re-run of another.
 * This is the payoff of re-running at all — "did the thing I just fixed
 * actually get fixed?" is answerable at a glance instead of by opening two
 * runs side by side.
 */
function RerunComparison({ previous, current }) {
  if (!previous?.summary || !current?.summary) return null;

  const rows = [
    { label: 'Code bugs', before: previous.summary.codeBugs || 0, after: current.summary.codeBugs || 0, lowerIsBetter: true },
    { label: 'Passed', before: previous.summary.totals?.passed || 0, after: current.summary.totals?.passed || 0, lowerIsBetter: false },
    { label: 'Test issues', before: previous.summary.testIssues || 0, after: current.summary.testIssues || 0, lowerIsBetter: true },
    { label: 'Contradictions', before: previous.summary.contradictions || 0, after: current.summary.contradictions || 0, lowerIsBetter: true },
  ];

  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
        <RotateCw size={11} /> Compared with the run this was launched from
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map(({ label, before, after, lowerIsBetter }) => {
          const delta = after - before;
          const improved = lowerIsBetter ? delta < 0 : delta > 0;
          const worse = lowerIsBetter ? delta > 0 : delta < 0;
          const Icon = delta === 0 ? Minus : improved ? TrendingDown : TrendingUp;
          const tone = delta === 0 ? 'text-gray-400' : improved ? 'text-green-600' : worse ? 'text-red-600' : 'text-gray-400';
          return (
            <div key={label}>
              <p className="text-[11px] text-gray-400">{label}</p>
              <p className="text-sm font-semibold text-gray-700 tabular-nums flex items-center gap-1">
                {before} <ArrowRight size={11} className="text-gray-300" /> {after}
                <span className={`flex items-center gap-0.5 text-[11px] ${tone}`}>
                  <Icon size={11} />
                  {delta !== 0 && Math.abs(delta)}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// This engine has no WebSocket relay, so polling is the whole live-update
// mechanism (same precedent as APITesting.jsx). 3s keeps the analysis/test
// panels visibly filling in without hammering the API.
const POLL_MS = 3000;

const TABS = [
  { key: 'logic',   label: 'Business Logic',  icon: FileText },
  { key: 'tests',   label: 'Generated Tests', icon: FlaskConical },
  { key: 'results', label: 'Results',         icon: Bug },
];

export default function RunDetail({ runId, onOpenRun, sessionKey, onKeyChange }) {
  const [run, setRun] = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [tests, setTests] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRerun, setShowRerun] = useState(false);
  const [previousRun, setPreviousRun] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Start on Business Logic, not Results. Results is empty for most of a
  // run's life, so defaulting there made a working run look like it had
  // finished and found nothing.
  const [tab, setTab] = useState('logic');
  const userPickedTab = useRef(false);
  const autoSwitched = useRef(false);
  const [now, setNow] = useState(Date.now());

  const selectTab = (key) => {
    userPickedTab.current = true;
    setTab(key);
  };

  // One poll cycle fetches everything, so all three tabs stay live while the
  // run is in flight — previously each tab fetched once on mount and never
  // again, so anything produced after that first render never appeared.
  const pollOnce = useCallback(async () => {
    try {
      const r = await apiFetch(`/runs/${runId}`);
      setRun(r);

      const [a, t, res] = await Promise.all([
        apiFetch(`/runs/${runId}/analysis`).catch(() => null),
        apiFetch(`/runs/${runId}/tests`).catch(() => null),
        apiFetch(`/runs/${runId}/results`).catch(() => null),
      ]);
      if (a) setAnalyses(a);
      if (t) setTests(t);
      if (res) setResults(res);

      return r;
    } catch (err) {
      toast.error(err.message || 'Could not load run status.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    let timer;

    // Reset per-run so switching runs from history does not inherit the
    // previous run's data or auto-switch state.
    setLoading(true);
    setRun(null); setAnalyses(null); setTests(null); setResults(null);
    setTab('logic');
    userPickedTab.current = false;
    autoSwitched.current = false;

    const loop = async () => {
      const r = await pollOnce();
      if (cancelled) return;
      if (!r || !isTerminal(r.status)) timer = setTimeout(loop, POLL_MS);
    };
    loop();

    return () => { cancelled = true; clearTimeout(timer); };
  }, [runId, pollOnce]);

  // Live elapsed clock — only ticks while the run is actually in flight.
  useEffect(() => {
    if (run && isTerminal(run.status)) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run]);

  // Move to Results exactly once, and only when there is something real to
  // show there — never yanking the user off a tab they chose themselves.
  useEffect(() => {
    if (autoSwitched.current || userPickedTab.current) return;
    if (run && isTerminal(run.status) && (results?.results?.length || 0) > 0) {
      autoSwitched.current = true;
      setTab('results');
    }
  }, [run, results]);

  // Fetch the run this one was launched from, once it is finished, so the
  // before/after strip has a baseline to compare against.
  useEffect(() => {
    const priorId = run?.rerunOf;
    if (!priorId || !isTerminal(run.status)) return;
    let cancelled = false;
    apiFetch(`/runs/${priorId}`)
      .then((r) => { if (!cancelled) setPreviousRun(r); })
      .catch(() => { /* the earlier run may have been deleted; the strip just won't render */ });
    return () => { cancelled = true; };
  }, [run?.rerunOf, run?.status]);

  const handleCancel = async () => {
    // A run costs real money per stage, so confirm rather than making an
    // accidental click discard minutes of paid work.
    if (!window.confirm('Cancel this run? Work already done is kept, but the run will stop here.')) return;
    setCancelling(true);
    try {
      await apiFetch(`/runs/${runId}/cancel`, { method: 'POST' });
      toast.success('Run cancelled.');
      await pollOnce(); // reflect the new status immediately
    } catch (err) {
      toast.error(err.message || 'Could not cancel the run.');
    } finally {
      setCancelling(false);
    }
  };

  if (!run) {
    return <div className="bg-white border rounded-xl p-8 text-center text-sm text-gray-400">Loading run…</div>;
  }

  const running = !isTerminal(run.status);
  const providerLabel = run.provider === 'anthropic' ? 'Claude' : 'OpenAI';

  // What this run has cost in PLATFORM credits.
  //
  // Once settled, `chargedCredits` is the invoice and nothing else may
  // override it — including a zero, which is a real answer for a run that
  // predates billing or had no subscription to charge.
  //
  // While in flight, the reconciler's live meter only writes every 15s, so
  // between passes the doc lags what has actually been earned. Falling back
  // to creditsAccruedSoFar — the very function the meter itself bills on —
  // keeps the figure moving with the work rather than stepping in visible
  // jumps, and cannot disagree with the eventual charge because it IS the
  // same calculation over the same facts.
  const creditsSoFar = run.billed === true
    ? (run.chargedCredits ?? null)
    : Math.max(run.meteredCredits || 0, creditsAccruedSoFar(run)) || null;

  // The backend raises LLMAuthError as "<Provider> rejected the API key: ..."
  // (llm/openai_provider.py, llm/anthropic_provider.py). Matched on that
  // wording plus the providers' own codes, so a key problem is presented as
  // something to fix rather than as a generic crash.
  const authFailure =
    run.status === 'failed' &&
    /rejected the API key|invalid_api_key|authentication_error|incorrect api key/i.test(run.error || '');
  const startedAt = run.createdAt ? new Date(run.createdAt).getTime() : null;
  const endedAt = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  const elapsedMs = startedAt ? Math.max(0, endedAt - startedAt) : null;

  const counts = {
    logic: analyses?.length || 0,
    tests: tests?.length || 0,
    results: results?.results?.length || 0,
  };

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-3 mb-4 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-3">
            <span>{fmtDate(run.createdAt)}</span>
            {run.commitSha && (
              <span className="flex items-center gap-1 font-mono">
                <GitCommit size={12} /> {run.commitSha.slice(0, 7)}
              </span>
            )}
            <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{run.provider}</span>
          </span>
          <span className="flex items-center gap-3">
            {/* Two different currencies, kept visually apart on purpose.
                $ and tokens are what the CUSTOMER'S provider charged them for
                their own key; credits are what WE charge for capacity. Running
                them together as one "cost" would misstate both. */}
            {run.costUsd > 0 && (
              <span className="flex items-center gap-1 tabular-nums" title="Your provider's charge for your own API key">
                <Coins size={12} /> ${run.costUsd.toFixed(4)}
              </span>
            )}
            {(run.inputTokens > 0 || run.outputTokens > 0) && (
              <span className="tabular-nums">
                {((run.inputTokens || 0) + (run.outputTokens || 0)).toLocaleString()} tokens
              </span>
            )}
            {creditsSoFar != null && (
              <span
                className="tabular-nums font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                title="Platform credits — metered as the run proceeds, settled when it finishes"
              >
                {creditsSoFar.toLocaleString()} credit{creditsSoFar === 1 ? '' : 's'}
                {running ? ' so far' : ''}
              </span>
            )}
          </span>
        </div>

        {run.rerunOf && (
          <p className="text-[11px] text-gray-400 mb-2 flex items-center gap-1">
            <RotateCw size={10} /> Re-run of an earlier run
            {onOpenRun && (
              <button
                onClick={() => onOpenRun(run.rerunOf)}
                className="text-orange-600 hover:underline font-mono"
              >
                {run.rerunOf.slice(0, 8)}
              </button>
            )}
          </p>
        )}

        <StageProgress stage={run.stage} status={run.status} elapsedMs={elapsedMs} progress={run.progress} />

        {run.status === 'failed' && run.error && (
          authFailure ? (
            /* An invalid key is the one failure the user can fix in ten
               seconds, so it gets its own affordance instead of being buried
               in a wall of raw provider JSON (which also echoed the whole
               rejected key back at them). */
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <KeyRound size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-800">
                    Your {providerLabel} API key was rejected
                  </p>
                  <p className="text-xs text-amber-700/90 mt-0.5">
                    {providerLabel} returned “invalid API key”, so nothing was analysed and you were not
                    charged. Enter a working key to run this again — everything else is remembered.
                  </p>
                  <button
                    onClick={() => { onKeyChange?.(''); setShowRerun(true); }}
                    className="mt-2 flex items-center gap-1.5 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800"
                  >
                    <KeyRound size={13} /> Enter a new key and retry
                  </button>
                </div>
              </div>
              <details className="mt-2">
                <summary className="text-[11px] text-amber-700/70 cursor-pointer">
                  Show the provider’s raw response
                </summary>
                <p className="text-[11px] text-amber-800/80 break-all mt-1 font-mono">{run.error}</p>
              </details>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
              <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 break-words">{run.error}</p>
            </div>
          )
        )}

        {previousRun && (
          <div className="mt-3">
            <RerunComparison previous={previousRun} current={run} />
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {/* Cancel while in flight; re-run only once it is over (re-running a
              live run would just race it for the same repo). */}
          {running ? (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-60"
            >
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              {cancelling ? 'Cancelling…' : 'Cancel run'}
            </button>
          ) : (
            <button
              onClick={() => setShowRerun(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-1.5 hover:bg-gray-50"
            >
              <RotateCw size={14} />
              {run.status === 'failed' ? 'Try again' : 'Re-run'}
            </button>
          )}
        </div>

        {run.status === 'cancelled' && (
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
            <Ban size={12} /> Cancelled — anything analysed before you stopped it is still shown below.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => selectTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={14} /> {label}
            {counts[key] > 0 && (
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                tab === key ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {tab === 'logic' && (
          <BusinessLogicTab
            analyses={analyses}
            loading={loading}
            running={running}
            incomplete={run.analysisIncomplete}
            progress={run.progress}
          />
        )}
        {tab === 'tests' && <GeneratedTestsTab tests={tests} loading={loading} running={running} stage={run.stage} />}
        {tab === 'results' && (
          <ResultsTab
            data={results}
            analyses={analyses}
            tests={tests}
            loading={loading}
            running={running}
            stage={run.stage}
          />
        )}
      </div>

      {showRerun && (
        <RerunDialog
          run={run}
          // Don't prefill a key the provider just rejected -- offering the
          // known-bad value back invites hitting Re-run and failing again.
          sessionKey={authFailure ? '' : sessionKey}
          keyRejected={authFailure}
          onKeyChange={onKeyChange}
          onClose={() => setShowRerun(false)}
          onStarted={(newRunId) => {
            setShowRerun(false);
            onOpenRun?.(newRunId);
          }}
        />
      )}
    </div>
  );
}
