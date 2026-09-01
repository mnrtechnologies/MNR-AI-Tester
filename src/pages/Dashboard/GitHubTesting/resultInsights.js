/**
 * resultInsights.js — pure helpers that turn a flat list of test results into
 * the things a person actually wants to know.
 *
 * Kept separate from the rendering component so the grouping logic can be
 * reasoned about (and later tested) on its own.
 */

/** Pull the one line a human needs out of a raw traceback. pytest prefixes
 *  real assertion/exception lines with "E   ", and the last of those is
 *  almost always the point of failure. */
export function extractKeyError(message) {
  if (!message) return null;
  const lines = String(message).split('\n');

  // 1. pytest prefixes the actual assertion/exception with "E   ". Definitive.
  const eLines = lines
    .filter((l) => /^E\s{2,}/.test(l))
    .map((l) => l.replace(/^E\s+/, '').trim())
    .filter(Boolean);
  if (eLines.length) return eLines[eLines.length - 1];

  // 2. An explicit "SomeError: message" line (Jest, plain exceptions).
  const errLine = lines.find((l) => /^[A-Za-z_.]*(Error|Exception)\b[^:]*:/.test(l.trim()));
  if (errLine) return errLine.trim();

  // 3. Deepest frame of a pytest traceback: a "path/file.py:NN: in <scope>"
  //    marker followed by the offending source line. This matters when the
  //    traceback is long enough to be truncated before any "E " line — the
  //    failing statement is then the only real signal present.
  let deepest = null;
  lines.forEach((l, i) => {
    if (/:\d+: in /.test(l)) {
      const next = (lines[i + 1] || '').trim();
      if (next && !next.startsWith('_') && !next.startsWith('^')) deepest = next;
    }
  });
  if (deepest) return deepest;

  // 4. pytest marks the failing statement in the test body with a leading ">".
  const marker = lines.find((l) => /^>\s+\S/.test(l));
  if (marker) return marker.replace(/^>\s+/, '').trim();

  // 5. Last resort — skip fixture reprs like "monkeypatch = <...object at 0x...>",
  //    which are context, not the error.
  const useful = lines.find((l) => l.trim() && !/^\w+\s*=\s*</.test(l.trim()));
  return useful ? useful.trim() : null;
}

/**
 * Collapse the variable parts of an error so N tests failing for one reason
 * group into one row. Without this, a single missing env var shows up as 25
 * separate "failures" and buries the fact that there is really only one
 * problem to fix.
 */
