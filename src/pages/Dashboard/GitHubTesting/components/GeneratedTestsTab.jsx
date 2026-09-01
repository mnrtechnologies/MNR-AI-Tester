import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Loader2, FlaskConical } from 'lucide-react';

function TestFileCard({ test, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(test.code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure origin / permissions) — the code
      // is still selectable on screen, so fail quietly rather than alarm.
    }
  };

  const lineCount = (test.code || '').split('\n').length;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-left">
        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
        <FlaskConical size={15} className="text-gray-400 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="font-mono text-sm text-gray-800 block truncate">{test.testFilePath}</span>
          <span className="text-[11px] text-gray-400">
            from {test.sourceFile} · {test.framework} · {lineCount} lines
          </span>
        </span>
        <span
          onClick={copy}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && copy(e)}
          className="shrink-0 text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100"
          title="Copy test code"
        >
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        </span>
      </button>

      {open && (
        <pre className="text-[11.5px] leading-relaxed font-mono bg-gray-900 text-gray-100 p-4 overflow-x-auto border-t">
          {test.code}
        </pre>
      )}
    </div>
  );
}

/** Generated Tests tab — same progressive-fill behaviour as the analysis tab:
 *  generation persists one document per source file as it finishes, so these
 *  appear one by one during the run rather than all at the end. */
export default function GeneratedTestsTab({ tests, loading, running, stage }) {
  if (loading && !tests) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
        <Loader2 size={15} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (!tests || tests.length === 0) {
    const notYet = running && ['queued', 'cloning', 'analyzing'].includes(stage);
    return (
      <div className="p-8 text-center">
        {running ? (
          <>
            <Loader2 size={20} className="animate-spin text-orange-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {notYet ? 'Tests are written after the code has been analysed.' : 'Writing test cases…'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Each generated file appears here as it is written.</p>
          </>
        ) : (
          <p className="text-sm text-gray-400">No test files were generated for this run.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {running && (
        <p className="text-xs text-orange-600 flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Still generating — more files may appear.
        </p>
      )}
      {tests.map((t, i) => (
        <TestFileCard key={t.testFilePath} test={t} defaultOpen={tests.length === 1 && i === 0} />
      ))}
    </div>
  );
}
