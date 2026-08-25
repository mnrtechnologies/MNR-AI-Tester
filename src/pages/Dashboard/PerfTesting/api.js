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

/** ws:// or wss:// URL for the live run socket, derived from the same base as apiFetch. */
export const wsUrl = (runId) => {
  if (!PERF_API) throw new Error('PERF_API_NOT_CONFIGURED');
  return `${PERF_API.replace(/^http/, 'ws')}/ws/perf/${runId}`;
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
