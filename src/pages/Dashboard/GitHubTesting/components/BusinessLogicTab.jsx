import React, { useState } from 'react';
import {
  ChevronRight, ChevronDown, FileCode2, Loader2, ShieldAlert, AlertTriangle,
  Plug, Target, BookOpen, Code2, AlertOctagon,
} from 'lucide-react';

const SEVERITY_STYLE = {
  high:   { chip: 'bg-red-100 text-red-700',     border: 'border-red-200 bg-red-50/60' },
  medium: { chip: 'bg-amber-100 text-amber-700', border: 'border-amber-200 bg-amber-50/60' },
  low:    { chip: 'bg-gray-100 text-gray-600',   border: 'border-gray-200 bg-gray-50' },
};

function countContradictions(analysis) {
  return (analysis.spec?.functions || []).reduce(
    (n, f) => n + (f.contradictions?.length || 0), 0
  );
}

/**
 * A contradiction between what the code says it does and what it actually
 * does. This is the only class of finding this technique can honestly claim,
 * because the evidence (a docstring, a type hint, a name) is something the
 * function body did not author — so it is a real oracle, not a restatement
 * of the implementation.
 */
function ContradictionCard({ c }) {
  const style = SEVERITY_STYLE[c.severity] || SEVERITY_STYLE.low;
  return (
    <div className={`border rounded-lg p-3 ${style.border}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <AlertOctagon size={13} className="text-red-500 shrink-0" />
        <span className={`text-[10px] font-semibold uppercase rounded-full px-2 py-0.5 ${style.chip}`}>
          {c.severity || 'low'} severity
        </span>
        {c.confidence && (
          <span className="text-[10px] text-gray-400">{c.confidence} confidence</span>
        )}
      </div>

      <dl className="space-y-1.5 text-xs">
        <div className="flex gap-2">
          <dt className="text-gray-400 w-16 shrink-0">Should</dt>
          <dd className="text-gray-800 flex-1">{c.expected}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-400 w-16 shrink-0">Actually</dt>
          <dd className="text-red-700 flex-1">{c.actual}</dd>
        </div>
        {c.evidence && (
          <div className="flex gap-2">
            <dt className="text-gray-400 w-16 shrink-0">Evidence</dt>
            <dd className="text-gray-600 flex-1 italic">{c.evidence}</dd>
          </div>
        )}
        {c.trigger && (
          <div className="flex gap-2">
            <dt className="text-gray-400 w-16 shrink-0">Trigger</dt>
            <dd className="font-mono text-[11px] text-gray-700 flex-1 break-all">{c.trigger}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function RuleList({ icon: Icon, title, items, tone }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2.5">
      <p className={`text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1 ${tone}`}>
        <Icon size={11} /> {title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-gray-600 pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-gray-300">
            {typeof it === 'string' ? it : JSON.stringify(it)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FunctionCard({ fn }) {
  const contradictions = fn.contradictions || [];
  const [open, setOpen] = useState(contradictions.length > 0);

  return (
    <div className={`border rounded-lg overflow-hidden ${contradictions.length > 0 ? 'border-red-200' : ''}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 text-left">
        {open ? <ChevronDown size={14} className="mt-0.5 text-gray-400 shrink-0" />
              : <ChevronRight size={14} className="mt-0.5 text-gray-400 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="font-mono text-sm text-gray-800 break-all">{fn.name}</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {fn.documentedIntent || fn.description || fn.actualBehavior}
          </span>
        </span>
        {contradictions.length > 0 && (
          <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5 shrink-0 mt-0.5 whitespace-nowrap">
            {contradictions.length} issue{contradictions.length === 1 ? '' : 's'}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t bg-gray-50/50">
          {fn.signature && (
            <pre className="text-[11px] font-mono bg-white border rounded p-2 overflow-x-auto text-gray-700">
              {fn.signature}
            </pre>
          )}

          {contradictions.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600 flex items-center gap-1 mb-1.5">
                <AlertOctagon size={11} /> Code contradicts its own documentation
              </p>
              <div className="space-y-2">
                {contradictions.map((c, i) => <ContradictionCard key={i} c={c} />)}
              </div>
            </div>
          )}

          {/* Intent vs reality, shown side by side — the whole basis for the
              contradictions above, so it is worth seeing explicitly. */}
          {(fn.documentedIntent || fn.actualBehavior) && (
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {fn.documentedIntent && (
                <div className="bg-white border rounded p-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1 mb-1">
                    <BookOpen size={10} /> Supposed to
                  </p>
                  <p className="text-xs text-gray-700">{fn.documentedIntent}</p>
                  {fn.intentSources?.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">from: {fn.intentSources.join(', ')}</p>
                  )}
                </div>
              )}
              {fn.actualBehavior && (
                <div className="bg-white border rounded p-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1 mb-1">
                    <Code2 size={10} /> Actually does
                  </p>
                  <p className="text-xs text-gray-700">{fn.actualBehavior}</p>
                </div>
              )}
            </div>
          )}

          <RuleList icon={Target} title="Invariants (must always hold)" items={fn.invariants} tone="text-indigo-600" />
          <RuleList icon={ShieldAlert} title="Business rules" items={fn.businessRules} tone="text-orange-600" />
          <RuleList icon={AlertTriangle} title="Error paths" items={fn.errorPaths} tone="text-red-500" />
          <RuleList icon={AlertTriangle} title="Edge cases to test" items={fn.edgeCases} tone="text-amber-600" />
          <RuleList icon={Plug} title="External dependencies (mocked)" items={fn.externalDependencies} tone="text-sky-600" />
        </div>
      )}
    </div>
  );
}

