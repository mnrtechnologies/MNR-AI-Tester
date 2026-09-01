import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2, Download, AlertTriangle, Coins } from "lucide-react";
import SubscriptionGuard from "../../components/UI/SubscriptionGuard";
import { creditPreflight } from "../../services/operations/creditAPIs";

// The VAPT engine runs as its own FastAPI + Celery service (separate from
// the Node auth backend), same as every other AI test engine — point this at
// it via env var.
const API = process.env.REACT_APP_SECURITY_TESTING_URL || "http://localhost:8080";

// A scan always costs at least one credit to start. There is no per-run
// pricing wired up for VAPT yet (unlike the API tester's
// `creditsForApiRun`) — the engine doesn't report a metric a real cost could
// be derived from, and nothing settles a charge against this run type. So
// this gate only answers "can this account start a run at all"; it never
// shows an estimated or consumed-credits figure that nothing backs.
const MIN_RUN_CREDITS = 1;

const POLL_MS = 3000;

const SEV = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
  info: "bg-gray-100 text-gray-600",
};

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const Stat = ({ label, value, hint }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">
      {label}
    </div>
    <div className="text-xl font-bold text-gray-800 tabular-nums">
      {value ?? <span className="text-gray-300">—</span>}
    </div>
    {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
  </div>
);

/**
 * The live/terminal view for one job. Shown in place of the form while a job
 * exists and hasn't been dismissed.
 *
 * The agent emits progress after every step (see agent.py's _emit_progress),
 * so the stats below reflect real state, not a fabricated phase stepper —
 * step count, confirmed findings, and endpoint coverage are all things the
 * backend actually knows at poll time.
 */
const RunPanel = ({ status, result, jobId, onReset, onCancel, isCancelling, cancelError }) => {
  const state = status?.state;
  const terminal = ["SUCCESS", "FAILURE", "REVOKED"].includes(state);
  const cancelled = state === "REVOKED";
  // The engine catches scope/engagement errors itself and returns them as a
  // normal SUCCESS result ({ok: false, error: ...}) rather than a Celery
  // FAILURE — so a "successful" job whose payload says otherwise is still a
  // failure from the user's point of view.
  const failed = state === "FAILURE" || (state === "SUCCESS" && result?.ok === false);
  const done = state === "SUCCESS" && result?.ok !== false;

  const tone = failed
    ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", soft: "text-red-700" }
    : cancelled
    ? { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-900", soft: "text-slate-600" }
    : done
    ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", soft: "text-emerald-700" }
    : { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", soft: "text-gray-600" };

  const confirmed = result?.findings?.filter((f) => f.status === "confirmed") || [];

  return (
    <div className={`${tone.bg} ${tone.border} border rounded-xl shadow-sm p-6`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-white/70 border border-current/10 flex items-center justify-center shrink-0">
          {terminal ? (
            failed ? (
              <span className="text-red-600 font-bold text-xl">!</span>
            ) : cancelled ? (
              <span className="text-slate-500 font-bold text-xl">×</span>
            ) : (
              <ShieldCheck className="text-emerald-600" size={22} />
            )
          ) : (
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`${tone.text} font-bold text-lg mb-1`}>
            {failed
              ? "Assessment failed"
              : cancelled
              ? "Assessment cancelled"
              : done
              ? "Assessment complete"
              : "Assessment running…"}
          </h4>
          <p className={`${tone.soft} text-sm mb-4`}>
            {failed
              ? status?.error || result?.error || "The assessment stopped before finishing — check the service logs."
              : cancelled
              ? "You cancelled this run before it finished."
              : done
              ? "Findings and the full report are below."
              : "This runs in the background — checking back every few seconds."}
          </p>

          {!terminal && status?.progress && (
            <div className="flex flex-wrap gap-6 mb-4">
              <Stat
                label="Steps"
                value={
                  status.progress.max_steps
                    ? `${status.progress.step ?? 0} / ${status.progress.max_steps}`
                    : status.progress.step ?? null
                }
              />
              <Stat label="Confirmed findings" value={status.progress.confirmed_findings ?? null} />
              <Stat
                label="Endpoints covered"
                value={
                  status.progress.known_endpoints
                    ? `${status.progress.tested_endpoints ?? 0} / ${status.progress.known_endpoints}`
                    : status.progress.tested_endpoints ?? null
                }
                hint={!status.progress.known_endpoints ? "no API schema discovered yet" : null}
              />
            </div>
          )}

          {done && (
            <div className="space-y-4 mb-4">
              <div className="flex flex-wrap gap-3">
                {["critical", "high", "medium", "low"].map((s) => (
                  <span
                    key={s}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${SEV[s]}`}
                  >
                    {result?.counts?.[s] ?? 0} {s}
                  </span>
                ))}
              </div>

              {confirmed.length === 0 && (
                <p className="text-sm text-gray-500">
                  No confirmed findings — the target held up to this pass.
                </p>
              )}

              {confirmed.map((f) => (
                <div key={f.id} className="border-l-4 border-orange-500 pl-4 py-2">
                  <p className="font-semibold text-gray-800">
                    {f.id} — {f.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {f.owasp} · {f.severity} · {f.location}
                  </p>
                  {f.impact && <p className="text-sm text-gray-600 mt-1">{f.impact}</p>}
                </div>
              ))}

              <a
                href={`${API}/vapt/report/${jobId}`}
                className="inline-flex items-center gap-2 text-orange-600 font-medium hover:text-orange-700"
              >
                <Download size={16} /> Download Word Report
              </a>
            </div>
          )}

          <div className="text-xs font-mono text-gray-400 mb-4 truncate">Job ID: {jobId}</div>

          <div className={`border-t ${tone.border} pt-4 flex flex-wrap items-center gap-3`}>
            {terminal ? (
              <button
                onClick={onReset}
                className={`px-5 py-2 rounded-lg font-semibold text-white transition-all active:scale-95 ${
                  failed
                    ? "bg-red-600 hover:bg-red-700"
                    : cancelled
                    ? "bg-slate-600 hover:bg-slate-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                Run another test
              </button>
            ) : (
              <>
                <button
                  disabled
                  className="px-5 py-2 rounded-lg font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
                >
                  Testing…
                </button>
                <button
                  onClick={onCancel}
                  disabled={isCancelling}
                  className={`px-5 py-2 rounded-lg font-semibold border transition-all active:scale-95 ${
                    isCancelling
                      ? "border-gray-200 text-gray-400 cursor-not-allowed"
                      : "border-red-200 text-red-600 hover:bg-red-50"
                  }`}
                >
                  {isCancelling ? "Cancelling…" : "Cancel run"}
                </button>
                {cancelError && <span className="text-sm text-red-600">{cancelError}</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SecurityTesting = () => {
  const { user } = useSelector((state) => state.profile);
  const account = user?.creditAccount;
  const balance = account?.balance ?? 0;
  const reserved = account?.reserved ?? 0;
  const unlimited = account?.unlimited === true;

  const [form, setForm] = useState({
    target_url: "",
    authorized: false,
    provider: "openai",
    api_key: "",
    openapi_url: "",
    email: "",
    password: "",
    login_url: "",
  });

  const [isStarting, setIsStarting] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Held separately from `error` so the out-of-credits case can offer a way
  // to fix it rather than just telling the user something broke.
  const [creditError, setCreditError] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const pollId = useRef(null);

  const terminal = status && ["SUCCESS", "FAILURE", "REVOKED"].includes(status.state);

  const set = (k) => (e) =>
    setForm({
      ...form,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });

  const clearPoll = useCallback(() => {
    if (pollId.current) clearInterval(pollId.current);
    pollId.current = null;
  }, []);

  useEffect(() => clearPoll, [clearPoll]);

  // ── Poll the job until it stops ──────────────────────────────
  useEffect(() => {
    if (!jobId || terminal) return undefined;

    let cancelledEffect = false;

    const tick = async () => {
      try {
        const res = await fetch(`${API}/vapt/status/${jobId}`);
        if (!res.ok || cancelledEffect) return; // a dropped poll isn't worth surfacing; the next one lands
        setStatus(await res.json());
      } catch {
        // A dropped poll is not worth surfacing — the next one will land.
      }
    };

    tick();
    pollId.current = setInterval(tick, POLL_MS);
    return () => {
      cancelledEffect = true;
      clearPoll();
    };
  }, [jobId, terminal, clearPoll]);

  // ── Fetch the result once the job succeeds ────────────────────
  // Kept out of the poll effect above: setting `status` to SUCCESS flips
  // `terminal`, which re-runs that effect and fires its cleanup — cancelling
  // the very tick that was still awaiting this fetch, so the result was
  // silently dropped even though the backend had it.
  useEffect(() => {
    if (status?.state !== "SUCCESS" || result || !jobId) return undefined;

    let cancelledEffect = false;
    (async () => {
      try {
        const r = await fetch(`${API}/vapt/result/${jobId}`);
        if (r.ok && !cancelledEffect) setResult(await r.json());
      } catch {
        // Transient — the user can still reach the result via the report link.
      }
    })();
    return () => {
      cancelledEffect = true;
    };
  }, [status?.state, result, jobId]);

  const start = async (e) => {
    e.preventDefault();
    if (
      !form.target_url ||
      !form.authorized ||
      !form.api_key ||
      !form.openapi_url ||
      !form.email ||
      !form.password ||
      !form.login_url
    ) {
      setError(
        "Target URL, authorization, API key, API docs URL, and test account details are all required."
      );
      return;
    }

    setIsStarting(true);
    setError(null);
    setCreditError(null);

    try {
      // ── Credit gate ───────────────────────────────────────────
      // Asked of the Node backend, never of the VAPT engine: the engine is
      // unauthenticated and the browser posts to it directly, so a gate
      // enforced there could be skipped by bypassing the browser entirely.
      const preflight = await creditPreflight();
      if (!preflight?.ok) {
        if (preflight?.code === "INSUFFICIENT_CREDITS") {
          setCreditError(
            preflight.message || "You don't have enough credits to start a security test."
          );
          return;
        }
        throw new Error(preflight?.message || "Could not verify your credit balance.");
      }

      const payload = {
        target_url: form.target_url,
        authorized: form.authorized,
        provider: form.provider,
        api_key: form.api_key,
        openapi_url: form.openapi_url,
        login: {
          email: form.email,
          password: form.password,
          login_url: form.login_url,
        },
      };

      const res = await fetch(`${API}/vapt/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to start assessment.");
      }

      setStatus({ state: "PENDING" });
      setResult(null);
      setJobId(data.job_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId || isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`${API}/vapt/cancel/${jobId}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Could not cancel the run.");
      }

      // Reflect the cancellation immediately rather than waiting for the
      // next poll tick — the backend has already revoked the job.
      setStatus((prev) => ({ ...(prev || {}), state: "REVOKED" }));
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const resetForm = () => {
    clearPoll();
    setJobId(null);
    setStatus(null);
    setResult(null);
    setError(null);
    setCreditError(null);
    setCancelError(null);
  };

  return (
    <SubscriptionGuard featureName="a security test" requiredCredits={MIN_RUN_CREDITS}>
      <div className="max-w-4xl mx-auto space-y-6 pb-12 pt-6 px-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-orange-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Security Testing (VAPT)</h1>
            <p className="text-sm text-gray-500">
              OWASP Top 10 &amp; API security assessment, powered by an AI agent.
            </p>
          </div>
        </div>

        {/* CREDIT BALANCE STRIP */}
        {account && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <Coins className="text-orange-500" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {unlimited ? (
                    "Unlimited credits"
                  ) : (
                    <>
                      {balance.toLocaleString()} credit{balance === 1 ? "" : "s"} remaining
                      {account.monthlyAllowance
                        ? ` of ${account.monthlyAllowance.toLocaleString()}`
                        : ""}
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Starting a scan requires at least {MIN_RUN_CREDITS} credit
                  {MIN_RUN_CREDITS === 1 ? "" : "s"}.
                  {reserved > 0 && ` ${reserved.toLocaleString()} reserved by runs in progress.`}
                </p>
              </div>
            </div>
            {user?.role === "company_admin" && (
              <Link
                to="/upgrade-plan"
                className="text-sm font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap"
              >
                Manage plan →
              </Link>
            )}
          </div>
        )}

        {/* CONDITIONAL RENDER AREA — mutually exclusive states, priority order matters */}
        {isStarting ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-1">Starting assessment…</h3>
            <p className="text-gray-500 text-sm text-center max-w-md">
              Verifying your credit balance and queueing the scan.
            </p>
          </div>
        ) : jobId ? (
          <RunPanel
            status={status}
            result={result}
            jobId={jobId}
            onReset={resetForm}
            onCancel={handleCancel}
            isCancelling={isCancelling}
            cancelError={cancelError}
          />
        ) : creditError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-amber-600" size={22} />
              </div>
              <div className="flex-1">
                <h4 className="text-amber-900 font-bold text-lg mb-2">Not enough credits</h4>
                <p className="text-amber-800 text-sm mb-4">{creditError}</p>
                <div className="border-t border-amber-200 pt-4 flex flex-wrap gap-3">
                  {user?.role === "company_admin" ? (
                    <Link
                      to="/upgrade-plan"
                      className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg font-semibold transition-all active:scale-95"
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
                    className="px-5 py-2 rounded-lg font-semibold text-amber-800 hover:bg-amber-100 transition-all active:scale-95"
                  >
                    Back to form
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-600 font-bold text-xl">!</span>
              </div>
              <div className="flex-1">
                <h4 className="text-red-900 font-bold text-lg mb-2">Failed to start assessment</h4>
                <p className="text-red-700 text-sm mb-4">{error}</p>
                <div className="border-t border-red-200 pt-4">
                  <button
                    onClick={resetForm}
                    className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold transition-all active:scale-95"
                  >
                    Modify form &amp; try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
            <Field
              label="Target URL *"
              hint="The website or API you want checked for security issues."
            >
              <input
                className={inputCls}
                type="url"
                name="vapt_target_url"
                autoComplete="off"
                placeholder="https://your-site.com"
                value={form.target_url}
                onChange={set("target_url")}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.authorized} onChange={set("authorized")} />
              I own this site or I&apos;m authorized to test it *
            </label>

            <div className="grid grid-cols-2 gap-4">
              <Field label="AI Provider *">
                <select className={inputCls} value={form.provider} onChange={set("provider")}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Claude</option>
                </select>
              </Field>
              <Field label="API Key *" hint="Your key — used only for this run, never stored.">
                <input
                  className={inputCls}
                  type="password"
                  name="vapt_api_key"
                  autoComplete="new-password"
                  placeholder="sk-..."
                  value={form.api_key}
                  onChange={set("api_key")}
                />
              </Field>
            </div>

            <Field
              label="API docs URL *"
              hint="Your OpenAPI/Swagger link — required so the agent knows every endpoint to check, not just what it can crawl."
            >
              <input
                className={inputCls}
                type="url"
                name="vapt_openapi_url"
                autoComplete="off"
                placeholder="https://your-site.com/api/openapi.json"
                value={form.openapi_url}
                onChange={set("openapi_url")}
              />
            </Field>

            <Field
              label="Test account (to check pages behind login) *"
              hint="Required — without a logged-in identity the agent can only test what's public."
            >
              <div className="grid grid-cols-3 gap-3">
                <input
                  className={inputCls}
                  type="email"
                  name="vapt_test_email"
                  autoComplete="off"
                  placeholder="test email"
                  value={form.email}
                  onChange={set("email")}
                />
                <input
                  className={inputCls}
                  type="password"
                  name="vapt_test_password"
                  autoComplete="new-password"
                  placeholder="test password"
                  value={form.password}
                  onChange={set("password")}
                />
                <input
                  className={inputCls}
                  type="url"
                  name="vapt_login_url"
                  autoComplete="off"
                  placeholder="login URL"
                  value={form.login_url}
                  onChange={set("login_url")}
                />
              </div>
            </Field>

            <div className="pt-2 flex items-center justify-between border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Only ever tests targets you've confirmed you're authorized for.
              </p>
              <button
                onClick={start}
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-5 py-2.5 rounded-lg flex items-center gap-2"
              >
                <ShieldCheck size={16} />
                Start Security Test
              </button>
            </div>
          </div>
        )}
      </div>
    </SubscriptionGuard>
  );
};

export default SecurityTesting;
