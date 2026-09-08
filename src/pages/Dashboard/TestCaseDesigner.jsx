import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  FileText,
  Upload,
  Loader2,
  Download,
  AlertTriangle,
  Check,
  HelpCircle,
  ListChecks,
  Coins,
  Key,
} from "lucide-react";
import SubscriptionGuard from "../../components/UI/SubscriptionGuard";
import {
  creditPreflight,
  fetchCreditAccount,
  getSpecEstimate,
  authorizeSpecRun,
} from "../../services/operations/creditAPIs";

const API = process.env.REACT_APP_AI_SPEC_TESTER_BACKEND_URL;

// A design run always costs at least the floor that one generated test case
// costs. It is a floor, not a price: the real charge depends on how many test
// cases the document yields, which is not knowable until the run is done.
// Express prices that afterwards from the `spec_test_run` row the engine
// writes — never compute a charge here.
const MIN_RUN_CREDITS = 1;

// The engine has no WebSocket. A run is one model call per requirement, so a
// large document takes a couple of minutes; a few seconds of lag is invisible.
const POLL_MS = 3000;

// The charge has not landed when the run finishes — the Express reconciler
// bills on a tick. Keep refreshing past that so the balance settles on screen.
const SETTLE_REFRESH_MS = 25000;

const ACCEPTED = ".pdf,.docx,.txt,.md";

