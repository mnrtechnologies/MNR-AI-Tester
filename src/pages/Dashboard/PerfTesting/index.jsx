import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Gauge, RefreshCw, XCircle, Plus, Coins } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import SubscriptionGuard from '../../../components/UI/SubscriptionGuard';
import { fetchCreditAccount } from '../../../services/operations/creditAPIs';
import { apiFetch, getJourneyMetrics } from './api';
import { PHASE_ORDER, LOADGEN_PHASES, PHASE_EXPECTATIONS } from './constants';
import usePerfRunSocket from './hooks/usePerfRunSocket';
import StatusPill from './components/StatusPill';
import ShimmerBar from './components/ShimmerBar';
import ElapsedTimer from './components/ElapsedTimer';
import PhasePipeline from './components/PhasePipeline';
import LiveLogPanel from './components/LiveLogPanel';
import LiveMetricsChart from './components/LiveMetricsChart';
import DiscoveredEndpointsPanel from './components/DiscoveredEndpointsPanel';
import CoverageCaveatBanner from './components/CoverageCaveatBanner';
import RunForm from './components/RunForm';
import ResultsPanel from './components/ResultsPanel';
import RecentRuns from './components/RecentRuns';
import LiveExplorationPanel from './components/LiveExplorationPanel';
import JourneyTimingPanel from './components/JourneyTimingPanel';

// A performance run is charged on what it actually consumed once it
// finishes (engine seconds plus a concurrency surcharge for the load it
// drove — see src/config/pricing/perfTestMath.js), so no figure can honestly
// be quoted up front. This is only the floor used to gate starting a run:
// even a run that fails during discovery costs 1 credit, because it planned,
// drove a real browser and did real work on a real server.
const MIN_RUN_CREDITS = 1;

// The engine bills asynchronously (creditReconciler sweeps finished runs), so
// the balance keeps settling for a while after a run reaches a terminal
// state. Re-read it on a decaying schedule rather than once, or the figure on
// screen stays stale exactly when someone is looking to see what they spent.
const SETTLE_REFRESH_MS = [2000, 8000, 16000, 26000, 40000];

// A run in flight is metered continuously (perfTestBilling.meterRunningRuns,
// every 15s), so the balance genuinely moves WHILE the test runs — the same
// way web/app testing move it. Poll it at that cadence or the strip on screen
// stays frozen and it looks like nothing is being charged.
const LIVE_REFRESH_MS = 15000;

