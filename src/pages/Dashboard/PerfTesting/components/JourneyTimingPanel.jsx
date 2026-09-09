import React, { useMemo } from 'react';
import { Timer } from 'lucide-react';
import { fmtMs } from '../api';

/**
 * How long each feature takes to reach — idle, then again under load.
 *
 * This is what a feature-journey run exists to produce. The Locust phases
 * answer "how many requests per second before it errors"; they cannot answer
 * "how long does a user wait after clicking Reports", because an HTTP virtual
 * user never renders anything. These figures come from real browser sessions,
 * timed by the page's own MutationObserver clock and gated on in-flight
 * requests — so a loading skeleton painted before its data arrives does not
 * stop the stopwatch.
 *
 * Both series share one scale on purpose: the slowdown should read as geometry
 * before anyone reads a number.
 *
 * Aggregates live transitions client-side so bars fill in while the run is
 * still going. Once it finishes, `serverSteps` replaces them — the backend saw
 * every session, including any whose rows were trimmed from the live feed.
 */

// A hop has to be meaningfully slower before it earns the amber treatment;
// small deltas on a fast transition are noise, not a finding.
const SLOWDOWN_HIGHLIGHT = 1.15;

function p95(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  // Nearest rank, matching journey/runner.py's _percentile — round() here
  // would put p95 one element too high on small samples.
  return s[Math.max(0, Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1))];
}

function fromLive(transitions) {
  const hops = new Map();
  for (const t of transitions) {
    const key = `${t.from_feature} ${t.to_feature}`;
    if (!hops.has(key)) {
      hops.set(key, { from: t.from_feature, to: t.to_feature, kind: t.kind || 'navigate', idle: [], loaded: [], fails: 0 });
    }
    const h = hops.get(key);
    h.kind = t.kind || 'navigate';
    if (!t.success) { h.fails += 1; continue; }
    (t.label === 'under_load' ? h.loaded : h.idle).push(t.transition_ms);
  }
  return [...hops.values()].map((h) => ({
    from: h.from, to: h.to, kind: h.kind, fails: h.fails,
    idle: p95(h.idle), loaded: p95(h.loaded),
    idleN: h.idle.length, loadedN: h.loaded.length,
  }));
}

function fromServer(baseline, underLoad) {
  const idleByHop = new Map();
  (baseline?.steps || []).forEach((s) =>
    idleByHop.set(`${s.from_feature} ${s.to_feature}`, s));

  const source = underLoad?.steps?.length ? underLoad.steps : (baseline?.steps || []);
  return source.map((s) => {
    const key = `${s.from_feature} ${s.to_feature}`;
    const idle = idleByHop.get(key);
    return {
      from: s.from_feature,
      to: s.to_feature,
      kind: s.kind || 'navigate',
      idle: idle ? idle.p95_ms : (underLoad ? 0 : s.p95_ms),
      loaded: underLoad ? s.p95_ms : 0,
      idleN: idle ? idle.sample_count : s.sample_count,
      loadedN: underLoad ? s.sample_count : 0,
      fails: s.failure_count,
    };
  });
}