export default function TestCaseDesigner() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.profile);
  const userId = user?._id;

  const account = user?.creditAccount;
  const balance = account?.balance ?? 0;
  const reserved = account?.reserved ?? 0;
  const unlimited = account?.unlimited === true;
  const isManaged = account?.planType === "managed";

  // The balance in Redux may be stale if the user has been on another page
  // while a run settled elsewhere. Refresh once on arrival.
  useEffect(() => {
    dispatch(fetchCreditAccount());
  }, [dispatch]);

  const [doc, setDoc] = useState(null); // { doc_id, filename, chars, features_preview }
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // BYOK. The engine accepts keys only from the request — it has no server-side
  // fallback, so a run cannot silently spend someone else's credentials.
  const [apiKey, setApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const hasKey = Boolean(apiKey.trim() || anthropicApiKey.trim());

  const [run, setRun] = useState(null); // status payload from the engine
  const [runId, setRunId] = useState(null);
  const [starting, setStarting] = useState(false);
  // The quote shown at the gate. Server-computed — this page never prices a run.
  const [estimate, setEstimate] = useState(null);
  const [authorizing, setAuthorizing] = useState(false);
  // Set when the document is large enough that the server wants explicit
  // confirmation before running up the bill.
  const [needsOversizedOk, setNeedsOversizedOk] = useState(false);
  const [error, setError] = useState(null);
  const [creditError, setCreditError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const fileRef = useRef(null);

  const isAnalysing =
    run && (run.status === "queued" || run.status === "analysing");
  const isAnalysed = run && run.status === "analysed";
  const isRunning = run && run.status === "running";
  const isDone = run && run.status === "completed";
  const isFailed = run && run.status === "failed";
  // Poll while anything is still moving.
  const isPolling = Boolean(
    run && ["queued", "analysing", "running"].includes(run.status),
  );

  // ── Upload ────────────────────────────────────────────────────────
  const onPickFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setDoc(null);
    setRun(null);
    setRunId(null);
    setDownloaded(false);

    try {
      const form = new FormData();
      form.append("file", file);
      if (userId) form.append("user_id", userId);

      const res = await fetch(`${API}/spec/upload`, {
        method: "POST",
        body: form,
      });
      const body = await res.json();

      if (!res.ok) {
        // The engine writes these for the end user (scanned PDF, wrong type,
        // too large), so show them verbatim rather than a generic failure.
        throw new Error(body?.detail || "Upload failed");
      }
      setDoc(body);
    } catch (e) {
      setUploadError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Analyse ───────────────────────────────────────────────────────
  // One cheap model call that reports how many requirements the document has.
  // That count is the cost driver, so this is what makes the price quotable
  // before any of the expensive work happens.
  const startAnalysis = async () => {
    if (!doc) return;
    setStarting(true);
    setError(null);
    setCreditError(null);
    setEstimate(null);
    setNeedsOversizedOk(false);

    try {
      const pre = await creditPreflight();
      if (pre && pre.ok === false) {
        setCreditError(pre.message || "Not enough credits to start a run.");
        return;
      }

      const res = await fetch(`${API}/spec/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: doc.doc_id,
          user_id: userId,
          api_key: apiKey.trim() || undefined,
          anthropic_api_key: anthropicApiKey.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail || "Could not analyse the document");

      setRunId(body.run_id);
      setRun({ status: "queued", stage: "queued" });
    } catch (e) {
      setError(e.message || "Could not analyse the document");
    } finally {
      setStarting(false);
    }
  };

  // ── The gate ──────────────────────────────────────────────────────
  // Authorize (which holds the credits) and only then ask the engine to design.
  // The engine checks the authorization in the database rather than trusting
  // this request, so a forged call here achieves nothing.
  const confirmAndGenerate = async ({ acknowledgedOversized = false } = {}) => {
    if (!runId) return;
    setAuthorizing(true);
    setError(null);
    setCreditError(null);

    try {
      const auth = await authorizeSpecRun(runId, { acknowledgedOversized });
      if (!auth.ok) {
        if (auth.code === "OVERSIZED_RUN_REQUIRES_APPROVAL") {
          setNeedsOversizedOk(true);
          setCreditError(auth.message);
          return;
        }
        setCreditError(auth.message || "Could not authorize this run.");
        return;
      }

      const res = await fetch(`${API}/spec/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          user_id: userId,
          api_key: apiKey.trim() || undefined,
          anthropic_api_key: anthropicApiKey.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail || "Could not start the design run");

      // "running", not "queued": queued belongs to the analyse phase, and
      // reporting it here made the gate disappear and step 2 light up again,
      // which looked like the authorization had been lost.
      setRun({ status: "running", stage: "queued for design" });
      dispatch(fetchCreditAccount());
    } catch (e) {
      setError(e.message || "Could not start the design run");
    } finally {
      setAuthorizing(false);
    }
  };

  // ── Poll ──────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await fetch(`${API}/spec/${runId}/status`);
      if (!res.ok) return;
      setRun(await res.json());
    } catch {
      /* transient — the next tick retries */
    }
  }, [runId]);

  // Start and stop polling in ONE effect, keyed on whether anything is moving.
  //
  // This used to be two: one that started the interval on runId, and another
  // that cleared it when the run went quiet. That worked for analysis and then
  // broke design — reaching "analysed" cleared the interval, and nothing ever
  // started it again, so the design phase ran to completion while the page sat
  // on "queued for design" forever. A run has two active phases with a pause
  // between them, so the effect has to react to the pause ending.
  useEffect(() => {
    if (!runId || !isPolling) return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [runId, isPolling, poll]);

  useEffect(() => {
    if (isDone || isFailed) {
      dispatch(fetchCreditAccount());
      const t = setTimeout(() => dispatch(fetchCreditAccount()), SETTLE_REFRESH_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isPolling, isDone, isFailed, dispatch]);

  // Once analysis lands, ask the server what the design run will cost. The
  // page never computes this — it only displays what Express says.
  useEffect(() => {
    if (!isAnalysed || !runId || estimate) return;
    let cancelled = false;
    (async () => {
      const res = await getSpecEstimate(runId);
      if (cancelled) return;
      if (res.ok) setEstimate(res.data);
      else setCreditError(res.message || "Could not price this run.");
    })();
    return () => {
      cancelled = true;
    };
  }, [isAnalysed, runId, estimate]);

  // ── Download ──────────────────────────────────────────────────────
  // Pulled through fetch rather than a plain link so we know when the file has
  // actually arrived. The engine deletes the document only after the bytes are
  // sent, so a completed download means it is gone from storage.
  const download = async () => {
    if (!runId || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/spec/${runId}/download`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail || `Download failed (${res.status})`);
        if (res.status === 410 || res.status === 404) setDownloaded(true);
        return;
      }

      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = (match && match[1]) || `test_cases_${runId}.xlsx`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (e) {
      setError(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const reset = () => {
    setDoc(null);
    setRun(null);
    setRunId(null);
    setEstimate(null);
    setNeedsOversizedOk(false);
    setError(null);
    setCreditError(null);
    setUploadError(null);
    setDownloaded(false);
  };

  const pct =
    run && run.total ? Math.round(((run.done || 0) / run.total) * 100) : 0;

  return (
    <SubscriptionGuard
      featureName="a test case design run"
      requiredCredits={MIN_RUN_CREDITS}
    >
      <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-6 px-4">
        {/* HERO */}
        <div className="bg-gradient-to-br from-white to-orange-50/40 rounded-3xl p-8 md:p-10 border border-orange-100 shadow-sm">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <FileText size={14} />
            <span>Pre-Development</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            Test Case <span className="text-orange-500">Designer</span>
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed max-w-2xl">
            Upload a business requirements document and get a full test case
            specification back — before a single line of the website is written.
            Developers build against it; QA runs it once the site exists.
          </p>
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
                      requirements the document turns out to contain, which is
                      not known until it has been analysed — quoting a number
                      here would be a guess the invoice then contradicts. */}
                  Charged on what the run actually uses, once it finishes.
                  {reserved > 0 &&
                    ` ${reserved.toLocaleString()} reserved by runs in progress.`}
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

        {/* STEP 1 — UPLOAD */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Requirements document
            </h2>
          </div>
          <p className="text-sm text-slate-500 mb-5 ml-8">
            PDF, Word, text or Markdown, up to 50&nbsp;MB. Diagrams, mockups and
            screenshots inside the document are read too. No website needed —
            this runs entirely from the document.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />

          {!doc && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 rounded-xl py-10 flex flex-col items-center gap-2 transition disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin text-orange-500" size={24} />
                  <span className="text-sm text-slate-500">
                    Reading document…
                  </span>
                </>
              ) : (
                <>
                  <Upload className="text-slate-400" size={24} />
                  <span className="text-sm font-semibold text-slate-700">
                    Choose a document
                  </span>
                  <span className="text-xs text-slate-400">
                    PDF · DOCX · TXT · MD
                  </span>
                </>
              )}
            </button>
          )}

          {uploadError && (
            <div className="mt-4 flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="text-red-500 shrink-0" size={18} />
              <div>
                <p className="text-sm text-red-700 font-medium">{uploadError}</p>
                <p className="text-xs text-red-500 mt-1">
                  Fix the file and try again.
                </p>
              </div>
            </div>
          )}

          {doc && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-700 truncate flex items-center gap-2">
                    <Check size={16} /> {doc.filename}
                  </p>
                  <p className="text-xs text-emerald-600/80 mt-1">
                    {doc.chars?.toLocaleString()} characters read
                    {doc.features_preview?.length
                      ? ` · ${doc.features_preview.length} sections detected`
                      : ""}
                    {doc.images_found
                      ? ` · ${doc.images_found} diagram${doc.images_found === 1 ? "" : "s"}/screenshot${doc.images_found === 1 ? "" : "s"} will be analysed too`
                      : ""}
                  </p>
                  {doc.features_preview?.length > 0 && (
                    <ul className="mt-3 pt-3 border-t border-emerald-200/70 space-y-1">
                      {doc.features_preview.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-xs text-emerald-700/80 truncate">
                          • {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {!isRunning && (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STEP 2 — ANALYSE */}
        {doc && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Analyse the requirements
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-5 ml-8">
              One quick pass to find the requirements in your document. You will
              see what designing test cases for them costs before anything is
              charged.
            </p>

            {!run && (
              <div className="mb-5 ml-8">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={14} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">
                    AI provider credentials
                  </span>
                  <span className="text-xs text-red-500">*</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  At least one key is required. Keys are sent with this run only
                  and are never stored.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="tcd-openai-key"
                      className="block text-xs text-slate-500 mb-1"
                    >
                      OpenAI API Key
                    </label>
                    <input
                      id="tcd-openai-key"
                      type="password"
                      autoComplete="off"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="tcd-anthropic-key"
                      className="block text-xs text-slate-500 mb-1"
                    >
                      Anthropic API Key
                    </label>
                    <input
                      id="tcd-anthropic-key"
                      type="password"
                      autoComplete="off"
                      placeholder="sk-ant-..."
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Errors belong to whichever step is live. Once the gate is on
                screen it owns them, or the same banner appears twice. */}
            {creditError && !isAnalysed && (
              <div className="mb-4 flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <Coins className="text-amber-500 shrink-0" size={18} />
                <p className="text-sm text-amber-700">{creditError}</p>
              </div>
            )}

            {error && !isAnalysed && (
              <div className="mb-4 flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertTriangle className="text-red-500 shrink-0" size={18} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {!run && (
              <button
                type="button"
                onClick={startAnalysis}
                disabled={starting || !hasKey}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition"
              >
                {starting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Starting…
                  </>
                ) : (
                  <>
                    <ListChecks size={18} />{" "}
                    {hasKey ? "Analyse requirements" : "Add an API key to continue"}
                  </>
                )}
              </button>
            )}

            {isAnalysing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-2">
                    <Loader2 className="animate-spin text-orange-500" size={16} />
                    {run.stage || "working"}
                  </span>
                  {run.total ? (
                    <span className="text-slate-400 tabular-nums">
                      {run.done || 0} / {run.total}
                    </span>
                  ) : null}
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

          </div>
        )}


        {/* STEP 3 — THE GATE: what it costs, before it is spent */}
        {isAnalysed && (
          <div className="bg-white rounded-2xl border-2 border-orange-200 p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Confirm the run
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-5 ml-8">
              Nothing has been charged yet. Designing test cases is one pass per
              requirement, written as Given / When / Then.
            </p>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 mb-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-3xl font-black text-slate-900 tabular-nums">
                  {run.requirements}
                </span>
                <span className="text-slate-600">
                  requirement{run.requirements === 1 ? "" : "s"} found
                </span>
                {run.modules?.length > 0 && (
                  <span className="text-slate-400 text-sm">
                    across {run.modules.length} module
                    {run.modules.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {run.modules?.length > 0 && (
                <p className="text-xs text-slate-500 mt-2 truncate">
                  {run.modules.slice(0, 6).join(" · ")}
                  {run.modules.length > 6 ? " …" : ""}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-slate-200">
                {estimate ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-800">
                        This will cost about{" "}
                        <span className="font-bold text-orange-700">
                          {estimate.credits} credit
                          {estimate.credits === 1 ? "" : "s"}
                        </span>
                        {estimate.enforced && !unlimited && (
                          <> · you have {balance.toLocaleString()}</>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {estimate.meter === "usage"
                          ? "Managed plan — you are billed for the model usage this run actually reports."
                          : "Held now, then reconciled to what the run actually uses."}
                      </p>
                    </div>
                    {!estimate.sufficient && (
                      <Link
                        to="/upgrade-plan"
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                      >
                        Top up →
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={14} /> Pricing this run…
                  </p>
                )}
              </div>
            </div>

            {creditError && (
              <div className="mb-4 flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <Coins className="text-amber-500 shrink-0" size={18} />
                <p className="text-sm text-amber-700">{creditError}</p>
              </div>
            )}

            {error && (
              <div className="mb-4 flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertTriangle className="text-red-500 shrink-0" size={18} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  confirmAndGenerate({ acknowledgedOversized: needsOversizedOk })
                }
                disabled={authorizing || !estimate}
                className="flex-1 min-w-[220px] bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition"
              >
                {authorizing ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Starting…
                  </>
                ) : needsOversizedOk ? (
                  <>
                    <AlertTriangle size={18} /> Run anyway
                  </>
                ) : (
                  <>
                    <ListChecks size={18} /> Generate test cases
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-6 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}


        {/* DESIGNING — its own card, so an authorized run never looks like it
            has gone back to the analyse step */}
        {(isRunning || isFailed) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Designing the test cases
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-5 ml-8">
              One pass per requirement. This runs to completion — closing the
              page will not stop it.
            </p>

            {isRunning && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-2">
                    <Loader2 className="animate-spin text-orange-500" size={16} />
                    {run.stage || "working"}
                  </span>
                  {run.total ? (
                    <span className="text-slate-400 tabular-nums">
                      {run.done || 0} / {run.total}
                    </span>
                  ) : null}
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {isFailed && (
              <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertTriangle className="text-red-500 shrink-0" size={18} />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    {run.error || "The run failed."}
                  </p>
                  <p className="text-xs text-red-500 mt-1">
                    Held credits are returned automatically.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-red-600 underline mt-2"
                  >
                    Start over
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5 — RESULT */}
        {isDone && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center">
                <Check size={14} />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Specification ready
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Stat label="Requirements" value={run.requirements} />
              <Stat label="Test cases" value={run.test_cases} accent />
              <Stat label="Open questions" value={run.open_questions} />
              <Stat label="Assumptions" value={run.assumptions} />
            </div>

            {run.open_questions > 0 && (
              <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <HelpCircle className="text-amber-500 shrink-0" size={18} />
                <p className="text-sm text-amber-700">
                  <span className="font-semibold">
                    {run.open_questions} open question
                    {run.open_questions === 1 ? "" : "s"}
                  </span>{" "}
                  — gaps your document does not answer. Resolve these before
                  development starts; they are on their own sheet.
                </p>
              </div>
            )}

            {run.failed_reqs?.length > 0 && (
              <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <AlertTriangle className="text-red-500 shrink-0" size={18} />
                <div className="text-sm text-red-700">
                  <p className="font-semibold mb-1">
                    {run.failed_reqs.length} requirement
                    {run.failed_reqs.length === 1 ? "" : "s"} produced no test
                    cases:
                  </p>
                  <ul className="space-y-0.5">
                    {run.failed_reqs.map((f, i) => (
                      <li key={i} className="text-red-600">
                        <span className="font-mono">
                          {typeof f === "string" ? f : f.req_id}
                        </span>
                        {typeof f === "object" && f.reason ? ` — ${f.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-500 mt-2">
                    Everything else was designed normally. Re-running the
                    document will retry these.
                  </p>
                </div>
              </div>
            )}

            {downloaded ? (
              <div className="flex gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <Check className="text-slate-400 shrink-0" size={18} />
                <p className="text-sm text-slate-600">
                  Downloaded. The document was removed from storage — it lives
                  in your downloads folder now.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={download}
                disabled={downloading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition"
              >
                {downloading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Downloading…
                  </>
                ) : (
                  <>
                    <Download size={18} /> Download specification (.xlsx)
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={reset}
              className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 py-2"
            >
              Design from another document
            </button>
          </div>
        )}
      </div>
    </SubscriptionGuard>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "bg-orange-50 border-orange-200"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <p
        className={`text-2xl font-black tabular-nums ${
          accent ? "text-orange-600" : "text-slate-800"
        }`}
      >
        {value ?? 0}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
