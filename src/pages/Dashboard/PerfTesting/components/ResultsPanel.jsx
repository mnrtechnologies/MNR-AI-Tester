import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp, Download, FileWarning, XCircle } from 'lucide-react';
import CoverageCaveatBanner from './CoverageCaveatBanner';
import CreatedCredentialsPanel from './CreatedCredentialsPanel';
import { fmtMs, getReportUrl } from '../api';
import { LOAD_PHASE_INFO } from '../constants';

/**
 * One load phase, explained rather than tabulated.
 *
 * Leads with what the phase was for, then its headline numbers in plain
 * words, then a verdict that accounts for the phase's own purpose — a stress
 * phase hitting errors is doing its job, a load phase hitting the same errors
 * is not.
 */
function PhaseResult({ phase, m }) {
  const info = LOAD_PHASE_INFO[phase] || {};
  const errorPct = m.error_rate_pct ?? 0;
  const requests = m.total_requests ?? 0;
  const failures = m.total_failures ?? 0;

  // "Clean" means it did what this particular phase was supposed to do.
  const bad = errorPct >= 5 && !info.errorsAreExpected;
  const watch = errorPct > 0 && errorPct < 5 && !info.errorsAreExpected;

  const tone = bad
    ? { ring: 'border-rose-200', chip: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Needs attention' }
    : watch
      ? { ring: 'border-amber-200', chip: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Some errors' }
      : { ring: 'border-slate-200', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: info.errorsAreExpected ? 'Ceiling probed' : 'Clean' };

  return (
    <div className={`bg-white rounded-2xl border ${tone.ring} p-5`}>
      <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
        <h4 className="text-sm font-bold text-slate-800 capitalize">{phase}</h4>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tone.chip}`}>
          {tone.label}
        </span>
        {m.vus_avg != null && (
          <span className="text-[11px] text-slate-400">
            about {Math.round(m.vus_avg)} simultaneous users
          </span>
        )}
      </div>

      {info.question && (
        <p className="text-[13px] font-semibold text-slate-700 mb-1">{info.question}</p>
      )}
      {info.what && <p className="text-[13px] text-slate-600 leading-relaxed">{info.what}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <Figure label="Requests sent" value={requests.toLocaleString()} />
        <Figure label="Failed" value={failures.toLocaleString()}
                sub={`${errorPct.toFixed(1)}% of all requests`}
                tone={bad ? 'bad' : watch ? 'watch' : undefined} />
        <Figure label="Typical response" value={fmtMs(m.p50_ms)} sub="half were faster" />
        <Figure label="Slowest 5%" value={fmtMs(m.p95_ms)} sub="worst realistic wait" />
      </div>

      {m.rps_avg != null && (
        <p className="text-[11px] text-slate-400 mt-3">
          Sustained about {(m.rps_avg).toFixed(1)} requests per second.
          {info.reading ? ` ${info.reading}` : ''}
        </p>
      )}

      {/* Per endpoint, because the figures above are averaged across all of
          them at once. An expensive call behind several cheap ones barely
          moves the aggregate, so this is where a slow endpoint becomes
          visible — and where "how many users hit THIS endpoint at the same
          time" gets an honest answer. */}
      {(m.per_endpoint || []).length > 0 && (
        <div className="mt-4 -mx-5 -mb-5 border-t border-slate-100">
          <div className="px-5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Per endpoint
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-400">
                  <th className="text-left font-semibold px-5 py-1.5 text-[10px] uppercase tracking-wider">Endpoint</th>
                  <th className="text-right font-semibold px-3 py-1.5 text-[10px] uppercase tracking-wider whitespace-nowrap">Requests</th>
                  <th className="text-right font-semibold px-3 py-1.5 text-[10px] uppercase tracking-wider whitespace-nowrap">At once</th>
                  <th className="text-right font-semibold px-3 py-1.5 text-[10px] uppercase tracking-wider whitespace-nowrap">Typical</th>
                  <th className="text-right font-semibold px-5 py-1.5 text-[10px] uppercase tracking-wider whitespace-nowrap">Slowest 5%</th>
                </tr>
              </thead>
              <tbody>
                {m.per_endpoint.map((e, i) => {
                  const slow = e.p95_ms >= 2000;
                  return (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-5 py-2 font-mono text-slate-700">
                        <span className="font-bold text-slate-500 mr-1.5">{e.method}</span>
                        <span className="break-all">{e.path}</span>
                        {e.failures > 0 && (
                          <span className="ml-2 text-rose-600">{e.failures} failed</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {(e.requests || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700"
                          title={`${e.rps} requests/sec against this endpoint`}>
                        {e.concurrent_avg}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtMs(e.p50_ms)}</td>
                      <td className={`px-5 py-2 text-right tabular-nums font-semibold ${slow ? 'text-amber-600' : 'text-slate-700'}`}>
                        {fmtMs(e.p95_ms)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-50">
            <b className="font-semibold text-slate-500">At once</b> is how many requests were
            genuinely in flight against that endpoint on average &mdash; not the run&rsquo;s total
            user count, which is spread across every endpoint in the scenario.
          </p>
        </div>
      )}
    </div>
  );
}

/** One web-vital reading: plain-English name first, jargon abbreviation
 *  second, and a colour that says whether it clears Google's threshold. */
function Vital({ label, abbr, value, good, hint }) {
  const tone = good === null ? 'text-slate-400'
    : good ? 'text-emerald-600' : 'text-amber-600';
  return (
    <div title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
        {label} <span className="text-slate-300 normal-case">{abbr}</span>
      </p>
      <p className={`text-base font-semibold tabular-nums leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
    </div>
  );
}

function Figure({ label, value, sub, tone }) {
  const color = tone === 'bad' ? 'text-rose-600' : tone === 'watch' ? 'text-amber-600' : 'text-slate-800';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className={`text-lg font-semibold tabular-nums leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ResultsPanel({ run }) {
  if (!run) return null;
  const breaches = run.sla_breaches || [];
  const phaseResults = run.phase_results || {};
  const phaseRows = Object.entries(phaseResults).filter(([, m]) => m && typeof m === 'object');
  const webVitals = run.web_vitals || [];

  return (
    <div className="space-y-4">
      <CoverageCaveatBanner caveat={run.coverage_caveat} />

      {/* A run that failed before any phase produced results (e.g. the smoke-test
          safety gate aborted it) has nothing SLA-related to report — showing the
          usual green "All SLA thresholds met" banner in that case would be
          actively misleading, since no threshold was ever actually checked. */}
      {run.status === 'failed' && run.error && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
          <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">Run failed</p>
            <p className="text-sm text-rose-700 leading-relaxed">{run.error}</p>
          </div>
        </div>
      )}

      {/* SLA verdict — only meaningful once at least one phase actually ran AND
          the run didn't fail; sla_breaches is computed by llm_analysis, which a
          failed run never reaches, so an empty breach list there doesn't mean
          "thresholds were met," just that they were never checked. */}
      {phaseRows.length > 0 && run.status !== 'failed' && (
        <div className={`flex items-start gap-3 rounded-2xl px-5 py-4 border ${
          breaches.length ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          {breaches.length
            ? <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            : <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${breaches.length ? 'text-rose-800' : 'text-emerald-800'}`}>
              {breaches.length ? `${breaches.length} SLA breach${breaches.length === 1 ? '' : 'es'}` : 'All SLA thresholds met'}
            </p>
            {breaches.length > 0 && (
              <ul className="text-sm text-rose-700 space-y-0.5">
                {breaches.map((b, i) => <li key={i}>• {b}</li>)}
              </ul>
            )}
            {run.breaking_point_vus != null && (
              <p className="text-sm text-slate-600 mt-2 flex items-center gap-1.5">
                <TrendingUp size={13} /> Breaking point: <b>{run.breaking_point_vus} VUs</b>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Auto-create-test-accounts feature: this run's whole purpose was
          creating accounts (no smoke/load phases ever ran), so surface the
          result even for a run found later via Recent Runs, not just the
          one just-started in RunForm's own mini widget. */}
      {run.created_credentials_count > 0 && (
        <CreatedCredentialsPanel runId={run.run_id} count={run.created_credentials_count} />
      )}

      {/* Per-phase results, explained.
          Replaces a bare table of raw column names: the same row of numbers
          means opposite things depending on the phase (errors during stress
          are the goal; the identical errors during load are a real problem),
          and a table cannot say which. */}
      {phaseRows.length > 0 && (
        <div className="space-y-3">
          {phaseRows.map(([phase, m]) => (
            <PhaseResult key={phase} phase={phase} m={m} />
          ))}
        </div>
      )}

      {/* Web Vitals */}
      {webVitals.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Core Web Vitals</p>
          <p className="text-[11px] text-slate-400 mb-3">
            Google&rsquo;s standard measures of how a page <i>feels</i> to load. Measured by an
            automated browser here, not by your real visitors &mdash; so treat them as a like-for-like
            comparison between pages rather than field data.
          </p>

          {/* Named in plain English with a target, because LCP/CLS/TTFB/INP
              are jargon that tells a non-specialist nothing, and a number
              without a threshold cannot be judged good or bad. */}
          <div className="space-y-3">
            {webVitals.map((v, i) => (
              <div key={i} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                <p className="text-[12px] font-mono text-slate-600 truncate mb-2">{v.page_url}</p>
                {v.error ? (
                  <span className="text-rose-500 text-xs">error: {v.error}</span>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Vital
                      label="Main content visible"
                      abbr="LCP" value={v.lcp_ms != null ? fmtMs(v.lcp_ms) : '—'}
                      good={v.lcp_ms != null ? v.lcp_ms <= 2500 : null}
                      hint={v.lcp_ms == null
                        ? 'Not measured — this is an in-app screen, not a fresh page load'
                        : 'Good is under 2.5s'} />
                    <Vital
                      label="Layout jumping"
                      abbr="CLS" value={v.cls ?? '—'}
                      good={v.cls != null ? v.cls <= 0.1 : null}
                      hint="How much things shift while loading. Good is under 0.1" />
                    <Vital
                      label="Server responded"
                      abbr="TTFB" value={fmtMs(v.ttfb_ms)}
                      good={v.ttfb_ms != null ? v.ttfb_ms <= 800 : null}
                      hint="Time to the first byte back. Good is under 800ms" />
                    <Vital
                      label="Responds to a click"
                      abbr="INP" value={v.inp_ms != null ? fmtMs(v.inp_ms) : '—'}
                      good={v.inp_ms != null ? v.inp_ms <= 200 : null}
                      hint={v.inp_ms == null
                        ? 'Not measured — nothing was clicked on this page'
                        : 'Good is under 200ms'} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
            A dash means the metric never fired. That is common and not a fault: an in-app
            screen reached by clicking is not a fresh page load, so there is no
            &ldquo;main content visible&rdquo; moment for the browser to time.
          </p>
        </div>
      )}

      {/* Analysis */}
      {run.analysis_summary && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Analysis</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{run.analysis_summary}</p>
          {(run.recommendations || []).length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {run.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-orange-500">•</span>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Report download */}
      <ReportDownload run={run} />
    </div>
  );
}

/**
 * Download button for the run's Excel workbook.
 *
 * Every sheet the backend can produce is in that file — the phase aggregates,
 * the raw sample timeline the live charts are drawn from, the per-endpoint
 * breakdown, the idle-vs-under-load feature journey, Web Vitals for both
 * passes, and everything discovery found. It is the full export, not a
 * summary of the dashboard.
 *
 * The link is fetched on click rather than rendered as a static href: the URL
 * S3 hands back is signed and expires, so a button rendered when the run
 * finished would silently rot. Asking the API at click time also keeps the
 * ownership check on our side, which a bare <a> to S3 could not do.
 */
function ReportDownload({ run }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // s3_report_key is the honest signal that a file exists in the bucket;
  // s3_report_url alone covers runs from before the key was persisted.
  const available = Boolean(run.s3_report_key || run.s3_report_url);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await getReportUrl(run.run_id);
      // Navigating rather than fetching: the response is a cross-origin S3
      // object, and fetching it into a blob would need CORS on the bucket
      // that we neither control here nor need.
      window.location.assign(url);
    } catch (e) {
      setError(e.message || 'Could not get the download link.');
    } finally {
      setBusy(false);
    }
  };

  if (!available) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-400 text-sm font-bold cursor-not-allowed w-fit"
        title="Report was generated but not uploaded — S3 isn't configured on this deployment.">
        <FileWarning size={14} /> Report not available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={download} disabled={busy}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-wait">
        <Download size={14} /> {busy ? 'Preparing…' : 'Download full report (Excel)'}
      </button>
      <p className="text-[11px] text-slate-400">
        Every number on this page plus the raw chart data, per-endpoint timings and
        per-feature journey results — one sheet each.
      </p>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
