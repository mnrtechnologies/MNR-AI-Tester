// Real status values this backend uses — db.py's perf_runs.status field.
export const stCfg = {
  queued:    { pill: 'bg-slate-50 text-slate-500 border-slate-200',       dot: 'bg-slate-400 animate-pulse',  label: 'Queued'    },
  running:   { pill: 'bg-orange-50 text-orange-700 border-orange-200',    dot: 'bg-orange-500 animate-pulse', label: 'Running'   },
  completed: { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500',               label: 'Completed' },
  failed:    { pill: 'bg-rose-50 text-rose-700 border-rose-200',          dot: 'bg-rose-500',                  label: 'Failed'    },
  cancelled: { pill: 'bg-slate-50 text-slate-500 border-slate-200',       dot: 'bg-slate-400',                 label: 'Cancelled' },
};

// Real `phase` strings this backend sets across orchestration/tasks_*.py,
// in the order a run actually walks through them. `always` phases show
// regardless of the plan; `conditional` phases only show when relevant
// (see PhasePipeline.jsx, which filters against the run's actual plan).
export const PHASE_ORDER = [
  { id: 'queued',              label: 'Queued',        always: true  },
  { id: 'planning',            label: 'Planning',       always: true  },
  { id: 'discovery',           label: 'Discovery',      always: true  },
  { id: 'auth',                label: 'Auth',           always: false }, // only if login creds supplied
  { id: 'scenario_generation', label: 'Scenario',       always: true  },
  { id: 'smoke',                label: 'Smoke',          always: false, testType: 'smoke' },
  { id: 'load',                 label: 'Load',           always: false, testType: 'load'  },
  { id: 'stress',               label: 'Stress',         always: false, testType: 'stress' },
  { id: 'spike',                label: 'Spike',          always: false, testType: 'spike'  },
  { id: 'soak',                  label: 'Soak',           always: false, testType: 'soak'   },
  { id: 'web_vitals',            label: 'Web Vitals',     always: false, needsPages: true    },
  { id: 'analysis',              label: 'Analysis',       always: true  },
  { id: 'report',                label: 'Report',         always: true  },
];

export const LOADGEN_PHASES = new Set(['smoke', 'load', 'stress', 'spike', 'soak']);

// Smoke and Load are locked ON — the backend always runs them regardless of
// selection (smoke is the pre-flight safety gate; load is the baseline every
// other phase escalates from — see tasks.smoke_test, which unconditionally
// dispatches baseline_load_test once smoke passes, no test_types check on
// either). Stress/Spike/Soak are genuinely optional escalations on top of
// that baseline, and this is where a real per-run choice exists: someone
// wants a quick number, someone wants the breaking point, someone wants all
// of it — that choice belongs to whoever starts the run, not to the planner
// LLM's guess from the prompt.
export const TEST_TYPE_OPTIONS = [
  { id: 'smoke', label: 'Smoke', description: 'Quick sanity check before anything else runs', locked: true },
  { id: 'load', label: 'Load', description: 'Baseline test at your target VU count', locked: true },
  { id: 'stress', label: 'Stress', description: 'Step-ramps VUs upward to find the breaking point', locked: false },
  { id: 'spike', label: 'Spike', description: 'Sudden burst of traffic instead of a gradual ramp', locked: false },
  { id: 'soak', label: 'Soak', description: 'Long-duration sustained load, watches for degradation over time', locked: false },
];

// What the user is actually trying to test. Purely a UI affordance — the
// backend never sees this; it exists because the form had grown five
// PARALLEL credential sections (target login, auto-create, login pool,
// reset/OTP pool, OTP inbox) that all ask for "an email and a password" and
// are genuinely hard to tell apart when shown all at once. Picking an
// intent reveals only the ones that intent actually needs; `sections` is
// what each one unlocks (see RunForm's `visible()`), and "Show every
// option" stays available as the escape hatch for unusual combinations.
export const TEST_INTENT_OPTIONS = [
  {
    id: 'browse',
    icon: 'globe',
    label: 'Browse pages / a flow',
    description: 'Load-test pages and the API calls a normal user triggers.',
    sections: ['targetLogin'],
    promptPlaceholder: 'e.g. Students select a subject, then a chapter, then type a question and send it to the chatbot. Run 50 virtual users ramping over 30s and holding for 3 minutes.',
  },
  {
    id: 'login',
    icon: 'login',
    label: 'The login itself',
    description: 'Many different real users logging in at the same time.',
    // No 'signupDomain' here — the Auto-Create widget carries its own domain
    // field, so listing it too would render the same input twice.
    sections: ['autoCreate', 'loginPool'],
    promptPlaceholder: 'e.g. 50 different users log in at the same time and land on their dashboard. Hold for 3 minutes.',
  },
  {
    id: 'signup',
    icon: 'userPlus',
    label: 'Signup / registration',
    description: 'New accounts being created under load.',
    sections: ['signupDomain'],
    promptPlaceholder: 'e.g. 100 new users register at the same time by submitting the signup form. Ramp over 60s.',
  },
  {
    id: 'mixed',
    icon: 'layers',
    label: 'Mixed / something else',
    description: 'Several user types at once, or anything not listed.',
    sections: ['targetLogin', 'autoCreate', 'loginPool'],
    promptPlaceholder: 'e.g. 70% browse the dashboard, 20% send invalid requests, 10% upload a file. 100 users total for 5 minutes.',
  },
];

export const TARGET_AUTH_OPTIONS = [
  { value: 'I_OWN_THIS', label: 'I own this site' },
  { value: 'I_HAVE_WRITTEN_PERMISSION', label: 'I have written permission to test it' },
];

export const NETWORK_PROFILE_OPTIONS = ['no_throttle', 'fast_4g', 'slow_4g', 'fast_3g', 'slow_3g', 'offline'];

// Expectation-setting copy for phases with no fine-grained live progress of
// their own (loadgen phases have a real-time metrics chart; these don't) —
// shown so a long, quiet wait reads as "normal for this phase" rather than
// "might be stuck." Discovery in particular drives a real browser through
// the target step by step and can legitimately take 5-20+ minutes.
export const PHASE_EXPECTATIONS = {
  planning: 'The planner is reading your prompt and drafting phases/SLA — usually under a minute.',
  discovery: "Driving a real browser through the target to find its actual API calls — this is the slowest phase, often 5-20+ minutes depending on how many steps and pages are involved. Cancel works throughout.",
  auth: 'Logging into the target to capture a session — usually under 30 seconds.',
  scenario_generation: 'Turning the plan and discovered endpoints into a load-test scenario — usually under a minute.',
};

export const LOG_COLOR_CLASS = {
  green:  'text-emerald-400',
  orange: 'text-amber-400',
  red:    'text-rose-400',
  white:  'text-slate-300',
};
