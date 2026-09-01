// Same fetch-wrapper shape as pages/Dashboard/PerfTesting/api.js — this
// feature talks to its own Python service (MNR_AT_Code_Testing), not the
// Node backend, so it needs its own base URL + auth-header plumbing rather
// than reusing services/apiConnector.js.
export const CODE_API = process.env.REACT_APP_CODE_TESTER_BACKEND_URL;

export const getAuthHeader = () => {
  try {
    let t = localStorage.getItem('token');
    if (!t) return {};
    t = t.replace(/^"|"$/g, '');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
};

export const apiFetch = async (path, opts = {}) => {
  if (!CODE_API) throw new Error('CODE_API_NOT_CONFIGURED');
  let res;
  try {
    res = await fetch(`${CODE_API}${path}`, {
      ...opts,
      headers: {
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeader(),
        ...(opts.headers || {}),
      },
    });
  } catch {
    throw Object.assign(
      new Error('Cannot reach the Code Testing API — check REACT_APP_CODE_TESTER_BACKEND_URL and ensure the server allows this origin.'),
      { code: 0 }
    );
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw Object.assign(new Error(d.detail || d.error || `Error ${res.status}`), { code: res.status });
  }
  return res.json();
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** "just now" / "4m ago" / "3h ago" / "2d ago", falling back to a date once
 *  a run is old enough that relative time stops being the useful framing. */
export const fmtRelative = (iso) => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const secs = Math.max(0, (Date.now() - then) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.round(secs / 86400)}d ago`;
  return fmtDate(iso);
};

/** Wall-clock duration of a run, from its own timestamps. */
export const fmtDuration = (startIso, endIso) => {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return null;
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

// Rough client-side token estimate (~4 chars/token) so the path selector can
// show the user a cost signal before they hit Run — the real count comes
// from the provider's own tokenizer server-side (see chunker.py), this is
// only for the pre-run "here's roughly what you're about to spend" hint.
export const estimateTokens = (bytes) => Math.round(bytes / 4);
