import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, Bug, CheckCircle2, Loader2, AlertTriangle,
  Wrench, Info, Lightbulb, FileCode2, Layers, Target,
} from 'lucide-react';
import {
  extractKeyError, diagnose, groupByRootCause, groupBySourceFile, coverageStats,
} from '../resultInsights';

/* ─────────────────────────── Verdict ─────────────────────────── */

function Verdict({ passed, codeBugs, testIssues, total, topCause, setupOnly, contradictions }) {
  // The test run never started (toolchain missing, install failed). This is
  // NOT "your tests all failed" -- no generated test ran at all, and saying
  // otherwise turns an environment problem into an apparent verdict on the
  // user's code.
  if (setupOnly) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <Wrench size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-700">The test run could not start</p>
          <p className="text-sm text-amber-700/80 mt-1">
            Dependency installation or the test runner itself failed before any generated test could execute,
            so there are no test results to report. See the cause below.
          </p>
          {contradictions > 0 && (
            <p className="text-sm text-amber-800 mt-2 rounded-lg bg-white/70 border border-amber-200 p-2.5">
              <strong>The analysis still found {contradictions} issue{contradictions === 1 ? '' : 's'}</strong> in your
              code — places where it contradicts its own documentation, names or type hints. Those do not depend on
              tests running. Open the <strong>Business Logic</strong> tab to review them.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (codeBugs > 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <Bug size={20} className="text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-700">
            {codeBugs} potential bug{codeBugs === 1 ? '' : 's'} found in your code
          </p>
          <p className="text-sm text-red-600/80 mt-1">
            {codeBugs === 1 ? 'This test' : 'These tests'} ran against your real code and got an answer that
            contradicts a rule in the Business Logic tab. Start here — everything else in this report is secondary.
          </p>
        </div>
      </div>
    );
  }

  if (total > 0 && passed === total) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
        <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-green-700">All {total} tests passed</p>
          <p className="text-sm text-green-600/80 mt-1">
            Every rule the AI derived from your code held up — including the edge cases and error paths it
            identified, not just the happy path.
          </p>
        </div>
      </div>
    );
  }

  if (testIssues > 0 && passed === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <Wrench size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-700">Your code was never actually tested</p>
          <p className="text-sm text-amber-700/80 mt-1">
            All {testIssues} generated tests crashed <strong>before</strong> reaching any of your logic, so this run
            tells you nothing about whether your code is correct. This is a test-environment problem, not a defect
            in your repository.
          </p>
          {topCause && (
            <p className="text-sm text-amber-700/90 mt-2">
              <strong>{topCause.count} of them failed for one single reason</strong> — fixing that one thing is
              likely all that stands between you and a real result.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
      <Info size={20} className="text-gray-500 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-gray-700">{passed} of {total} tests passed</p>
        <p className="text-sm text-gray-500 mt-1">
          No failure was attributed to your source code — the other {total - passed} failed for
          test-environment reasons, grouped by cause below.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── Coverage summary ────────────────────── */

function CodeCoverageRow({ coverage }) {
  const entries = Object.entries(coverage || {});
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t">
      <p className="text-[11px] text-gray-400 mb-1.5">
        Line coverage — the actual % of your code the executed tests reached (separate from the business-logic
        count above, which is about rules the AI derived, not lines run):
      </p>
      <div className="flex flex-wrap gap-3">
        {entries.map(([lang, pct]) => (
          <span key={lang} className="text-xs bg-gray-50 border rounded-full px-2.5 py-1">
            <span className="capitalize text-gray-500">{lang}</span>{' '}
            <span className="font-semibold text-gray-800 tabular-nums">{pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CoverageBar({ stats, codeCoverage }) {
  const { filesAnalyzed, functionsFound, rulesDerived, filesWithTests, testsExecuted, testsVerified } = stats;
  const items = [
    { label: 'Files analysed', value: filesAnalyzed, icon: FileCode2 },
    { label: 'Functions found', value: functionsFound, icon: Layers },
    { label: 'Rules derived', value: rulesDerived, icon: Target },
    { label: 'Tests executed', value: testsExecuted, icon: CheckCircle2 },
  ];

  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">What this run covered</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={15} className="text-gray-300 shrink-0" />
            <span>
              <span className="block text-lg font-bold text-gray-800 tabular-nums leading-none">{value}</span>
              <span className="block text-[11px] text-gray-400 mt-0.5">{label}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t">
        {testsVerified > 0 ? (
          <>
            <strong className="text-gray-600">{testsVerified}</strong> of the {rulesDerived} derived rules were
            confirmed to hold in {filesWithTests} file{filesWithTests === 1 ? '' : 's'}.
          </>
        ) : (
          <>
            {rulesDerived} rules were derived from your code, but none could be confirmed — see the causes below.
          </>
        )}
      </p>
      <CodeCoverageRow coverage={codeCoverage} />
    </div>
  );
}

/* ───────────────────── Root-cause grouping ───────────────────── */

function RootCauseCard({ group, rank }) {
  const [open, setOpen] = useState(rank === 0);

  return (
    <div className="border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-start gap-2 px-4 py-3 hover:bg-gray-50 text-left">
        {open ? <ChevronDown size={15} className="mt-0.5 text-gray-400 shrink-0" />
              : <ChevronRight size={15} className="mt-0.5 text-gray-400 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold bg-gray-800 text-white rounded-full px-2 py-0.5 tabular-nums">
              {group.count} test{group.count === 1 ? '' : 's'}
            </span>
            <span className="text-sm text-gray-700">failed with</span>
          </span>
          <span className="block font-mono text-xs text-red-600 mt-1.5 break-words">
            {group.keyError || 'No error detail captured'}
          </span>
          {group.explanation && (
            <span className="block text-xs text-gray-600 mt-1">{group.explanation}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t bg-gray-50/60 px-4 py-3 space-y-3">
          {group.fix && (
            <p className="text-xs text-gray-700 flex items-start gap-2 bg-white border rounded-lg p-2.5">
              <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <span><strong>How to fix:</strong> {group.fix}</span>
            </p>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">
              Affected tests ({group.count})
            </p>
            <div className="space-y-1">
              {group.tests.map((t) => <TestRow key={t.testFile} r={t} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────── Per-file breakdown ───────────────────── */

function FileBreakdown({ files }) {
  if (files.length <= 1) return null;
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-4 pt-3 pb-2">
        Results by source file
      </p>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {files.map((f) => (
            <tr key={f.source}>
              <td className="px-4 py-2 font-mono text-xs text-gray-700 truncate max-w-0 w-full">{f.source}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">
                {f.passed > 0 && <span className="text-xs text-green-600 mr-2">{f.passed} passed</span>}
                {f.bugs > 0 && <span className="text-xs text-red-600 mr-2 font-medium">{f.bugs} bugs</span>}
                {f.issues > 0 && <span className="text-xs text-amber-600">{f.issues} issues</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Test row ──────────────────────────── */

function TestRow({ r }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(r.failureMessage);
  const shortName = (r.testFile || '').split('::').pop();
  const keyError = extractKeyError(r.failureMessage);
  const { explanation } = diagnose(keyError);

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        className={`w-full flex items-start gap-2 px-3 py-2 text-left ${hasDetail ? 'hover:bg-gray-50' : 'cursor-default'}`}
      >
        {hasDetail
          ? (open ? <ChevronDown size={13} className="mt-0.5 text-gray-400 shrink-0" />
                  : <ChevronRight size={13} className="mt-0.5 text-gray-400 shrink-0" />)
          : <span className="w-[13px] shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="font-mono text-xs text-gray-800 break-all block">{shortName}</span>
          {explanation && r.status !== 'passed' && (
            <span className="block text-[11px] text-gray-500 mt-0.5">{explanation}</span>
          )}
          {!hasDetail && r.status !== 'passed' && (
            <span className="block text-[11px] text-gray-400 mt-0.5 italic">No error detail was captured.</span>
          )}
        </span>
        {r.durationMs > 0 && (
          <span className="text-[10px] text-gray-300 shrink-0 tabular-nums mt-0.5">
            {Math.round(r.durationMs)}ms
          </span>
        )}
        <span
          className={`text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 ${
            r.status === 'passed' ? 'bg-green-50 text-green-600'
              : r.status === 'skipped' ? 'bg-gray-100 text-gray-500'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {r.status}
        </span>
      </button>

      {open && hasDetail && (
        <div className="border-t">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 px-3 pt-2">Full output</p>
          <pre className="text-[11px] leading-relaxed font-mono bg-gray-900 text-gray-100 p-3 overflow-x-auto whitespace-pre-wrap">
            {r.failureMessage}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Explains how a verdict was reached. This matters more than usual here:
 * tests written from an implementation can normally only confirm the
 * implementation matches itself, so the report has to be explicit about
 * which findings rest on an oracle the code did not author.
 */
function BucketLegend() {
  return (
    <details className="rounded-lg border bg-white p-3 text-xs text-gray-500">
      <summary className="cursor-pointer font-medium text-gray-600">How these verdicts are decided</summary>
      <div className="mt-2.5 space-y-2">
        <p className="flex items-start gap-2">
          <Bug size={12} className="text-red-500 shrink-0 mt-0.5" />
          <span>
            <strong className="text-gray-700">Code bug</strong> — a <em>contract</em> or <em>invariant</em> test failed.
            Contract tests assert what your docstrings, names and type hints promise; invariant tests assert
            properties that must hold regardless of implementation. Because that evidence does not come from the
            function body, a failure here is real evidence about your code.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <Info size={12} className="text-sky-500 shrink-0 mt-0.5" />
          <span>
            <strong className="text-gray-700">Behaviour changed</strong> — a <em>behaviour</em> test failed. These pin
            what your code currently does, so a failure means it changed, not that it is wrong.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <Wrench size={12} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong className="text-gray-700">Test issue</strong> — the test could not run (import error, missing
            config, blocked network). Screened out before any bug is claimed, so a broken test is never reported
            as a defect in your code.
          </span>
        </p>
        <p className="pt-2 border-t text-gray-400">
          Passing tests confirm your code matches its stated intent. They cannot prove that intent is itself
          correct — a rule that is documented and implemented consistently but is wrong for your business will
          pass here.
        </p>
      </div>
    </details>
  );
}

function Tile({ label, value, color, hint }) {
  return (
    <div className="border rounded-lg p-3 text-center bg-white" title={hint}>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

/* ───────────────────────── Main tab ──────────────────────────── */

export default function ResultsTab({ data, analyses, tests, loading, running, stage }) {
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
        <Loader2 size={15} className="animate-spin" /> Loading…
      </div>
    );
  }

  const results = data?.results || [];

  if (results.length === 0) {
    const reached = ['executing', 'reporting'].includes(stage);
    return (
      <div className="p-8 text-center">
        {running ? (
          <>
            <Loader2 size={20} className="animate-spin text-orange-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {reached ? 'Running the generated tests…' : 'Results appear once the tests have been written and run.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {reached ? 'Installing dependencies can take a couple of minutes.' : 'Nothing has been executed yet.'}
            </p>
          </>
        ) : (
          <>
            <AlertTriangle size={18} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">This run produced no test results.</p>
            <p className="text-xs text-gray-400 mt-1">Check the stage bar above to see where it stopped.</p>
          </>
        )}
      </div>
    );
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const codeBugs = results.filter((r) => r.bucket === 'code_bug');
  const behaviorChanges = results.filter((r) => r.bucket === 'behavior_change');
  const testIssues = results.filter((r) => r.bucket === 'test_issue');

  // Every "result" is a synthetic setup-failure placeholder — i.e. no
  // generated test actually ran. Reported very differently from real failures.
  const setupOnly = results.length > 0 && results.every((r) => r.category === 'setup');
  const skipped = results.filter((r) => r.status === 'skipped').length;

  const causes = groupByRootCause(results);
  const fileRows = groupBySourceFile(results, tests);
  const stats = coverageStats(analyses, tests, results);
  const summary = data?.summary || {};
  const repairedFiles = summary.repairedFiles || [];

  return (
    <div className="p-4 space-y-4">
      <Verdict
        passed={passed}
        codeBugs={codeBugs.length}
        testIssues={testIssues.length}
        total={results.length}
        topCause={causes[0]}
        setupOnly={setupOnly}
        contradictions={summary.contradictions || 0}
      />

      {repairedFiles.length > 0 && (
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
          {repairedFiles.length} generated test file{repairedFiles.length === 1 ? '' : 's'} failed to run on the
          first attempt and {repairedFiles.length === 1 ? 'was' : 'were'} automatically rewritten once and
          re-executed — the results below are from that corrected run.
        </p>
      )}

      {/* Suppressed when nothing executed: a row of zeros next to "could not
          start" is noise at best, and reads as a clean bill of health at worst. */}
      {!setupOnly && (
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Passed" value={passed} color={passed > 0 ? 'text-green-600' : 'text-gray-300'}
                hint="Tests that ran and your code satisfied" />
          <Tile label="Code bugs" value={codeBugs.length} color={codeBugs.length > 0 ? 'text-red-600' : 'text-gray-300'}
                hint="Contract or invariant tests your code failed — real findings" />
          <Tile label="Test issues" value={testIssues.length} color={testIssues.length > 0 ? 'text-amber-600' : 'text-gray-300'}
                hint="Tests that could not run properly — not findings about your code" />
          <Tile label="Total run" value={results.length} color="text-gray-700" hint="Total generated tests executed" />
        </div>
      )}

      <CoverageBar stats={stats} codeCoverage={summary.coverage} />

      {codeBugs.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-red-600 flex items-center gap-1.5 mb-1">
            <Bug size={14} /> Bugs in your code ({codeBugs.length})
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            Each ran against your real code and got an answer that breaks a documented rule.
          </p>
          <div className="space-y-1.5">
            {codeBugs.map((r) => <TestRow key={r.testFile} r={r} />)}
          </div>
        </section>
      )}

      {behaviorChanges.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-sky-700 flex items-center gap-1.5 mb-1">
            <Info size={14} /> Behaviour changed ({behaviorChanges.length})
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            These pinned your code&rsquo;s existing behaviour and it no longer matches. Not a defect claim —
            expected if you changed something deliberately, worth a look if you did not.
          </p>
          <div className="space-y-1.5">
            {behaviorChanges.map((r) => <TestRow key={r.testFile} r={r} />)}
          </div>
        </section>
      )}

      {causes.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">
            Why the {results.length - passed} failing test{results.length - passed === 1 ? '' : 's'} failed
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            Grouped by root cause — {causes.length} distinct problem{causes.length === 1 ? '' : 's'}, largest first.
          </p>
          <div className="space-y-2">
            {causes.map((g, i) => <RootCauseCard key={g.key} group={g} rank={i} />)}
          </div>
        </section>
      )}

      <FileBreakdown files={fileRows} />

      {passed > 0 && (
        <details>
          <summary className="text-sm font-medium text-green-700 cursor-pointer flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Passed ({passed})
          </summary>
          <div className="space-y-1.5 mt-2">
            {results.filter((r) => r.status === 'passed').map((r) => <TestRow key={r.testFile} r={r} />)}
          </div>
        </details>
      )}

      <BucketLegend />

      {skipped > 0 && <p className="text-xs text-gray-400">{skipped} skipped.</p>}
    </div>
  );
}
