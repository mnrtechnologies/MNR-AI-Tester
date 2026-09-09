import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Gauge, Eye, EyeOff, Loader2, ChevronDown, Rocket, Lock, SlidersHorizontal, Users, Upload, KeyRound,
  Globe, LogIn, UserPlus, Layers, Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { apiFetch } from '../api';
import {
  TARGET_AUTH_OPTIONS, NETWORK_PROFILE_OPTIONS, TEST_TYPE_OPTIONS, TEST_INTENT_OPTIONS,
} from '../constants';
import CreatedCredentialsPanel from './CreatedCredentialsPanel';

const INTENT_ICONS = { globe: Globe, login: LogIn, userPlus: UserPlus, layers: Layers, compass: Compass };

// Real Chromium contexts, not HTTP virtual users — each costs hundreds of MB,
// which is why the backend caps them far below MAX_VUS_PER_RUN. Ten is a
// meaningful concurrency test on any ordinary host and a safe default to
// suggest; limits.MAX_JOURNEY_CONCURRENT_SESSIONS is the real ceiling.
const DEFAULT_JOURNEY_SESSIONS = 10;

// One blank endpoint row. `body` is free text so a user can paste JSON
// straight from their network tab; it is parsed and validated on submit
// rather than fighting them character by character as they type.
const emptyEndpoint = () => ({ method: 'GET', path: '', body: '', weight: 1 });

const emptyForm = {
  journey_concurrency: DEFAULT_JOURNEY_SESSIONS,
  virtual_users: '',
  target_url: '',
  prompt: '',
  notify_email: '',
  target_authorization: 'I_OWN_THIS',
  authorized_by_email: '',
  login_email: '',
  login_password: '',
  otp_code: '',
  llm_provider: 'openai',
  openai_api_key: '',
  anthropic_api_key: '',
  pages_to_audit: '',
  network_profiles: [],
  test_types: ['smoke', 'load'],
  signup_email_domain: '',
  login_credentials_pool_text: '',
};

// One `email:password` (or email,password) pair per line — tolerant of
// blank lines and a CSV header row (any line whose first field has no "@"
// is silently skipped, so pasting a "email,password" header does nothing
// harmful rather than becoming a bogus fake pair).
const parseLoginPool = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes(':') ? ':' : ',';
      const [email, ...rest] = line.split(sep);
      return { email: (email || '').trim(), password: rest.join(sep).trim() };
    })
    .filter((c) => c.email.includes('@') && c.password);

