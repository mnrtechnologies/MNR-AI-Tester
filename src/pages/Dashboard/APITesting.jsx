import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Globe,
  ShieldCheck,
  Send,
  Loader2,
  Server,
  Key,
  Mail,
  Lock,
  Smartphone,
  Coins,
  AlertTriangle,
  Check,
} from "lucide-react";
import SubscriptionGuard from "../../components/UI/SubscriptionGuard";
import {
  creditPreflight,
  fetchCreditAccount,
} from "../../services/operations/creditAPIs";
import { creditsForApiRun } from "../../config/pricing/apiTestMath";

const API = process.env.REACT_APP_AI_API_TESTER_BACKEND_URL;

// An API run always costs at least the exploration down payment, exactly as a
// bare web crawl does (creditsForStories(0) === 1). It is a floor, not a price:
// the real cost depends on how many test cases the scan generates, which is not
// knowable until Phase 2 is done. Express prices that afterwards from the
// `api_test_run` row the engine writes — never compute a charge here.
const MIN_RUN_CREDITS = 1;

// The engine has no WebSocket (unlike the web tester's Redis relay), so the
// only way to follow a run is to ask. Runs last 2-10 minutes, so a few seconds
// of lag is invisible and the request cost is trivial.
const POLL_MS = 4000;

// After the run finishes the charge has NOT landed yet: the Express reconciler
// bills on a 20s tick. Keep refreshing the account past that so the balance
// settles on screen instead of waiting for the user to reload.
const SETTLE_REFRESH_MS = [2000, 8000, 16000, 26000, 40000];

const PHASES = [
  { n: 0, label: "Auth" },
  { n: 1, label: "Discovery" },
  { n: 2, label: "Test generation" },
  { n: 3, label: "Execution" },
  { n: 4, label: "Report" },
];

/**
 * What the scan is doing right now, and what it will cost.
 *
 * Replaces the old fire-and-forget "Queued" card. A scan runs for 2-10 minutes;
 * leaving the user on a static acknowledgement for that long makes a working
 * system look hung.
 */