export default function JourneyTimingPanel({ transitions, journeyMetrics, loadVus }) {
  const rows = useMemo(() => {
    if (journeyMetrics?.baseline || journeyMetrics?.under_load) {
      return fromServer(journeyMetrics.baseline, journeyMetrics.under_load);
    }
    return fromLive(transitions || []);
  }, [transitions, journeyMetrics]);

  if (!rows.length) return null;

  // Every measured figure rests on a single observation, so the percentiles
  // are really just that one number wearing a percentile's name.
  const thinSamples = rows.every((r) => (r.idleN || 0) <= 1 && (r.loadedN || 0) <= 1);

  // Only rows that actually produced a measurement set the scale. Including
  // failed rows (whose percentile is 0) left the axis reading "0ms 0ms 1ms" on
  // a run where nothing succeeded.
  const measured = rows.filter((r) => r.idleN > 0 || r.loadedN > 0);
  const max = Math.max(...measured.map((r) => Math.max(r.idle, r.loaded)), 1);
  const anyLoaded = rows.some((r) => r.loadedN > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Timer size={14} className="text-orange-500" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Feature Timings
        </p>
      </div>

      {/* Said once, here, instead of stamping "p95" on every row: the jargon
          is what made these numbers hard to read, but the caveat still matters
          — an average would hide the slow tail that users actually complain
          about. */}
      <p className="text-[11px] text-slate-400 mb-1">
        Time until the screen is genuinely usable, not just responding.
        {' '}Each figure is the 95th percentile &mdash; 19 of every 20 attempts were faster.
      </p>

      {/* Two kinds of row, and the difference is the whole point of the
          panel. Without this the "using it" badge reads as decoration. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-1">
        <span className="inline-flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block shrink-0" />
          <b className="font-semibold text-slate-700">A &rarr; B</b>
          &mdash; getting to a screen
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm bg-violet-300 inline-block shrink-0" />
          <b className="font-semibold text-violet-700">using it</b>
          &mdash; doing the actual work there (asking the chatbot, running a search)
          and waiting for the answer
        </span>
      </div>

      {/* The measurement conditions, stated once. A "2x slower" verdict means
          nothing without them: 2x under 20 users and 2x under 1000 are
          completely different findings.

          The thin-sample caveat is derived from the sample counts themselves
          rather than from any setting. A percentile computed from a single
          measurement is not a percentile, and saying so is the difference
          between a number the reader can act on and one that merely looks
          authoritative. */}
      {(loadVus || thinSamples) && (
        <p className="text-[11px] text-slate-500 mb-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {loadVus && (
            <span>
              <b className="font-semibold text-amber-600">{loadVus.toLocaleString()}</b> virtual
              users hitting the API during the loaded pass
            </span>
          )}
          {thinSamples && (
            <span className="text-amber-600">
              one sample per figure &mdash; treat as indicative
            </span>
          )}
        </p>
      )}

      <div className="divide-y divide-slate-100">
        {rows.map((r) => {
          const mult = r.idle && r.loaded ? r.loaded / r.idle : null;
          return (
            <div key={`${r.from}->${r.to}`}
                 className={`py-3 ${
                   r.kind === 'interact' ? 'pl-4 border-l-2 border-violet-200'
                   : r.kind === 'login' ? 'pl-4 border-l-2 border-sky-300'
                   : ''}`}>
              <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                {/* An interaction belongs TO the feature above it, so it reads
                    as "AI Chatbot · asking a question" rather than as another
                    hop between two screens — which is what an arrow would
                    wrongly imply. */}
                <p className="text-[13px] font-semibold text-slate-800">
                  {r.kind === 'login' ? (
                    'Signing in'
                  ) : r.kind === 'interact' ? (
                    <>
                      {r.from} <span className="text-slate-300 mx-0.5">&middot;</span>{' '}
                      <span className="font-normal text-slate-600">{r.to}</span>
                    </>
                  ) : (
                    <>{r.from} <span className="text-slate-300 mx-0.5">&rarr;</span> {r.to}</>
                  )}
                </p>
                {r.kind === 'interact' && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider
                                   px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">
                    using it
                  </span>
                )}
                {r.kind === 'login' && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider
                                   px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                    every user pays this
                  </span>
                )}
                {mult && (
                  <span className={`ml-auto text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full
                    ${mult >= SLOWDOWN_HIGHLIGHT
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                    {mult >= SLOWDOWN_HIGHLIGHT
                      ? `${mult.toFixed(1)}× slower${loadVus ? ` at ${loadVus.toLocaleString()} users` : ' under load'}`
                      : `holds up${loadVus ? ` at ${loadVus.toLocaleString()} users` : ' under load'}`}
                  </span>
                )}
              </div>

              {/* The time itself is the point of this panel, so it is the
                  biggest thing in the row. The bars underneath only exist to
                  make the comparison scannable — reading a number should never
                  require measuring a bar against a scale. */}
              {/* A step where nothing succeeded has no timing, and showing the
                  0 that an empty percentile returns reads as "instant" — the
                  exact opposite of what happened. Say it failed instead. */}
              {r.idleN === 0 && r.loadedN === 0 ? (
                <p className="text-sm text-rose-600 font-medium">
                  Never completed{r.fails > 0 ? ` — all ${r.fails} attempt${r.fails === 1 ? '' : 's'} failed` : ''}.
                  {' '}<span className="font-normal text-slate-500">No timing available.</span>
                </p>
              ) : (
                <>
                  <div className="flex items-end gap-6 flex-wrap">
                    {r.idleN > 0 && (
                      <Reading label="Normally" value={r.idle} n={r.idleN} tone="blue" />
                    )}
                    {r.loadedN > 0 && (
                      <Reading
                        label={loadVus ? `Under ${loadVus.toLocaleString()} users` : 'Under load'}
                        value={r.loaded} n={r.loadedN} tone="amber"
                      />
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {r.idleN > 0 && <Bar tone="blue" value={r.idle} max={max} />}
                    {r.loadedN > 0 && <Bar tone="amber" value={r.loaded} max={max} />}
                  </div>

                  {r.fails > 0 && (
                    <p className="text-[11px] text-rose-600 mt-1.5">
                      {r.fails} {r.kind === 'interact' ? 'attempt' : 'transition'}
                      {r.fails === 1 ? '' : 's'} never completed
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {measured.length > 0 && (
        <div className="flex justify-between pt-2 mt-1 border-t border-slate-100 ml-[76px]
                        text-[10px] font-mono text-slate-400 tabular-nums">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f}>{fmtMs(max * f)}</span>)}
        </div>
      )}

      {!anyLoaded && (
        <p className="text-[11px] text-slate-500 mt-3">
          Baseline only so far — the under-load pass runs alongside the load phase.
        </p>
      )}
    </div>
  );
}

/** One headline time, sized to be read at a glance rather than decoded. */
function Reading({ label, value, n, tone }) {
  const text = tone === 'amber' ? 'text-amber-600' : 'text-blue-600';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
        {label}
      </p>
      <p className={`text-2xl font-semibold tabular-nums leading-none ${text}`}
         title={`95th percentile across ${n} measurement${n === 1 ? '' : 's'}`}>
        {fmtMs(value)}
      </p>
    </div>
  );
}

function Bar({ tone, value, max }) {
  const pct = max ? Math.max(1, (value / max) * 100) : 0;
  const fill = tone === 'amber' ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${fill} transition-[width] duration-300`}
           style={{ width: `${pct.toFixed(1)}%` }} />
    </div>
  );
}
