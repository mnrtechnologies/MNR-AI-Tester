import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Download, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../api';

/**
 * Auto-create-test-accounts feature: shows the real {email, password} pairs
 * tasks.create_accounts_batch just created, fetched from the Redis-only,
 * TTL-bound /created-credentials endpoint (never persisted to Mongo — see
 * app.py/redis_store.py). Used both by RunForm's own mini "Create Accounts"
 * widget (right after its own run completes) and by ResultsPanel (for a run
 * found later via Recent Runs) — same component, same one-time-visibility
 * framing either way.
 */
export default function CreatedCredentialsPanel({ runId, count }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!runId) return undefined;
    setLoading(true);
    apiFetch(`/api/perf/runs/${runId}/created-credentials`)
      .then((d) => { if (!cancelled) setCredentials(d.credentials || []); })
      .catch(() => { if (!cancelled) setCredentials([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId]);

  const asLines = (creds) => creds.map((c) => `${c.email}:${c.password}`).join('\n');

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asLines(credentials));
      toast.success('Copied — paste directly into Login Load Test Credentials below.');
    } catch {
      toast.error('Clipboard copy failed — select and copy manually.');
    }
  };

  const downloadCsv = () => {
    const csv = ['email,password', ...credentials.map((c) => `${c.email},${c.password}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-accounts-${runId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-xs text-slate-400 py-2">Loading created accounts…</p>;
  if (!credentials.length) {
    return (
      <p className="text-xs text-slate-400 py-2">
        No credentials available{count ? ` (expected ${count})` : ''} — they may have expired (kept for a limited time only).
      </p>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-start gap-3 bg-amber-50 border-b border-amber-200 px-5 py-3">
        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Shown once — these real passwords are kept only for a limited time and never stored long-term. Copy or
          download them now, then paste into <b>Login Load Test Credentials</b> to load-test the login itself.
        </p>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
          <KeyRound size={13} /> {credentials.length} account{credentials.length === 1 ? '' : 's'} created
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 transition-colors">
            <Copy size={12} /> Copy all
          </button>
          <button type="button" onClick={downloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 transition-colors">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {credentials.map((c, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-1.5 text-slate-700">{c.email}</td>
                <td className="px-5 py-1.5 text-slate-500">{c.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
