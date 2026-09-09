export const PERF_API = process.env.REACT_APP_PERF_TESTER_BACKEND_URL;

export const getAuthHeader = () => {
  try {
    let t = localStorage.getItem('token');
    if (!t) return {};
    t = t.replace(/^"|"$/g, '');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
};

export const apiFetch = async (path, opts = {}) => {
  if (!PERF_API) throw new Error('PERF_API_NOT_CONFIGURED');
  const { blob: wantBlob = false, ...options } = opts;
  let res;
  try {
    res = await fetch(`${PERF_API}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeader(),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw Object.assign(
      new Error('Cannot reach the Performance Testing API — check REACT_APP_PERF_TESTER_BACKEND_URL and ensure the server allows this origin.'),
      { code: 0 }
    );
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw Object.assign(new Error(d.detail || d.error || `Error ${res.status}`), { code: res.status });
  }
  if (wantBlob) return res.blob();
  return res.json();
};

/**
 * ws:// or wss:// URL for the live run socket, derived from the same base as apiFetch.
 *
 * The token goes in the QUERY STRING, not a header: the browser WebSocket API
 * cannot set Authorization, which is why the backend accepts `?token=` for
 * this one route (see security.py::user_from_ws_token — it runs the exact same
 * verification as the REST path, so this is not a weaker door).
 *
 * Without it every connection is rejected at the handshake with a 403 and the
 * page shows "Lost connection to the live run feed — reconnecting" forever,
 * while the run itself proceeds perfectly well server-side. Confirmed exactly
 * that: a run sitting at "QUEUED / 0 lines" in the UI already had 13 log lines
 * and 3 screenshots in Redis.
 */
export const wsUrl = (runId) => {
  if (!PERF_API) throw new Error('PERF_API_NOT_CONFIGURED');
  let token = '';
  try {
    token = (localStorage.getItem('token') || '').replace(/^"|"$/g, '');
  } catch { /* private window — connect unauthenticated and let the server say no */ }
  const base = `${PERF_API.replace(/^http/, 'ws')}/ws/perf/${runId}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const fmtMs = (ms) => {
  if (ms === null || ms === undefined) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
};

/**
 * Feature-journey results: the idle baseline, the under-load pass, and the
 * per-hop delta between them. Only feature_journey runs produce these; every
 * other test type returns nulls, so callers can request it unconditionally
 * once a run finishes rather than branching on intent first.
 *
 * The live socket already streams individual transitions as they happen; this
 * is the authoritative aggregate, computed server-side across every session
 * including any whose rows were trimmed from the live feed.
 */
export const getJourneyMetrics = (runId) =>
  apiFetch(`/api/perf/runs/${runId}/journey-metrics`);

/**
 * A freshly-signed S3 download URL for the run's Excel report.
 *
 * Fetched on click rather than baked into an <a href> at render time. Two
 * reasons: the browser cannot attach the JWT to a plain link, so the
 * ownership-checked API route is unreachable that way; and the URL stored on
 * the run document is only signed for 48 hours, so reopening an older run
 * would otherwise hand the user an S3 AccessDenied page for a file that is
 * still sitting in the bucket.
 */
export const getReportUrl = (runId) =>
  apiFetch(`/api/perf/runs/${runId}/report-url`);