const RunProgress = ({ response, run, estimate, charged, isTerminal, onReset, onCancel, isCancelling, cancelError }) => {
  const status = run?.status || response.status;
  const phase = run?.phase ?? 0;
  const failed = status === "failed";
  const cancelled = status === "cancelled";
  const done = status === "completed";

  const tone = failed
    ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", soft: "text-red-700" }
    : cancelled
    ? { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-900", soft: "text-slate-600" }
    : done
    ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", soft: "text-emerald-700" }
    : { bg: "bg-white", border: "border-slate-200", text: "text-slate-900", soft: "text-slate-600" };

  return (
    <div className={`${tone.bg} ${tone.border} border rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-white/70 border border-current/10 flex items-center justify-center shrink-0">
          {isTerminal ? (
            failed ? (
              <span className="text-red-600 font-bold text-2xl">!</span>
            ) : cancelled ? (
              <span className="text-slate-500 font-bold text-2xl">×</span>
            ) : (
              <ShieldCheck className="text-emerald-600" size={28} />
            )
          ) : (
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`${tone.text} font-bold text-xl mb-1`}>
            {failed
              ? "Test failed"
              : cancelled
              ? "Test cancelled"
              : done
              ? "Test complete"
              : run?.phase_label || "Test queued"}
          </h4>
          <p className={`${tone.soft} mb-5`}>
            {failed
              ? run?.error || "The test stopped before finishing."
              : cancelled
              ? "You cancelled this run before it finished."
              : done
              ? "Your report has been emailed and is available below."
              : "This runs in the background — you can leave this page, the report is emailed either way."}
          </p>

          {/* PHASE STEPPER */}
          {!failed && (
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-6">
              {PHASES.map((p, i) => {
                const reached = phase > p.n || done;
                const current = phase === p.n && !done;
                return (
                  <li key={p.n} className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        reached
                          ? "bg-emerald-100 text-emerald-700"
                          : current
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {reached ? (
                        <Check size={13} />
                      ) : current ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : null}
                      {p.label}
                    </span>
                    {i < PHASES.length - 1 && (
                      <span className="text-slate-300 text-xs">→</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {/* LIVE COUNTS */}
          <div className="flex flex-wrap gap-6 mb-6">
            <Stat
              label="Endpoints found"
              value={run?.apis_found}
              hint={run?.apis_found == null ? "discovering…" : null}
            />
            <Stat
              label="Tests generated"
              value={run?.tests_generated}
              hint={
                run?.tests_generated == null && run?.apis_found != null
                  ? "writing tests…"
                  : null
              }
            />
            <Stat
              // Flips once the scan stops, not once the charge lands. After
              // that the credits really are spent — the only thing still
              // outstanding is Express writing it down — so calling it an
              // estimate at that point would understate what already happened.
              label={isTerminal ? "Credits consumed" : "Estimated cost"}
              value={
                charged != null
                  ? `${charged} credit${charged === 1 ? "" : "s"}`
                  : estimate != null
                  ? `${estimate} credit${estimate === 1 ? "" : "s"}`
                  : null
              }
              hint={
                charged != null
                  ? null
                  : isTerminal
                  ? "settling…"
                  : estimate != null
                  ? "settles when the scan finishes"
                  : // The dash above is not a loading spinner — the figure
                    // genuinely does not exist yet, because cost is driven by
                    // test count and Phase 2 has not reported one. Say so,
                    // rather than leaving the user to wonder what is missing.
                    "known once tests are generated"
              }
            />
          </div>

          {/* REPORTS */}
          {done && (run?.s3_report_url || run?.s3_discovery_url) && (
            <div className="flex flex-wrap gap-3 mb-6">
              {run.s3_report_url && (
                <Download href={run.s3_report_url} label="Test report" />
              )}
              {run.s3_discovery_url && (
                <Download href={run.s3_discovery_url} label="API discovery" />
              )}
              {run.s3_suite_url && (
                <Download href={run.s3_suite_url} label="Test suite JSON" />
              )}
            </div>
          )}

          <div className="text-xs font-mono text-slate-400 mb-6 truncate">
            Run ID: {response.run_id}
          </div>

          <div className={`border-t ${tone.border} pt-6 flex flex-wrap items-center gap-3`}>
            {isTerminal ? (
              <button
                onClick={onReset}
                className={`px-6 py-2.5 rounded-xl font-semibold transition-all active:scale-95 shadow-sm ${
                  failed
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : cancelled
                    ? "bg-slate-600 hover:bg-slate-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                Run another test
              </button>
            ) : (
              <>
                <button
                  disabled
                  className="px-6 py-2.5 rounded-xl font-semibold bg-slate-100 text-slate-400 cursor-not-allowed shadow-sm"
                >
                  Test in progress…
                </button>
                <button
                  onClick={onCancel}
                  disabled={isCancelling}
                  className={`px-6 py-2.5 rounded-xl font-semibold transition-all active:scale-95 border ${
                    isCancelling
                      ? "border-slate-200 text-slate-400 cursor-not-allowed"
                      : "border-red-200 text-red-600 hover:bg-red-50"
                  }`}
                >
                  {isCancelling ? "Cancelling…" : "Cancel run"}
                </button>
                {cancelError && (
                  <span className="text-sm text-red-600">{cancelError}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, hint }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
      {label}
    </div>
    <div className="text-2xl font-bold text-slate-800 tabular-nums">
      {value ?? <span className="text-slate-300">—</span>}
    </div>
    {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
  </div>
);

const Download = ({ href, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-600 transition-colors"
  >
    {label}
  </a>
);

const APITesting = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.profile);
  const account = user?.creditAccount;

  const [isTesting, setIsTesting] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  // Held separately from `error` so the out-of-credits case can offer a way to
  // fix it rather than just telling the user something broke.
  const [creditError, setCreditError] = useState(null);
  const [formData, setFormData] = useState({
    target_url: "",
    api_base_url: "",
    login_email: "",
    login_password: "",
    notify_email: "",
    otp_code: "",
    openai_key: "",
  });

  // Live run state, polled from the engine while a scan is in flight.
  const [run, setRun] = useState(null);
  // Balance at the moment the scan was queued, so the charge can be shown as a
  // delta once the reconciler applies it. Snapshotted rather than derived: the
  // page never computes what a run costs, it only reports what actually moved.
  const [balanceAtStart, setBalanceAtStart] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const timers = useRef([]);

  const isManaged = account?.planType === "managed";
  const balance = account?.balance ?? 0;
  const reserved = account?.reserved ?? 0;
  const unlimited = account?.unlimited === true;

  const isTerminal =
    run?.status === "completed" ||
    run?.status === "failed" ||
    run?.status === "cancelled";
  const charged =
    balanceAtStart != null && isTerminal && balanceAtStart > balance
      ? balanceAtStart - balance
      : null;

  // Once Phase 2 reports a test count the cost is known, so stop being vague
  // and show it. Uses the same module Express charges with, so the figure on
  // screen cannot disagree with the invoice.
  const estimate =
    run?.tests_generated != null ? creditsForApiRun(run.tests_generated) : null;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // ── Poll the run until it stops ──────────────────────────────
  useEffect(() => {
    const runId = response?.run_id;
    if (!runId || isTerminal) return undefined;

    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`${API}/api/runs/${runId}`);
        if (!res.ok) return; // 404 right after queueing is normal; try again
        const data = await res.json();
        if (!cancelled) setRun(data);
      } catch {
        // A dropped poll is not worth surfacing — the next one will land, and
        // the run is unaffected either way. Only a failed *run* is an error.
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [response?.run_id, isTerminal]);

  // ── Chase the balance once the run stops ─────────────────────
  useEffect(() => {
    if (!isTerminal) return;
    clearTimers();
    timers.current = SETTLE_REFRESH_MS.map((ms) =>
      setTimeout(() => dispatch(fetchCreditAccount()), ms)
    );
  }, [isTerminal, dispatch, clearTimers]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleTestUsage = async (e) => {
    e.preventDefault();
    setIsTesting(true);
    setResponse(null);
    setError(null);
    setCreditError(null);
    setRun(null);
    clearTimers();

    try {
      // ── Credit gate ───────────────────────────────────────────
      // Asked of Express, never of the test engine. The engine is
      // unauthenticated and the browser posts to it directly, so a gate it
      // enforced could be bypassed by skipping the browser entirely. This is
      // also why the balance below is only ever displayed, never used to
      // decide anything: the decision is the server's.
      //
      // Takes no arguments by design — it asks "can this account start a run
      // at all", and reads the caller's identity from the auth header rather
      // than anything the page could assert about itself.
      const preflight = await creditPreflight();

      if (!preflight?.ok) {
        if (preflight?.code === "INSUFFICIENT_CREDITS") {
          setCreditError(
            preflight.message ||
              "You don't have enough credits to start an API test."
          );
          return;
        }
        throw new Error(
          preflight?.message || "Could not verify your credit balance."
        );
      }

      const res = await fetch(`${API}/api/runs/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          safe_mode: true, // Hardcoded to true, hidden from user
          // Stamps an owner on the usage rows the engine writes. Without it
          // they land as "unknown" and the run cannot be billed to anyone —
          // there is no per-URL sheet to recover the owner from afterwards.
          user_id: user?._id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to start the API test.");
      }

      // Remember what the balance was before any charge, so the settled cost
      // can be shown as a real delta rather than a number we predicted.
      setBalanceAtStart(account?.balance ?? null);
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCancel = async () => {
    const runId = response?.run_id;
    if (!runId || isCancelling) return;

    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`${API}/api/runs/${runId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Could not cancel the run.");
      }

      // Reflect the cancellation immediately rather than waiting for the
      // next poll tick — the backend has already stopped the run.
      setRun((prev) => ({ ...(prev || {}), status: "cancelled" }));
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  // Helper to reset the form state
  const resetForm = () => {
    clearTimers();
    setResponse(null);
    setError(null);
    setCreditError(null);
    setCancelError(null);
    setRun(null);
    setBalanceAtStart(null);
  };

  return (
    <SubscriptionGuard
      featureName="an API test"
      requiredCredits={MIN_RUN_CREDITS}
    >
      <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-6 px-4">
        {/* HERO SECTION */}
        <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-3xl p-8 md:p-10 border border-orange-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
              <ShieldCheck size={14} />
              <span>AI API Tester</span>
            </div>

            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
              API <span className="text-orange-500">Guardian</span> Test Runner
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed mb-0">
              Configure your target environment below to initiate an automated,
              AI-driven test of your API endpoints.
            </p>
          </div>

          {/* Graphical Placeholder */}
          <div className="w-56 h-56 relative z-10 flex items-center justify-center hidden md:flex">
            <div className="absolute inset-0 border-2 border-dashed border-orange-200 rounded-full animate-[spin_10s_linear_infinite]"></div>
            <div className="absolute inset-4 bg-white border border-orange-100 rounded-full shadow-lg flex items-center justify-center">
              <Globe className="text-orange-300" size={64} strokeWidth={1} />
            </div>
            <div className="absolute -top-2 right-4 bg-white px-3 py-2 rounded-lg shadow-md border border-slate-100 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-slate-700">200 OK</span>
            </div>
          </div>
        </div>

        {/* CREDIT BALANCE STRIP */}
        {account && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <Coins className="text-orange-500" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {unlimited ? (
                    "Unlimited credits"
                  ) : (
                    <>
                      {balance.toLocaleString()} credit
                      {balance === 1 ? "" : "s"} remaining
                      {account.monthlyAllowance
                        ? ` of ${account.monthlyAllowance.toLocaleString()}`
                        : ""}
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {/* Deliberately not an estimate. The cost depends on how many
                      endpoints the crawl finds — quoting a number here would be
                      a guess the invoice then contradicts. */}
                  Charged on what the scan actually uses, once it finishes.
                  {reserved > 0 && ` ${reserved.toLocaleString()} reserved by runs in progress.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-slate-400 hidden sm:block">
                {isManaged
                  ? "Managed AI — model usage billed as credits"
                  : "Your own API key — credits meter capacity"}
              </span>
              {user?.role === "company_admin" && (
                <Link
                  to="/upgrade-plan"
                  className="text-sm font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap"
                >
                  Manage plan →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* CONDITIONAL RENDER AREA (Form vs Loading vs Success vs Error) */}
        {isTesting ? (
          /* LOADING STATE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center animate-in fade-in">
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" />
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Initializing API Test...</h3>
            <p className="text-slate-500 text-center max-w-md">
              Please wait while our AI Guardian safely connects to your endpoints and prepares the analysis.
            </p>
          </div>
        ) : response ? (
          /* LIVE RUN STATE — polled until the scan stops */
          <RunProgress
            response={response}
            run={run}
            estimate={estimate}
            charged={charged}
            isTerminal={isTerminal}
            onReset={resetForm}
            onCancel={handleCancel}
            isCancelling={isCancelling}
            cancelError={cancelError}
          />
        ) : creditError ? (
          /* OUT OF CREDITS STATE — a wall the user can act on, not an error */
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-amber-600" size={26} />
              </div>
              <div className="flex-1">
                <h4 className="text-amber-900 font-bold text-xl mb-2">
                  Not enough credits
                </h4>
                <p className="text-amber-800 leading-relaxed text-lg mb-2">
                  {creditError}
                </p>
                {reserved > 0 && (
                  <p className="text-amber-700 text-sm mb-4">
                    {reserved.toLocaleString()} of your credits are reserved by
                    runs still in progress and will be released when they finish.
                  </p>
                )}

                <div className="border-t border-amber-200 pt-6 flex flex-wrap gap-3">
                  {user?.role === "company_admin" ? (
                    <Link
                      to="/upgrade-plan"
                      className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all active:scale-95 shadow-sm"
                    >
                      Add credits
                    </Link>
                  ) : (
                    <span className="text-amber-800 text-sm self-center">
                      Ask your administrator to top up your organisation's plan.
                    </span>
                  )}
                  <button
                    onClick={resetForm}
                    className="px-6 py-2.5 rounded-xl font-semibold text-amber-800 hover:bg-amber-100 transition-all active:scale-95"
                  >
                    Back to form
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          /* ERROR STATE */
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-600 font-bold text-2xl">!</span>
              </div>
              <div className="flex-1">
                <h4 className="text-red-900 font-bold text-xl mb-2">
                  Failed to Start Scan
                </h4>
                <p className="text-red-700 leading-relaxed text-lg mb-6">{error}</p>

                <div className="border-t border-red-200 pt-6">
                  <button
                    onClick={resetForm}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    Modify Form & Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* INPUT FORM STATE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Server className="text-orange-500" size={24} />
                Test Configuration
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Provide the necessary credentials and endpoints to start the scan.
              </p>
            </div>

            <form onSubmit={handleTestUsage} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Target URL */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    Target URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    name="target_url"
                    required
                    value={formData.target_url}
                    onChange={handleChange}
                    placeholder="https://app.yourdomain.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* API Base URL */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    API Base URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    name="api_base_url"
                    required
                    value={formData.api_base_url}
                    onChange={handleChange}
                    placeholder="https://api.yourdomain.com/v1"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* Login Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Mail size={16} className="text-slate-400" /> Login Email{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="login_email"
                    required
                    value={formData.login_email}
                    onChange={handleChange}
                    placeholder="testuser@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* Login Password */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Lock size={16} className="text-slate-400" /> Login Password{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="login_password"
                    required
                    value={formData.login_password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* Notify Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Mail size={16} className="text-slate-400" /> Notify Email
                    (For Results) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="notify_email"
                    required
                    value={formData.notify_email}
                    onChange={handleChange}
                    placeholder="admin@yourdomain.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* OTP Code */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Smartphone size={16} className="text-slate-400" /> OTP Code
                    (Optional)
                  </label>
                  <input
                    type="text"
                    name="otp_code"
                    value={formData.otp_code}
                    onChange={handleChange}
                    placeholder="123456"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* OpenAI Key */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Key size={16} className="text-slate-400" /> OpenAI API Key{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="openai_key"
                    required
                    value={formData.openai_key}
                    onChange={handleChange}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-400">
                    {isManaged
                      ? "Your Managed plan covers model usage — the tokens this scan spends are converted to credits and billed to your plan."
                      : "Model calls are charged to your own OpenAI account. Credits meter how many scans your plan allows."}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Safe mode is strictly enforced. No destructive mutations will be
                  executed.
                </p>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-sm bg-orange-500 hover:bg-orange-600 active:scale-95"
                >
                  <Send className="w-5 h-5" />
                  Start API Test
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </SubscriptionGuard>
  );
};

export default APITesting;
