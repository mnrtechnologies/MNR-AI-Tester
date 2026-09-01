import React, { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Settings2, CheckCircle2, AlertTriangle,
  X, Plus, Eye, EyeOff, ClipboardPaste,
} from 'lucide-react';
import { parseEnvFile, isSecretKey } from '../envParser';

/** Whether a row's value should start hidden. */
const shouldMask = (key) => isSecretKey(key);

function VarRow({ row, onChange, onRemove }) {
  const [revealed, setRevealed] = useState(false);
  const secret = shouldMask(row.key);
  const duplicate = row.duplicate;

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={row.key}
        onChange={(e) => onChange({ ...row, key: e.target.value })}
        spellCheck={false}
        placeholder="KEY"
        className={`w-[38%] border rounded px-2 py-1.5 text-[11px] font-mono ${
          duplicate ? 'border-amber-400 bg-amber-50' : ''
        }`}
        title={duplicate ? 'Duplicate key — the last one wins' : undefined}
      />
      <input
        value={row.value}
        onChange={(e) => onChange({ ...row, value: e.target.value })}
        spellCheck={false}
        type={secret && !revealed ? 'password' : 'text'}
        placeholder="value"
        className="flex-1 min-w-0 border rounded px-2 py-1.5 text-[11px] font-mono"
      />
      {secret && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="text-gray-300 hover:text-gray-600 p-1 shrink-0"
          title={revealed ? 'Hide value' : 'Show value'}
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-300 hover:text-red-500 p-1 shrink-0"
        title="Remove"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * Environment variables for the TARGET REPOSITORY.
 *
 * Two-step by design: paste a whole .env to bulk-load it, then correct
 * individual entries in place. The ROWS are the source of truth and the
 * textarea is only an importer — parsing the raw text live instead would
 * mean any inline correction got overwritten on the next keystroke, and the
 * parser cannot be perfect against every .env dialect. Being able to fix its
 * mistakes is the point.
 */
export default function EnvVarsEditor({ vars, onChange }) {
  const [open, setOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const rows = vars || [];

  // Later duplicates silently overwrite earlier ones when this becomes an
  // object, so flag them rather than letting a variable vanish unexplained.
  const flagged = useMemo(() => {
    const seen = new Map();
    rows.forEach((r, i) => seen.set(r.key.trim(), i));
    return rows.map((r, i) => ({
      ...r,
      duplicate: Boolean(r.key.trim()) && seen.get(r.key.trim()) !== i,
    }));
  }, [rows]);

  const validCount = flagged.filter((r) => r.key.trim() && !r.duplicate).length;

  const importPasted = () => {
    const parsed = parseEnvFile(pasteText);
    const entries = Object.entries(parsed);
    if (entries.length === 0) return;

    // Merge: a pasted key replaces the existing row of the same name so
    // re-pasting an updated .env refreshes values instead of duplicating.
    const byKey = new Map(rows.map((r) => [r.key.trim(), r]));
    entries.forEach(([key, value]) => byKey.set(key, { key, value }));

    onChange([...byKey.values()]);
    setPasteText('');
    setPasteOpen(false);
  };

  const skippedLines = useMemo(() => {
    if (!pasteText) return [];
    return pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.includes('='));
  }, [pasteText]);

  const pendingCount = Object.keys(parseEnvFile(pasteText)).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
      >
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        <Settings2 size={13} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-600 flex-1">
          Environment variables for this repo
        </span>
        {validCount > 0 && (
          <span className="text-[10px] bg-green-50 text-green-700 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
            <CheckCircle2 size={9} /> {validCount}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t bg-gray-50/50 space-y-2">
          <p className="text-[11px] text-gray-400">
            If your code reads config at import time (API keys, a DB URL), tests fail before reaching
            your logic without it. Used only for this run, never stored in plain text.
          </p>

          {/* ── Import ───────────────────────────────────────────── */}
          {pasteOpen || rows.length === 0 ? (
            <div className="space-y-1.5">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                spellCheck={false}
                rows={6}
                placeholder={'Paste your .env here\n\nPORT=4000\nMONGODB_URI=mongodb+srv://...\nOPENAI_API_KEY=sk-...'}
                className="w-full border rounded px-2 py-2 text-[11px] font-mono resize-y bg-white"
              />
              {skippedLines.length > 0 && (
                <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  {skippedLines.length} line{skippedLines.length === 1 ? '' : 's'} will be ignored — no “=”
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={importPasted}
                  disabled={pendingCount === 0}
                  className="flex items-center gap-1.5 bg-gray-900 text-white text-[11px] font-medium px-3 py-1.5 rounded disabled:opacity-40"
                >
                  <ClipboardPaste size={12} />
                  {pendingCount > 0 ? `Load ${pendingCount} variable${pendingCount === 1 ? '' : 's'}` : 'Load variables'}
                </button>
                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setPasteOpen(false); setPasteText(''); }}
                    className="text-[11px] text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-800 border rounded px-2 py-1 bg-white"
            >
              <ClipboardPaste size={12} /> Paste a .env
            </button>
          )}

          {/* ── Editable rows ────────────────────────────────────── */}
          {rows.length > 0 && (
            <div className="bg-white border rounded p-2 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                {validCount} variable{validCount === 1 ? '' : 's'} will be set — edit any of them below
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {flagged.map((row, i) => (
                  <VarRow
                    key={i}
                    row={row}
                    onChange={(next) => onChange(rows.map((r, idx) => (idx === i ? next : r)))}
                    onRemove={() => onChange(rows.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
              {flagged.some((r) => r.duplicate) && (
                <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  Duplicate keys highlighted — only the last of each is sent.
                </p>
              )}
              <button
                type="button"
                onClick={() => onChange([...rows, { key: '', value: '' }])}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
              >
                <Plus size={11} /> Add variable
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Editable rows -> the {KEY: value} object the API expects. */
export function envVarsToObject(rows) {
  const out = {};
  for (const { key, value } of rows || []) {
    const k = (key || '').trim();
    if (k) out[k] = value ?? '';   // last duplicate wins, as flagged in the UI
  }
  return out;
}