function FileSection({ analysis, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const fns = analysis.spec?.functions || [];
  const issues = countContradictions(analysis);

  return (
    <div className={`border rounded-xl overflow-hidden ${issues > 0 ? 'border-red-200' : ''}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-left">
        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
        <FileCode2 size={15} className="text-gray-400 shrink-0" />
        <span className="font-mono text-sm text-gray-800 truncate flex-1">{analysis.filePath}</span>
        {issues > 0 && (
          <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5 shrink-0">
            {issues} contradiction{issues === 1 ? '' : 's'}
          </span>
        )}
        <span className="text-[11px] text-gray-400 shrink-0">
          {fns.length === 0 ? 'no testable logic' : `${fns.length} function${fns.length === 1 ? '' : 's'}`}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t">
          <p className="text-sm text-gray-600 py-3">{analysis.spec?.purpose}</p>
          <div className="space-y-2">
            {fns.map((fn, i) => <FunctionCard key={`${fn.name}-${i}`} fn={fn} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BusinessLogicTab({ analyses, loading, running, incomplete, progress }) {
  if (loading && !analyses) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
        <Loader2 size={15} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!analyses || analyses.length === 0) {
    return (
      <div className="p-8 text-center">
        {running ? (
          <>
            <Loader2 size={20} className="animate-spin text-orange-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {progress?.label ? 'Reading ' : 'Auditing your code…'}
              {progress?.label && <span className="font-mono text-gray-700">{progress.label}</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {progress?.total
                ? `${progress.current} of ${progress.total} files analysed so far — each appears here as it completes.`
                : 'Each file appears here as soon as it has been analysed.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">No business-logic document was produced for this run.</p>
        )}
      </div>
    );
  }

  const totalIssues = analyses.reduce((n, a) => n + countContradictions(a), 0);

  const missingFiles = incomplete?.missingFiles || [];

  return (
    <div className="p-4 space-y-3">
      {/* A partial analysis must never be presented as a complete one — the
          contradiction count below is only "0 for the files we got back". */}
      {missingFiles.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              This analysis is incomplete — {missingFiles.length} file
              {missingFiles.length === 1 ? '' : 's'} could not be analysed
            </p>
            <p className="text-xs text-amber-700/80 mt-0.5">
              The model&rsquo;s response hit its output limit, so these files were cut off. Everything below is
              accurate for the files that did come back. Re-running with fewer files selected will cover them.
            </p>
            <p className="text-[11px] text-amber-700/70 mt-1.5 font-mono break-all">
              {missingFiles.slice(0, 6).join(', ')}
              {missingFiles.length > 6 ? ` +${missingFiles.length - 6} more` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Contradictions are findings in their own right — they are established
          by reading the code, so they stand even when every generated test
          later fails to execute. Surfacing the count up front matters. */}
      {totalIssues > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
          <AlertOctagon size={17} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {totalIssues} place{totalIssues === 1 ? '' : 's'} where the code contradicts its own documentation
            </p>
            <p className="text-xs text-red-600/80 mt-0.5">
              Found by comparing docstrings, names and type hints against what the code actually does —
              independent of whether the generated tests ran.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-3 text-xs text-gray-500">
          No contradictions found between the code and its documentation, names, or type hints.
        </div>
      )}

      {running && (
        <p className="text-xs text-orange-600 flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Still analysing — more files may appear.
        </p>
      )}

      {analyses.map((a, i) => (
        <FileSection key={a.filePath} analysis={a} defaultOpen={countContradictions(a) > 0 || analyses.length === 1 || i === 0} />
      ))}
    </div>
  );
}