export default function RunForm({ disabled, onStarted }) {
  // Who the run belongs to. Without this every run is stored as "unknown"
  // and the credit reconciler skips it entirely — the engine records the
  // usage but nobody is ever charged for it.
  const { user } = useSelector((state) => state.profile);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [credsDismissed, setCredsDismissed] = useState(false);
  const [showLoginPool, setShowLoginPool] = useState(false);
  const [loginPoolMode, setLoginPoolMode] = useState('paste'); // 'paste' | 'csv'
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Which optional sections are even shown. Without this the form presents
  // five near-identical "give me an email and a password" sections at once
  // and there's no way to tell which one your test actually needs.
  const [intent, setIntent] = useState('browse');
  const [showAllOptions, setShowAllOptions] = useState(false);

  // Within "Every feature, timed" there are two ways to get endpoints:
  // 'crawl' explores the site to find them, 'direct' takes them from the user.
  // Direct skips discovery entirely — much faster, no LLM key, exact payloads
  // — but nothing drives a browser, so there are no feature or navigation
  // timings. That trade is stated in the UI before the run, not left to be
  // discovered afterwards from empty panels.
  const [journeyMode, setJourneyMode] = useState('crawl');
  const [endpoints, setEndpoints] = useState([emptyEndpoint()]);
  const directMode = intent === 'feature_journey' && journeyMode === 'direct';

  const setEndpoint = (i, key) => (e) => setEndpoints((p) =>
    p.map((row, idx) => (idx === i ? { ...row, [key]: e.target.value } : row)));
  const addEndpoint = () => setEndpoints((p) => [...p, emptyEndpoint()]);
  const removeEndpoint = (i) => setEndpoints((p) => p.filter((_, idx) => idx !== i));

  /** Rows -> API payload. Returns {ok, endpoints} or {ok:false, error}. */
  const buildDirectEndpoints = () => {
    const out = [];
    for (const [i, row] of endpoints.entries()) {
      const path = (row.path || '').trim();
      if (!path) continue;               // blank rows are simply ignored
      let json_body;
      const raw = (row.body || '').trim();
      if (raw) {
        try {
          json_body = JSON.parse(raw);
        } catch {
          return { ok: false, error: `Endpoint ${i + 1} (${path}): body is not valid JSON.` };
        }
      }
      out.push({
        method: row.method || 'GET',
        path,
        weight: Math.max(parseInt(row.weight, 10) || 1, 1),
        ...(json_body !== undefined ? { json_body } : {}),
      });
    }
    if (!out.length) return { ok: false, error: 'Add at least one endpoint, or switch to exploring the site.' };
    return { ok: true, endpoints: out };
  };


  // Mixed runs act on SEVERAL pages at once, so one URL box can't describe
  // them — each persona needs its own page, its own actions there, and its
  // own share of the users. Only the mixed intent shows these.
  const [mixedFlows, setMixedFlows] = useState([
    { name: 'Login users', url: '', steps: '', weight: 30 },
    { name: 'Dashboard users', url: '', steps: '', weight: 40 },
    { name: 'New signups', url: '', steps: '', weight: 20 },
  ]);
  const setFlow = (i, key) => (e) => setMixedFlows((p) =>
    p.map((f, idx) => (idx === i ? { ...f, [key]: e.target.value } : f)));
  const addFlow = () => setMixedFlows((p) => [...p, { name: '', url: '', steps: '', weight: 10 }]);
  const removeFlow = (i) => setMixedFlows((p) => p.filter((_, idx) => idx !== i));
  const flowsPayload = mixedFlows
    .filter((f) => f.url.trim())
    .map((f) => ({
      name: f.name.trim() || undefined,
      url: f.url.trim(),
      // One action per line, same visible-label form the engine already uses.
      interaction_steps: f.steps.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      weight: Math.max(parseInt(f.weight, 10) || 1, 1),
    }));
  const weightTotal = flowsPayload.reduce((a, f) => a + f.weight, 0);
  const activeIntent = TEST_INTENT_OPTIONS.find((i) => i.id === intent) || TEST_INTENT_OPTIONS[0];
  // Credential sections are dead weight in direct mode: the direct path
  // dispatches straight to the smoke phase, so auth_bootstrap never runs and
  // no browser ever signs in. Neither the target login nor the pool is read,
  // so asking for them would be asking for passwords that go nowhere.
  // They stay for the crawl path, where the pool genuinely gives each
  // concurrent browser session its own identity.
  const DIRECT_HIDES = ['targetLogin', 'loginPool', 'autoCreate', 'signupDomain'];
  const visible = (section) => {
    if (directMode && DIRECT_HIDES.includes(section)) return false;
    return showAllOptions || activeIntent.sections.includes(section);
  };

  // Whatever the chosen intent unlocks starts OPEN — a section that's only
  // shown because it's relevant shouldn't then need a second click to reach.
  useEffect(() => {
    const s = activeIntent.sections;
    setShowCreds(s.includes('targetLogin'));
    setShowAutoCreate(s.includes('autoCreate'));
    setShowLoginPool(s.includes('loginPool'));
  }, [intent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-create-test-accounts feature: a self-contained mini flow, separate
  // from the main run form's own submit/onStarted lifecycle — it starts its
  // OWN run (target_url = the signup page, not whatever's in the main form)
  // and tracks it with simple polling rather than the full WS hook, since
  // this is a lightweight one-off utility action, not the run being tracked
  // by the rest of this page.
  const [showAutoCreate, setShowAutoCreate] = useState(false);
  const [autoCreateUrl, setAutoCreateUrl] = useState('');
  const [autoCreateCount, setAutoCreateCount] = useState('');
  const [autoCreateSubmitting, setAutoCreateSubmitting] = useState(false);
  const [autoCreateRunId, setAutoCreateRunId] = useState(null);
  const [autoCreateStatus, setAutoCreateStatus] = useState(null);
  const autoCreateActive = autoCreateRunId && !['completed', 'failed', 'cancelled'].includes(autoCreateStatus?.status);

  // Does this run need to sign in as an EXISTING user? Asking up front
  // matters because the engine will no longer invent credentials: a plan
  // that needs a login and has none now stops before discovery, instead of
  // typing a made-up address into the target's login form and reporting the
  // resulting 100% rejection as though the target were broken.
  const looksLikeLogin = (() => {
    if (intent === 'login') return true;      // the whole point of that intent
    if (intent === 'signup') return false;    // signup creates the account it uses
    const text = `${form.prompt} ${form.target_url}`.toLowerCase();
    if (/\b(sign\s*-?\s*up|signup|register|registration)\b/.test(text)) return false;
    return /\b(log\s*-?\s*in|login|sign\s*-?\s*in|signin|dashboard|authenticated|logged[- ]in|my account|profile)\b/.test(text);
  })();
  // Three legitimate ways a run can hold real accounts, and the chosen
  // intent decides which the form even offers (TEST_INTENT_OPTIONS.sections):
  // one credential pair for browsing behind a login, a pasted pool of many,
  // or auto-created accounts. Any one counts — having NONE is the problem.
  const hasSingleLogin = Boolean(form.login_email.trim() && form.login_password.trim());
  const hasPastedPool = Boolean(form.login_credentials_pool_text.trim());
  const hasAutoCreate = (parseInt(autoCreateCount, 10) || 0) > 0;
  // Never in direct mode: nothing signs in, so a target URL that merely
  // contains the word "login" must not raise a warning demanding credentials
  // the run would never use.
  const credentialsMissing =
    !directMode && looksLikeLogin && !hasSingleLogin && !hasPastedPool && !hasAutoCreate;

  // Open the credentials section as soon as the run looks like a login test,
  // unless the user has explicitly said it isn't one.
  useEffect(() => {
    if (credentialsMissing && !credsDismissed && visible('targetLogin')) setShowCreds(true);
  }, [credentialsMissing, credsDismissed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoCreateRunId) return undefined;
    let stopped = false;
    let timer;
    const poll = async () => {
      try {
        const d = await apiFetch(`/api/perf/runs/${autoCreateRunId}`);
        if (stopped) return;
        setAutoCreateStatus(d);
        if (!['completed', 'failed', 'cancelled'].includes(d.status)) timer = setTimeout(poll, 3000);
      } catch {
        if (!stopped) timer = setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [autoCreateRunId]);

  const createAccounts = async () => {
    if (!autoCreateUrl.trim()) return toast.error('Signup/registration page URL is required.');
    const n = parseInt(autoCreateCount, 10);
    if (!n || n < 1) return toast.error('Enter how many accounts to create.');
    if (!form.notify_email.trim()) return toast.error('Notification email is required (above).');
    if (!form.authorized_by_email.trim()) return toast.error('Authorized-by email is required (above).');
    const providerKey = form.llm_provider === 'openai' ? form.openai_api_key : form.anthropic_api_key;
    if (!providerKey.trim()) return toast.error(`${form.llm_provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key is required (above).`);

    setAutoCreateSubmitting(true);
    setAutoCreateStatus(null);
    setAutoCreateRunId(null);
    try {
      const body = {
        user_id: user?._id ? String(user._id) : undefined,
        target_url: autoCreateUrl.trim(),
        prompt: `Create ${n} new user accounts by successfully submitting the signup/registration form. Do not test login or any other flow.`,
        notify_email: form.notify_email.trim(),
        target_authorization: form.target_authorization,
        authorized_by_email: form.authorized_by_email.trim(),
        openai_api_key: form.llm_provider === 'openai' ? form.openai_api_key.trim() : undefined,
        anthropic_api_key: form.llm_provider === 'anthropic' ? form.anthropic_api_key.trim() : undefined,
        signup_email_domain: form.signup_email_domain.trim() || undefined,
        auto_create_accounts_count: n,
      };
      const d = await apiFetch('/api/perf/runs/start', { method: 'POST', body: JSON.stringify(body) });
      setAutoCreateRunId(d.run_id);
      toast.success('Creating accounts…');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAutoCreateSubmitting(false);
    }
  };

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const loginPool = parseLoginPool(form.login_credentials_pool_text);

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, login_credentials_pool_text: String(reader.result || '') }));
    reader.readAsText(file);
    e.target.value = ''; // allow re-uploading the same filename later
  };

  const toggleNetworkProfile = (profile) => {
    setForm((p) => ({
      ...p,
      network_profiles: p.network_profiles.includes(profile)
        ? p.network_profiles.filter((x) => x !== profile)
        : [...p.network_profiles, profile],
    }));
  };

  const toggleTestType = (id) => {
    setForm((p) => ({
      ...p,
      test_types: p.test_types.includes(id)
        ? p.test_types.filter((x) => x !== id)
        : [...p.test_types, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (intent === 'mixed') {
      if (!flowsPayload.length) return toast.error('Add at least one user type with a full URL.');
      const bad = flowsPayload.find((f) => !/^https?:\/\//i.test(f.url));
      if (bad) return toast.error(`Each user type needs a full URL starting with https:// — check "${bad.name || bad.url}".`);
    } else if (!form.target_url.trim()) {
      return toast.error('Target URL is required.');
    }
    // A feature-journey run is the "just give me a URL" path: the engine finds
    // the features itself, so demanding prose describing them would defeat the
    // point. The backend synthesizes the planner objective for this intent.
    if (!activeIntent.promptOptional && !form.prompt.trim()) {
      return toast.error('Describe what to test — this drives the autonomous planner.');
    }
    let directPayload = null;
    if (directMode) {
      const built = buildDirectEndpoints();
      if (!built.ok) return toast.error(built.error);
      directPayload = built.endpoints;
    }
    if (!form.notify_email.trim()) return toast.error('Notification email is required.');
    if (!form.authorized_by_email.trim()) return toast.error('Authorization confirmation email is required.');
    // Direct mode names its own endpoints, so nothing is planned or discovered
    // and no model is ever called — demanding a key there would block a run
    // that has no use for one.
    const providerKey = form.llm_provider === 'openai' ? form.openai_api_key : form.anthropic_api_key;
    if (!directMode && !providerKey.trim()) {
      return toast.error(`${form.llm_provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key is required for autonomous planning.`);
    }
    // Catch a missing login here rather than letting the backend's own
    // guard catch it minutes later. Dismissable, because only the user can
    // say for certain that their test doesn't need a session.
    if (credentialsMissing && !credsDismissed) {
      setShowCreds(true);
      return toast.error('This looks like a login test — enter the target login credentials, or mark it as not a login test.');
    }

    setSubmitting(true);
    try {
      const body = {
        // A mixed run has no single target; the run is still recorded
        // against one address, so use the first user type's URL.
        user_id: user?._id ? String(user._id) : undefined,
        target_url: intent === 'mixed' ? flowsPayload[0].url : form.target_url.trim(),
        prompt: form.prompt.trim(),
        notify_email: form.notify_email.trim(),
        target_authorization: form.target_authorization,
        authorized_by_email: form.authorized_by_email.trim(),
        // Each optional block is sent ONLY when its section is actually
        // shown for the chosen intent — otherwise something typed, then
        // navigated away from by switching intent, would still be silently
        // submitted and change how the run behaves with no visible sign of
        // it anywhere on the form.
        login_email: visible('targetLogin') ? form.login_email.trim() || undefined : undefined,
        login_password: visible('targetLogin') ? form.login_password || undefined : undefined,
        otp_code: visible('targetLogin') ? form.otp_code.trim() || undefined : undefined,
        openai_api_key: form.llm_provider === 'openai' ? form.openai_api_key.trim() : undefined,
        anthropic_api_key: form.llm_provider === 'anthropic' ? form.anthropic_api_key.trim() : undefined,
        pages_to_audit: form.pages_to_audit.trim()
          ? form.pages_to_audit.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          : undefined,
        network_profiles: form.network_profiles.length ? form.network_profiles : undefined,
        // Sent when EITHER holder of this field is on screen — its own
        // section (signup intent) or the Auto-Create widget (login/mixed),
        // which now carries the same input.
        signup_email_domain: (visible('signupDomain') || visible('autoCreate'))
          ? form.signup_email_domain.trim() || undefined : undefined,
        login_credentials_pool: visible('loginPool') && loginPool.length ? loginPool : undefined,
        // Always sent, never left to the planner LLM to infer — which test
        // type(s) run is the caller's choice, not a guess from prose.
        test_types: form.test_types,
        // The picked intent is real information the backend needs, not just
        // a UI affordance: a "login" run has to explore the login page
        // LOGGED OUT, or the site skips past the login form and the flow
        // can never be observed.
        test_intent: intent,
        // Named endpoints replace discovery entirely — the backend
        // synthesizes the plan and scenario from these and runs the direct
        // path, so no crawl, no planner and no browser walk happen.
        direct_endpoints: directPayload || undefined,
        // Feature-journey only. Sent as a number the backend validates against
        // MAX_JOURNEY_CONCURRENT_SESSIONS; omitted entirely for other intents
        // so nothing carries a meaningless browser-session count.
        // Blank means 'let the planner decide' — send undefined rather
        // than 0, which the API would reject as below the minimum.
        virtual_users: String(form.virtual_users).trim()
          ? Number(form.virtual_users)
          : undefined,
        journey_concurrency: intent === 'feature_journey'
          ? Number(form.journey_concurrency) || DEFAULT_JOURNEY_SESSIONS
          : undefined,
        // Persona rows — mixed runs only. Each carries its own page and its
        // own actions, so discovery can visit them separately.
        mixed_flows: intent === 'mixed' && flowsPayload.length ? flowsPayload : undefined,
      };
      const d = await apiFetch('/api/perf/runs/start', { method: 'POST', body: JSON.stringify(body) });
      toast.success('Performance test started.');
      onStarted(d.run_id, !!(visible('targetLogin') && form.login_email.trim() && form.login_password));
      setForm(emptyForm);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
        <Gauge size={13} /> New Performance Test — describe the flow, the engine plans and runs the rest autonomously
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {/* A mixed run has no single target — each user type carries its own
            full URL in the table below. Showing one box here as well split
            the address across two places and read as though a path in the
            table were somehow relative to it. */}
        {intent !== 'mixed' && (
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Target URL *</label>
            <input value={form.target_url} onChange={set('target_url')} disabled={disabled}
              placeholder="https://www.example.com/dashboard/some-feature"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
          </div>
        )}

        {/* Intent picker — decides which of the optional credential sections
            further down are even shown, so the user isn't asked to choose
            between five near-identical email/password blocks. */}
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
            What are you testing? *
            <span className="text-slate-400 normal-case font-normal"> — this decides which extra details we ask you for below</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TEST_INTENT_OPTIONS.map((opt) => {
              const Icon = INTENT_ICONS[opt.icon];
              const active = intent === opt.id;
              return (
                <button key={opt.id} type="button" disabled={disabled} onClick={() => setIntent(opt.id)}
                  className={`text-left px-3.5 py-3 rounded-xl border transition-all disabled:opacity-50 ${
                    active
                      ? 'bg-orange-50 border-orange-400 ring-1 ring-orange-400'
                      : 'bg-white border-slate-200 hover:border-orange-300'
                  }`}>
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${active ? 'text-orange-600' : 'text-slate-600'}`}>
                    {Icon && <Icon size={13} />} {opt.label}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 leading-snug">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mixed runs only: one row per persona. A mixed test spans several
            pages at once, which the single Target URL box above cannot
            express — each persona needs its own page, its own actions there,
            and its own share of the virtual users. */}
        {intent === 'mixed' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
              User Types *
              <span className="text-slate-400 normal-case font-normal"> — one row per kind of user: the full page URL, what they do there, what share of them</span>
            </label>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              Paste each user type&apos;s own full URL — there is no single target for a mixed run,
              which is why the Target URL box above is hidden. Shares are relative, not percentages
              (30/40/20 and 3/4/2 behave identically). Leave &quot;what they do&quot; empty for a page
              that loads its data on its own (a dashboard); fill it in only where the user has to
              type or click something — one action per line, real values rather than field names,
              ending with the button they press.
            </p>
            <div className="space-y-2">
              {mixedFlows.map((f, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input value={f.name} onChange={setFlow(i, 'name')} disabled={disabled}
                    placeholder="Name (e.g. Login users)"
                    className="md:col-span-3 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                  <input value={f.url} onChange={setFlow(i, 'url')} disabled={disabled}
                    placeholder="https://www.example.com/login"
                    className="md:col-span-3 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-mono focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                  <textarea value={f.steps} onChange={setFlow(i, 'steps')} disabled={disabled} rows={2}
                    placeholder={'what they do here\n(one per line, blank if none)'}
                    className="md:col-span-4 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-50" />
                  <input type="number" min="1" value={f.weight} onChange={setFlow(i, 'weight')} disabled={disabled}
                    placeholder="share"
                    className="md:col-span-1 bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                  <button type="button" onClick={() => removeFlow(i)} disabled={disabled || mixedFlows.length <= 1}
                    title="Remove this user type"
                    className="md:col-span-1 px-2 py-2 rounded-lg border border-slate-200 text-slate-400 text-xs hover:border-rose-300 hover:text-rose-500 transition-colors disabled:opacity-30">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <button type="button" onClick={addFlow} disabled={disabled}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 disabled:opacity-50">
                + Add user type
              </button>
              <p className="text-[11px] text-slate-500">
                {flowsPayload.length
                  ? flowsPayload.map((f) => `${Math.round((f.weight / weightTotal) * 100)}% ${f.name || f.url}`).join(' · ')
                  : 'Add at least one row with a page.'}
              </p>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Each row is explored separately, in its own fresh browser — so a persona that logs in
              can&apos;t hide another persona&apos;s login form. Expect discovery to take roughly this
              many times longer than a single-page run.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
            What should be tested?{activeIntent.promptOptional ? '' : ' *'}
            <span className="text-slate-400 normal-case font-normal">
              {activeIntent.promptOptional
                ? ' — optional here; add anything specific you want covered'
                : ' — describe the real flow (selections, forms, what a user does), and how much load'}
            </span>
          </label>
          <textarea value={form.prompt} onChange={set('prompt')} disabled={disabled} rows={activeIntent.promptOptional ? 2 : 4}
            required={!activeIntent.promptOptional}
            placeholder={activeIntent.promptPlaceholder}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none disabled:opacity-50" />

          <div className="mt-3">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Virtual users
              <span className="text-slate-400 normal-case font-normal"> — how much HTTP load to apply</span>
            </label>
            <input type="number" min={1} max={1500} disabled={disabled}
              placeholder="leave blank to let the planner decide"
              value={form.virtual_users} onChange={set('virtual_users')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Applied to the load phase; stress and spike scale up from it proportionally.
              Left blank, the level is inferred from your prompt.
            </p>
          </div>

          {intent === 'feature_journey' && (
            <div className="mt-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/60">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
                How should we find the endpoints?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'crawl',
                    title: 'Explore my site',
                    blurb: 'Drives a real browser through the app, finds the features and the API calls behind them, and times each one.',
                    cost: 'Needs an OpenAI key · 15–20 min',
                  },
                  {
                    id: 'direct',
                    title: "I'll give you the endpoints",
                    blurb: 'Skips exploring. Sends load straight to the endpoints you name, with the exact payloads you provide.',
                    cost: 'No key needed · ~1 min to results',
                  },
                ].map((opt) => {
                  const active = journeyMode === opt.id;
                  return (
                    <button
                      key={opt.id} type="button" disabled={disabled}
                      onClick={() => setJourneyMode(opt.id)}
                      className={`text-left p-3 rounded-xl border transition-all disabled:opacity-50
                        ${active ? 'border-orange-400 bg-white shadow-sm ring-1 ring-orange-100'
                                 : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <p className={`text-[13px] font-bold ${active ? 'text-orange-600' : 'text-slate-700'}`}>
                        {opt.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{opt.blurb}</p>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{opt.cost}</p>
                    </button>
                  );
                })}
              </div>

              {directMode && (
                <div className="mt-4">
                  {/* Said before the run, not after: the journey panels will be
                      empty in this mode and the user should know why up front. */}
                  <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 mb-3">
                    <SlidersHorizontal size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      No browser runs in this mode, so you get throughput, error rates and response
                      times <b>per endpoint</b> &mdash; but <b>no feature, navigation or interaction
                      timings</b>, because nothing walks the app.
                    </p>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Endpoints
                    </p>
                    <button type="button" onClick={addEndpoint} disabled={disabled}
                      className="text-[11px] font-bold text-orange-500 hover:text-orange-600 disabled:opacity-50">
                      + Add endpoint
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {endpoints.map((row, i) => (
                      <div key={i} className="p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="flex gap-2">
                          <select value={row.method} onChange={setEndpoint(i, 'method')} disabled={disabled}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50">
                            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((mth) => (
                              <option key={mth} value={mth}>{mth}</option>
                            ))}
                          </select>
                          <input value={row.path} onChange={setEndpoint(i, 'path')} disabled={disabled}
                            placeholder="/api/chatbot"
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                          <input type="number" min={1} value={row.weight} onChange={setEndpoint(i, 'weight')} disabled={disabled}
                            title="Share of traffic relative to the other endpoints"
                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                          {endpoints.length > 1 && (
                            <button type="button" onClick={() => removeEndpoint(i)} disabled={disabled}
                              className="px-2 text-slate-300 hover:text-rose-500 disabled:opacity-50" title="Remove">
                              &times;
                            </button>
                          )}
                        </div>
                        {['POST', 'PUT', 'PATCH'].includes(row.method) && (
                          <textarea value={row.body} onChange={setEndpoint(i, 'body')} disabled={disabled} rows={2}
                            placeholder={'{"conversation_id": "abc", "query": "What are the symptoms of flu?"}'}
                            className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-50" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Weight is each endpoint&rsquo;s share of the traffic. Paste the real JSON body
                    from your network tab &mdash; a wrong shape means you load-test a 400.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeIntent.promptOptional && !directMode && (
            <div className="mt-3">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Concurrent browser sessions
                <span className="text-slate-400 normal-case font-normal"> — real browsers, not virtual users</span>
              </label>
              <input type="number" min={1} max={500} disabled={disabled}
                value={form.journey_concurrency} onChange={set('journey_concurrency')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Each is a full Chromium context costing hundreds of MB, so this is capped
                far below the virtual-user limit. Without a credential pool they all share
                one login — fine for a first look, but not a true multi-user test.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
            Test Type(s) *
            <span className="text-slate-400 normal-case font-normal"> — pick exactly what you want to run, on top of the always-on smoke + load baseline</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TEST_TYPE_OPTIONS.map((opt) => {
              const checked = form.test_types.includes(opt.id);
              return (
                <button key={opt.id} type="button" title={opt.description}
                  disabled={disabled || opt.locked}
                  onClick={() => toggleTestType(opt.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all disabled:cursor-not-allowed ${
                    checked
                      ? opt.locked
                        ? 'bg-slate-200 text-slate-500 border-slate-200'
                        : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'
                  } ${disabled ? 'opacity-50' : ''}`}>
                  {opt.locked && <Lock size={11} />}
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {TEST_TYPE_OPTIONS.find((o) => form.test_types.includes(o.id) && !o.locked)
              ? TEST_TYPE_OPTIONS.filter((o) => form.test_types.includes(o.id)).map((o) => o.description).join(' · ')
              : 'Smoke + Load always run — add Stress, Spike, or Soak for anything beyond the baseline.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Notify Email *</label>
            <input type="email" value={form.notify_email} onChange={set('notify_email')} disabled={disabled} required
              placeholder="you@company.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">AI Provider *</label>
            <select value={form.llm_provider} onChange={set('llm_provider')} disabled={disabled}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50">
              <option value="openai">OpenAI (GPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
            {form.llm_provider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key *
          </label>
          <div className="relative">
            <input type={showApiKey ? 'text' : 'password'} disabled={disabled}
              value={form.llm_provider === 'openai' ? form.openai_api_key : form.anthropic_api_key}
              onChange={set(form.llm_provider === 'openai' ? 'openai_api_key' : 'anthropic_api_key')}
              placeholder={directMode
                ? 'not needed — you supplied the endpoints'
                : (form.llm_provider === 'openai' ? 'sk-proj-…' : 'sk-ant-api03-…')}
              required={!directMode}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
            <button type="button" onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Never persisted — forwarded to the run for its duration only.</p>
        </div>

        {/* Target authorization — a real confirmation gate, never a silently-defaulted checkbox */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Target Authorization *</label>
            <select value={form.target_authorization} onChange={set('target_authorization')} disabled={disabled}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50">
              {TARGET_AUTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Authorized By (email) *</label>
            <input type="email" value={form.authorized_by_email} onChange={set('authorized_by_email')} disabled={disabled} required
              placeholder="you@company.com"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
          </div>
          <p className="md:col-span-2 text-[10px] text-slate-400 -mt-2">
            This tool fires real traffic at the target — confirm you're authorized before starting.
          </p>
        </div>

        {/* Collapsible: target credentials */}
        {visible('targetLogin') && (
        <div>
          <button type="button" onClick={() => setShowCreds((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronDown size={13} className={`transition-transform duration-200 ${showCreds ? 'rotate-180' : ''}`} />
            <Lock size={12} /> Target Login Credentials
            {credentialsMissing ? (
              <span className="text-amber-600 font-semibold normal-case">— required for this test</span>
            ) : (
              <span className="text-slate-400 font-normal normal-case">(optional — only if the flow needs a logged-in session)</span>
            )}
          </button>

          <AnimatePresence>
            {showCreds && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <input value={form.login_email} onChange={set('login_email')} disabled={disabled}
                    placeholder="Login email" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={form.login_password} onChange={set('login_password')} disabled={disabled}
                      placeholder="Login password" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <input value={form.otp_code} onChange={set('otp_code')} disabled={disabled}
                    placeholder="OTP code (if required)" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Never persisted — used once to capture a session, then discarded.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Collapsible: auto-create test accounts — for when you want to load-test
            a login below but don't have real accounts to log in with yet. A
            self-contained mini action (its own URL, its own button, its own
            run) that creates accounts on a SIGNUP page and hands the real
            credentials back, ready to paste into Login Load Test Credentials
            right below it. */}
        {visible('autoCreate') && (
        <div>
          <button type="button" onClick={() => setShowAutoCreate((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronDown size={13} className={`transition-transform duration-200 ${showAutoCreate ? 'rotate-180' : ''}`} />
            <KeyRound size={12} /> Auto-Create Test Accounts
            <span className="text-slate-400 font-normal normal-case">(optional — don't have accounts to log in with yet?)</span>
          </button>
          <AnimatePresence>
            {showAutoCreate && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                <div className="mt-3 space-y-2.5">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Give the SIGNUP/registration page URL (not the login page) and how many accounts to create.
                    This reuses the exact same account-creation logic as signup load testing, except this time
                    the real emails/passwords are captured and handed back instead of discarded — copy the
                    result into Login Load Test Credentials below to load-test the login itself, in a separate run.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input value={autoCreateUrl} onChange={(e) => setAutoCreateUrl(e.target.value)}
                      disabled={disabled || autoCreateSubmitting || autoCreateActive}
                      placeholder="https://www.example.com/signup"
                      className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                    <input type="number" min="1" value={autoCreateCount} onChange={(e) => setAutoCreateCount(e.target.value)}
                      disabled={disabled || autoCreateSubmitting || autoCreateActive}
                      placeholder="Count (e.g. 50)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                  </div>

                  {/* Email domain lives HERE, next to the URL and count, rather
                      than in a section of its own further down: many real
                      signup forms only accept their own company domain, and
                      when this was separated from the widget it got left blank
                      — every generated address was rejected and the whole
                      batch silently produced zero accounts. */}
                  <div>
                    <input value={form.signup_email_domain} onChange={set('signup_email_domain')}
                      disabled={disabled || autoCreateSubmitting || autoCreateActive}
                      placeholder="Email domain (e.g. mnrtechnologies.com) — required if the site only accepts its own domain"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
                    <p className="text-[11px] text-slate-400 mt-1">
                      {form.signup_email_domain.trim()
                        ? <>Accounts will be created as <span className="font-mono text-slate-500">tousif4f2a9c@{form.signup_email_domain.trim()}</span></>
                        : <>Leave blank only if the site accepts any email domain — otherwise every signup is rejected and you get 0 accounts. Blank generates <span className="font-mono text-slate-500">loadtest+xxxx@example.com</span>.</>}
                    </p>
                  </div>
                  <button type="button" onClick={createAccounts} disabled={disabled || autoCreateSubmitting || autoCreateActive}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition-colors disabled:opacity-50">
                    {autoCreateSubmitting || autoCreateActive ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                    {autoCreateActive ? 'Creating…' : 'Create Accounts'}
                  </button>

                  {autoCreateStatus && (
                    <div className="mt-1">
                      {autoCreateStatus.status === 'failed' ? (
                        <p className="text-xs text-rose-600">{autoCreateStatus.error || 'Account creation failed.'}</p>
                      ) : autoCreateStatus.status === 'completed' ? (
                        <CreatedCredentialsPanel runId={autoCreateRunId} count={autoCreateStatus.created_credentials_count} />
                      ) : (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Loader2 size={12} className="animate-spin" /> {autoCreateStatus.phase_label || 'Working…'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Collapsible: login load-test credentials pool — a separate, additional
            feature from Target Login Credentials above. That one gets past a
            login wall so OTHER pages can be tested; this is for when the login
            itself is what you're load testing, with each pair below acting as a
            different concurrent real user logging in at the same time. */}
        {visible('loginPool') && (
        <div>
          <button type="button" onClick={() => setShowLoginPool((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronDown size={13} className={`transition-transform duration-200 ${showLoginPool ? 'rotate-180' : ''}`} />
            <Users size={12} /> Login Load Test Credentials
            <span className="text-slate-400 font-normal normal-case">(optional — load-test the login itself with different real users)</span>
          </button>
          <AnimatePresence>
            {showLoginPool && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                <div className="mt-3 space-y-2.5">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Different from Target Login Credentials above — that one authenticates a single session so
                    OTHER pages can be tested. This is for when the login endpoint itself is what you're load
                    testing: each pair below becomes one concurrent virtual user logging in as a genuinely
                    different real identity, not the same account repeated. Number of pairs = number of
                    concurrent users, exactly.
                  </p>

                  <div className="flex items-center gap-2">
                    <button type="button" disabled={disabled} onClick={() => setLoginPoolMode('paste')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        loginPoolMode === 'paste'
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'
                      }`}>Paste list</button>
                    <button type="button" disabled={disabled} onClick={() => setLoginPoolMode('csv')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        loginPoolMode === 'csv'
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'
                      }`}>
                      <Upload size={11} /> Upload CSV
                    </button>
                  </div>

                  {loginPoolMode === 'csv' && (
                    <input type="file" accept=".csv,.txt" disabled={disabled} onChange={handleCsvUpload}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-600 file:text-xs file:font-bold hover:file:bg-slate-200" />
                  )}

                  <textarea value={form.login_credentials_pool_text} onChange={set('login_credentials_pool_text')}
                    disabled={disabled} rows={4}
                    placeholder={'user1@company.com:Password1!\nuser2@company.com:Password2!\nuser3@company.com:Password3!'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-50" />

                  <p className="text-[11px] font-bold text-slate-500">
                    {loginPool.length > 0
                      ? `${loginPool.length} credential pair${loginPool.length === 1 ? '' : 's'} → ${loginPool.length} concurrent virtual user${loginPool.length === 1 ? '' : 's'}`
                      : 'No valid pairs yet — one per line, email:password (or email,password).'}
                  </p>
                  <p className="text-[10px] text-slate-400">Never persisted — forwarded to the run for its duration only.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Test-account email domain — moved OUT of Advanced so it sits with
            the flows that actually create accounts (signup, and the
            auto-create helper), instead of being buried under an unrelated
            heading the user has no reason to open. */}
        {visible('signupDomain') && (
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Test-Account Email Domain <span className="text-slate-400 normal-case font-normal">(optional)</span>
            </label>
            <input value={form.signup_email_domain} onChange={set('signup_email_domain')} disabled={disabled}
              placeholder="mnr.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" />
            <p className="text-[11px] text-slate-400 mt-1">
              Every created account gets a genuinely unique email either way. Leave blank for obviously-fake test
              addresses (e.g. loadtest+xxxx@example.com) — or set a domain to get realistic-looking ones on it
              instead (e.g. tousif4f2a9c@{form.signup_email_domain.trim() || 'mnr.com'}).
            </p>
          </div>
        )}

        {/* Collapsible: advanced overrides.
            Hidden for "Every feature, timed": everything in here (pages to
            audit, network throttling, signup domain) is either inferred by the
            planner or meaningless for this intent, and the form is long enough
            without options that change nothing. "Show every option" still
            brings it back for anyone who wants it. */}
        {(intent !== 'feature_journey' || showAllOptions) && (
        <div>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronDown size={13} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
            <SlidersHorizontal size={12} /> Advanced
            <span className="text-slate-400 font-normal normal-case">(optional — the planner infers these on its own otherwise)</span>
          </button>
          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                      Pages to Web-Vitals-audit <span className="text-slate-400 normal-case font-normal">(one path per line, relative to target URL)</span>
                    </label>
                    <textarea value={form.pages_to_audit} onChange={set('pages_to_audit')} disabled={disabled} rows={2}
                      placeholder={'/dashboard\n/dashboard/pricing'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none resize-none disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Network Profiles to Simulate</label>
                    <div className="flex flex-wrap gap-2">
                      {NETWORK_PROFILE_OPTIONS.map((p) => (
                        <button key={p} type="button" disabled={disabled} onClick={() => toggleNetworkProfile(p)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            form.network_profiles.includes(p)
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'
                          }`}>{p}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Escape hatch — an unusual combination (e.g. a login pool AND a
            reset pool in one run) is legitimate, so nothing the intent
            picker hides is ever actually unreachable. */}
        <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={showAllOptions} disabled={disabled}
            onChange={(e) => setShowAllOptions(e.target.checked)}
            className="rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
          Show every option, regardless of what I picked above
        </label>

        {/* Rendered here, outside every collapsible section, so it appears
            whichever intent is selected — the sections that collect accounts
            differ per intent, but "this run has no real account to use"
            is a problem for all of them. The engine no longer invents one,
            so surface it now rather than several minutes into a run that
            fails at 100% errors looking like a fault on the target. */}
        {credentialsMissing && !credsDismissed && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <Lock size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-[11px] leading-relaxed text-amber-800">
              <span className="font-semibold">This test needs real login details.</span>{' '}
              {intent === 'login'
                ? 'Paste a list of existing accounts, or use Auto-Create to register new ones first.'
                : 'Enter the login email and password for an account that already exists on the target.'}{' '}
              The engine will not make up an email and password — an invented account cannot sign in,
              so every request would fail and the result would tell you nothing about the target.
              <button type="button" onClick={() => setCredsDismissed(true)}
                className="ml-1 underline font-semibold hover:text-amber-900">
                This isn't a login test
              </button>
            </div>
          </div>
        )}

        <div className="pt-1">
          <button type="submit" disabled={submitting || disabled}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-bold transition-all ${
              submitting || disabled
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25 hover:-translate-y-0.5 active:translate-y-0'
            }`}>
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
              : <><Rocket size={16} /> Start Test</>}
          </button>
        </div>
      </form>
    </div>
  );
}