function errorSignature(keyError) {
  if (!keyError) return 'unknown';
  return keyError
    .replace(/0x[0-9a-fA-F]+/g, '0xADDR')          // memory addresses
    .replace(/['"][^'"]*['"]/g, 'X')                // quoted values
    .replace(/\b\d+\b/g, 'N')                       // line numbers, counts
    .replace(/[A-Za-z]:\\[^\s]+|\/[^\s]+\//g, 'PATH')
    .slice(0, 200);
}

/** Plain-English reading of the most common failure shapes, plus what to do. */
export function diagnose(keyError) {
  if (!keyError) {
    return {
      explanation: 'The test framework did not report a reason for these failures.',
      fix: 'Re-run to capture full output — tracebacks are recorded for every failing test.',
    };
  }
  const e = keyError.toLowerCase();

  if (e.includes('modulenotfounderror') || e.includes('no module named') || e.includes('cannot find module')) {
    return {
      explanation: 'A package the test needs was not installed in the run environment.',
      fix: 'Add it to your requirements.txt / package.json so the installer picks it up on the next run.',
    };
  }
  if (e.includes('cannot import name') || e.includes('importerror')) {
    return {
      explanation: 'The generated test imported a name that does not exist in your code under that spelling.',
      fix: 'The AI guessed an export wrong. Re-running usually fixes it; the Generated Tests tab shows the import it tried.',
    };
  }
  if (e.includes('api_key') || e.includes('apikey') || e.includes('credential') || e.includes('environment variable') || e.includes('validationerror')) {
    return {
      explanation: 'Your code reads configuration or an API key at import time, and the sandbox does not supply it.',
      fix: 'Your module needs those env vars set before it can be imported at all. Supplying run-time env vars, or deferring client construction until first use, would let these tests reach your logic.',
    };
  }
  if (e.includes('connection') || e.includes('timeout') || e.includes('refused') || e.includes('network') || e.includes('getaddrinfo')) {
    return {
      explanation: 'Something tried to reach the network or a database. Tests run offline for safety.',
      fix: 'That dependency needs mocking. It is listed under the function’s external dependencies in the Business Logic tab.',
    };
  }
  if (e.includes('assert')) {
    return {
      explanation: 'Your code ran fine but returned something different from what its business rules say it should.',
      fix: 'Compare the expected vs actual values below against the rule in the Business Logic tab, and decide which one is wrong.',
    };
  }
  if (e.includes('attributeerror') || e.includes('typeerror') || e.includes('is not a function')) {
    return {
      explanation: 'The test called your code in a way its real signature does not support.',
      fix: 'Usually a generated-test mistake about arguments or return shape, not a defect in your code.',
    };
  }
  if (e.includes('fixture') || e.includes('scope mismatch')) {
    return {
      explanation: 'The generated test set up its pytest fixtures incorrectly.',
      fix: 'A test-harness mistake. Re-running often produces a correct fixture.',
    };
  }
  return { explanation: null, fix: null };
}

/**
 * Group failing tests by shared root cause, largest group first.
 * Returns [{ key, keyError, count, tests, explanation, fix }]
 */
export function groupByRootCause(results) {
  const failing = results.filter((r) => r.status !== 'passed' && r.status !== 'skipped');
  const groups = new Map();

  for (const r of failing) {
    const keyError = extractKeyError(r.failureMessage);
    const key = errorSignature(keyError);
    if (!groups.has(key)) {
      groups.set(key, { key, keyError, tests: [], ...diagnose(keyError) });
    }
    groups.get(key).tests.push(r);
  }

  return [...groups.values()]
    .map((g) => ({ ...g, count: g.tests.length }))
    .sort((a, b) => b.count - a.count);
}

/** Which source file each test came from, with a pass/bug/issue tally. */
export function groupBySourceFile(results, testcases) {
  // code_results rows key on the generated test path; map back to the source
  // file via the testcases the generation stage recorded.
  const sourceByTestPath = {};
  (testcases || []).forEach((tc) => {
    sourceByTestPath[tc.testFilePath] = tc.sourceFile;
    sourceByTestPath[(tc.testFilePath || '').replace(/\\/g, '/')] = tc.sourceFile;
  });

  const files = new Map();
  for (const r of results) {
    const path = (r.testFile || '').split('::')[1] || '';
    const normalized = path.replace(/\\/g, '/').replace(/^generated\//, '');
    const source =
      sourceByTestPath[normalized] ||
      sourceByTestPath[path] ||
      normalized ||
      'unknown';

    if (!files.has(source)) files.set(source, { source, passed: 0, bugs: 0, issues: 0, total: 0 });
    const entry = files.get(source);
    entry.total += 1;
    if (r.status === 'passed') entry.passed += 1;
    else if (r.bucket === 'code_bug') entry.bugs += 1;
    else entry.issues += 1;
  }

  return [...files.values()].sort((a, b) => b.bugs - a.bugs || b.total - a.total);
}

/**
 * How much of what the analysis stage found actually got exercised.
 * This is the honest "what did this run cover?" number — a big pile of
 * passing tests means little if only 2 of 30 functions were ever tested.
 */
export function coverageStats(analyses, testcases, results) {
  const files = analyses || [];
  const functions = files.reduce((n, a) => n + (a.spec?.functions?.length || 0), 0);
  const rules = files.reduce(
    (n, a) =>
      n +
      (a.spec?.functions || []).reduce(
        (m, f) =>
          m + (f.businessRules?.length || 0) + (f.errorPaths?.length || 0) + (f.edgeCases?.length || 0),
        0
      ),
    0
  );
  const filesWithTests = new Set((testcases || []).map((t) => t.sourceFile)).size;
  const executed = (results || []).length;
  const verified = (results || []).filter((r) => r.status === 'passed').length;

  return {
    filesAnalyzed: files.length,
    functionsFound: functions,
    rulesDerived: rules,
    filesWithTests,
    testsExecuted: executed,
    testsVerified: verified,
  };
}