export default function PerfTesting() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.profile);
  const account = user?.creditAccount;
  const isManaged = account?.planType === 'managed';
  const balance = account?.balance ?? 0;
  const reserved = account?.reserved ?? 0;
  const unlimited = account?.unlimited === true;
  const [balanceAtStart, setBalanceAtStart] = useState(null);
  const timers = useRef([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [hasAuth, setHasAuth] = useState(true);
  const [fullRun, setFullRun] = useState(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [historicalLogs, setHistoricalLogs] = useState([]);
  const [historicalEndpoints, setHistoricalEndpoints] = useState([]);
  const [historicalMetricsByPhase, setHistoricalMetricsByPhase] = useState({});
  // Feature-journey results. Null for every other test type, which is why the
  // journey panels below simply render nothing rather than needing the page to
  // branch on test_intent.
  const [journeyMetrics, setJourneyMetrics] = useState(null);
  const { logs, status, metricsByPhase, discoveredEndpoints, screenshots, journeyTransitions, connectionError, done } = usePerfRunSocket(
    fullRun && ['completed', 'failed', 'cancelled'].includes(fullRun.status) ? null : activeRunId
  );

  const fetchFullRun = useCallback(async (runId) => {
    setLoadingRun(true);
    try {
      const d = await apiFetch(`/api/perf/runs/${runId}`);
      setFullRun(d);
      // A run selected from history that's already terminal never opens the
      // live socket (see usePerfRunSocket's gate below), so its log lines,
      // discovered endpoints, and per-phase metric samples all have to be
      // fetched once instead of arriving as WS push events — otherwise the
      // charts for a run you weren't watching live would just stay empty.
      if (['completed', 'failed', 'cancelled'].includes(d.status)) {
        const loadgenPhasesRun = Object.keys(d.phase_results || {}).filter((p) => LOADGEN_PHASES.has(p));
        const [l, e, ...metricsResults] = await Promise.all([
          apiFetch(`/api/perf/runs/${runId}/logs`),
          apiFetch(`/api/perf/runs/${runId}/discovered-endpoints`),
          ...loadgenPhasesRun.map((phase) => apiFetch(`/api/perf/runs/${runId}/metrics?phase=${phase}`)),
        ]);
        setHistoricalLogs(l.logs || []);
        setHistoricalEndpoints(e.endpoints || []);
        setHistoricalMetricsByPhase(
          Object.fromEntries(loadgenPhasesRun.map((phase, i) => [phase, metricsResults[i]?.samples || []]))
        );
      } else {
        setHistoricalLogs([]);
        setHistoricalEndpoints([]);
        setHistoricalMetricsByPhase({});
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingRun(false);
    }
  }, []);

  useEffect(() => {
    if (activeRunId) fetchFullRun(activeRunId);
  }, [activeRunId, fetchFullRun]);

  // The server's aggregate is authoritative once a run is terminal: it saw
  // every session, including any whose transitions were trimmed from the live
  // feed. Requested unconditionally — non-journey runs come back with nulls,
  // and a failure here must never disturb a run that otherwise succeeded.
  useEffect(() => {
    setJourneyMetrics(null);
    if (!activeRunId) return undefined;
    let cancelled = false;
    const terminal = ['completed', 'failed', 'cancelled'].includes(fullRun?.status);
    if (!done && !terminal) return undefined;
    getJourneyMetrics(activeRunId)
      .then((d) => {
        if (!cancelled && (d?.baseline || d?.under_load)) setJourneyMetrics(d);
      })
      .catch(() => { /* not a journey run, or results not stored — panels stay hidden */ });
    return () => { cancelled = true; };
  }, [activeRunId, done, fullRun?.status]);

  useEffect(() => {
    if (done && activeRunId) {
      fetchFullRun(activeRunId);
      setRefreshKey((k) => k + 1);
    }
  }, [done, activeRunId, fetchFullRun]);

  const handleStarted = (runId, willAuth) => {
    setHasAuth(willAuth);
    setBalanceAtStart(account?.balance ?? null);
    setActiveRunId(runId);
  };

  const handleSelectRecent = (runId) => {
    setHasAuth(true); // unknown for a historical run — show the step rather than hide it
    setActiveRunId(runId);
  };

  const handleNewTest = () => {
    setActiveRunId(null);
    setFullRun(null);
    setHistoricalLogs([]);
    setHistoricalEndpoints([]);
    setHistoricalMetricsByPhase({});
  };

  // Cancelling is a REQUEST, not an instant stop: the engine sets a flag and
  // each phase notices it at its next checkpoint. During discovery that can
  // be up to ~90s away, because a Playwright step waits for the page to
  // settle before the crawl loop looks at the flag again. Leaving the button
  // unchanged for that whole window makes a cancel that is working look like
  // one that was ignored — reported exactly that way in practice. Show the
  // pending state and stop accepting further clicks.
  const [cancelling, setCancelling] = useState(false);

  const cancelRun = async () => {
    if (!activeRunId || cancelling) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/perf/runs/${activeRunId}/cancel`, { method: 'POST' });
      toast.success('Cancelling — the run stops at its next checkpoint (up to ~90s during discovery).');
    } catch (e) {
      setCancelling(false);   // let them retry only if the request itself failed
      toast.error(e.message);
    }
  };

  // Clear the pending state once the run actually reaches a terminal status,
  // and whenever a different run becomes the active one.
  useEffect(() => { setCancelling(false); }, [activeRunId]);

  const liveStatus = status?.status || fullRun?.status;
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(liveStatus);

  // Billing happens after the run ends (creditReconciler sweeps finished
  // runs), so chase the balance for a while instead of reading it once.
  useEffect(() => {
    if (!isTerminal) return undefined;
    timers.current.forEach(clearTimeout);
    timers.current = SETTLE_REFRESH_MS.map((ms) =>
      setTimeout(() => dispatch(fetchCreditAccount()), ms));
    return () => timers.current.forEach(clearTimeout);
  }, [isTerminal, dispatch]);

  // What this run actually cost, observed rather than predicted — the drop in
  // balance between starting it and the charge settling. Never estimated up
  // front: the real figure depends on how long discovery took and how much
  // load ran, and a quoted guess the invoice then contradicts is worse than
  // no number at all.
  const settledCost =
    balanceAtStart != null && balanceAtStart > balance
      ? balanceAtStart - balance
      : null;

  const livePhase = status?.phase || fullRun?.phase;
  const isActive = ['queued', 'running'].includes(liveStatus);

  // Declared AFTER isActive on purpose — a const is hoisted but not
  // initialised, so referencing it above this line is a TDZ crash at render.
  useEffect(() => {
    if (!isActive) return undefined;
    const id = setInterval(() => dispatch(fetchCreditAccount()), LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [isActive, dispatch]);
  const displayedRun = fullRun && ['completed', 'failed', 'cancelled'].includes(fullRun.status) ? fullRun : null;

  // How much HTTP load was on the target while the under-load journey walked
  // it. "Under load" on its own is half a number — a feature being 2x slower
  // means nothing until you know whether that was under 20 users or 1000.
  // Prefer what the load phase ACTUALLY sustained (vus_avg) over what the plan
  // asked for: the engine clamps to limits.MAX_VUS_PER_RUN and a phase can end
  // early, so the requested figure can overstate what the target really saw.
  const loadVus = (() => {
    const actual = fullRun?.phase_results?.load?.vus_avg;
    if (actual) return Math.round(actual);
    const planned = (fullRun?.plan?.phases || []).find((p) => p.phase === 'load')?.vus_end;
    return planned || fullRun?.requested_virtual_users || null;
  })();
  // Every loadgen phase that has ever produced a sample stays rendered, in
  // canonical run order — moving on to the next phase (e.g. smoke -> load)
  // no longer makes the previous one's chart disappear, it just stops being
  // the "live" one.
  const loadgenPhasesWithData = PHASE_ORDER
    .map((p) => p.id)
    .filter((id) => LOADGEN_PHASES.has(id) && (metricsByPhase[id]?.length || historicalMetricsByPhase[id]?.length));

  // Discovery is the long, opaque part of a run — often 5-20 minutes during
  // which the exploration IS the only thing happening and every results panel
  // is still empty. So give the live view the whole width until the load
  // charts have something to show, then hand the space over to them.
  // `explorationCollapsed` lets the user override either way; it is only
  // consulted when set, so the automatic behaviour holds until they touch it.
  const [explorationCollapsed, setExplorationCollapsed] = useState(null);
  const focusExploration = explorationCollapsed === null
    ? loadgenPhasesWithData.length === 0
    : !explorationCollapsed;

  return (
    <SubscriptionGuard featureName="a performance test" requiredCredits={MIN_RUN_CREDITS}>
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .shimmer-bar {
          background: linear-gradient(90deg, #fed7aa 25%, #fb923c 50%, #fed7aa 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
      `}} />

      <Toaster position="top-right" />

      {/* Widened from max-w-5xl: a feature-journey run has two things to show
          at once — a live screenshot you WATCH and results you READ — and
          stacking both in a single narrow column meant scrolling past the
          screenshot to see any timing, then back up to see what the agent was
          doing. The run view below splits them into two columns on large
          screens; everything else still centres in the same reading width. */}
      <div className="max-w-7xl mx-auto space-y-5 pb-12 pt-4 px-4">

        {/* Header */}
        <div className="bg-white rounded-3xl px-8 py-7 shadow-xl border border-slate-200">
          <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-500/20">
            <Gauge size={13} /><span>Performance Testing Suite</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Performance <span className="text-orange-500">Tester</span>
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Describe a real flow in plain English — the engine plans, discovers real endpoints, and runs a full load test autonomously.
          </p>
        </div>

        {/* CREDIT BALANCE */}
        {account && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <Coins className="text-orange-500" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {unlimited ? 'Unlimited credits' : (
                    <>
                      {balance.toLocaleString()} credit{balance === 1 ? '' : 's'} remaining
                      {account.monthlyAllowance ? ` of ${account.monthlyAllowance.toLocaleString()}` : ''}
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {/* Deliberately not an estimate. Cost depends on how long
                      discovery takes and how much load actually runs — a
                      number quoted here would be a guess the invoice then
                      contradicts. */}
                  Charged on what the run actually uses — engine time plus the load it drives, metered as it runs.
                  {reserved > 0 && ` ${reserved.toLocaleString()} reserved by runs in progress.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {settledCost != null && (
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
                  This run {isTerminal ? 'cost' : 'has cost'} {settledCost.toLocaleString()} credit{settledCost === 1 ? '' : 's'}{isTerminal ? '' : ' so far'}
                </span>
              )}
              <span className="text-xs font-medium text-slate-400 hidden sm:block">
                {isManaged ? 'Managed AI — model usage billed as credits' : 'Your own API key — credits meter capacity'}
              </span>
              {user?.role === 'company_admin' && (
                <Link to="/upgrade-plan" className="text-sm font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap">
                  Manage plan →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* The form is only useful before a run exists to look at — once one's
            selected (new or from history), showing the whole thing again just
            pushes the actual run view (and Recent Runs) further down. */}
        {activeRunId ? (
          <button onClick={handleNewTest}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-sm font-bold hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/30 transition-all">
            <Plus size={16} /> New Performance Test
          </button>
        ) : (
          <RunForm disabled={isActive} onStarted={handleStarted} />
        )}

        {/* Active / selected run */}
        {activeRunId && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-center gap-3 flex-wrap">
                  {liveStatus && <StatusPill status={liveStatus} />}
                  <span className="text-xs font-mono text-slate-400 truncate max-w-[220px]">{activeRunId}</span>
                  {status?.phase_label && <span className="text-xs text-slate-500">{status.phase_label}</span>}
                  <ElapsedTimer since={fullRun?.created_at} until={fullRun?.completed_at} active={isActive} />
                </div>
                <div className="flex items-center gap-3">
                  {fullRun?.plan && (
                    <PhasePipeline plan={fullRun.plan} hasAuth={hasAuth} currentPhase={livePhase} runStatus={liveStatus} />
                  )}
                  {isActive && (
                    <button onClick={cancelRun} disabled={cancelling}
                      title={cancelling ? 'Cancellation requested — the run stops at its next checkpoint' : 'Cancel this run'}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors shrink-0 ${
                        cancelling
                          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                      }`}>
                      <XCircle size={13} className={cancelling ? 'animate-pulse' : ''} />
                      {cancelling ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>

              {isActive && <div className="mt-4"><ShimmerBar /></div>}
              {isActive && PHASE_EXPECTATIONS[livePhase] && (
                <p className="mt-2.5 text-xs text-slate-400 leading-relaxed">{PHASE_EXPECTATIONS[livePhase]}</p>
              )}
              {connectionError && (
                <p className="mt-3 text-xs text-rose-500 flex items-center gap-1.5"><RefreshCw size={11} /> {connectionError}</p>
              )}
            </div>

            {fullRun?.coverage_caveat && !displayedRun && <CoverageCaveatBanner caveat={fullRun.coverage_caveat} />}

            {/* Two tracks, side by side on a wide screen.
                LEFT is what you watch while it runs — the screenshot and the
                log — and it sticks, so it stays on screen while you read the
                results instead of scrolling away from the thing still moving.
                RIGHT is what accumulates and gets read afterwards.
                Below lg they collapse back to one column in the same order. */}
            {/* Full width while exploring — see focusExploration above. */}
            {focusExploration && (
              <LiveExplorationPanel
                screenshots={screenshots}
                wide
                onToggleSize={() => setExplorationCollapsed(true)}
              />
            )}

            <div className={`grid grid-cols-1 gap-4 items-start ${
              focusExploration ? '' : 'lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]'}`}>

              {/* Bounded to the viewport so `sticky` actually works: the
                  screenshot plus a 256px log can exceed screen height, and a
                  sticky element taller than the viewport just scrolls off the
                  bottom and never comes back. Overflowing inside keeps the
                  live frame pinned no matter how tall the rail gets. */}
              <div className={`space-y-4 ${focusExploration ? '' :
                'lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1'}`}>
                {!focusExploration && (
                  <LiveExplorationPanel
                    screenshots={screenshots}
                    onToggleSize={() => setExplorationCollapsed(false)}
                  />
                )}

                <LiveLogPanel
                  logs={logs.length ? logs : historicalLogs}
                  active={isActive}
                  finished={['completed', 'failed', 'cancelled'].includes(liveStatus)}
                />
              </div>

              <div className="space-y-4 min-w-0">
                <JourneyTimingPanel
                  transitions={journeyTransitions}
                  journeyMetrics={journeyMetrics}
                  loadVus={loadVus}
                />

                {loadgenPhasesWithData.map((phase) => (
                  <LiveMetricsChart
                    key={phase}
                    phase={phase}
                    samples={metricsByPhase[phase]?.length ? metricsByPhase[phase] : historicalMetricsByPhase[phase] || []}
                    live={phase === livePhase}
                  />
                ))}

                <DiscoveredEndpointsPanel
                  endpoints={discoveredEndpoints.length ? discoveredEndpoints : historicalEndpoints}
                />

                {loadingRun && !fullRun && (
                  <p className="text-center text-sm text-slate-400 py-4">Loading run…</p>
                )}

                {displayedRun && <ResultsPanel run={displayedRun} />}
              </div>
            </div>
          </motion.div>
        )}

        <RecentRuns onSelect={handleSelectRecent} refreshKey={refreshKey} />

      </div>
    </div>
    </SubscriptionGuard>
  );
}
