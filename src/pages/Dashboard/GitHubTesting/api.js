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

/**
 * Turns a FastAPI error body into something a human can read.
 *
 * FastAPI reports a 422 as `detail: [{loc, msg, type}, ...]` — an ARRAY OF
 * OBJECTS, not a string. Passing that straight to `new Error()` stringifies
 * it to the literal text "[object Object]", which is what the user sees
 * instead of the actual problem. That turned a one-line "branch: field
 * required" into an unreadable toast and a debugging session, so every error
 * path goes through here.
 */
export const errorMessage = (body, fallback) => {
  const d = body?.detail ?? body?.error;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    const parts = d.map((e) => {
      if (typeof e === 'string') return e;
      // loc looks like ["body", "branch"]; the first element is just the
      // request part and carries no meaning for the reader.
      const field = Array.isArray(e?.loc) ? e.loc.slice(1).join('.') : '';
      const msg = e?.msg || JSON.stringify(e);
      return field ? `${field}: ${msg}` : msg;
    });
    return parts.length ? parts.join('; ') : fallback;
  }
  if (typeof d === 'object') return d.msg || JSON.stringify(d);
  return String(d);
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
    throw Object.assign(new Error(errorMessage(d, `Error ${res.status}`)), { code: res.status });
  }
  return res.json();
};

/**
 * Uploads a codebase archive to POST /repos/upload.
 *
 * XMLHttpRequest rather than fetch, for one reason: fetch cannot report
 * upload progress at all. A project zip is routinely tens of megabytes, and a
 * button that sits silent for a minute reads as broken — so the progress
 * callback is the point, not a nicety.
 *
 * Content-Type is deliberately NOT set. The browser must generate it itself
 * so it can append the multipart boundary; setting it by hand (as apiFetch
 * does for JSON) produces a body the server cannot parse.
 */
export const apiUpload = (file, { name, onProgress } = {}) =>
  new Promise((resolve, reject) => {
    if (!CODE_API) return reject(new Error('CODE_API_NOT_CONFIGURED'));

    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${CODE_API}/repos/upload`);
    const auth = getAuthHeader();
    if (auth.Authorization) xhr.setRequestHeader('Authorization', auth.Authorization);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      reject(Object.assign(
        new Error(errorMessage(body, `Upload failed (${xhr.status})`)),
        { code: xhr.status },
      ));
    };
    xhr.onerror = () => reject(Object.assign(
      new Error('Cannot reach the Code Testing API — check REACT_APP_CODE_TESTER_BACKEND_URL.'),
      { code: 0 },
    ));
    // Server-side indexing (extract + walk + stack detection) happens inside
    // this request, so the timeout covers far more than the transfer itself.
    xhr.timeout = 15 * 60 * 1000;
    xhr.ontimeout = () => reject(new Error('The upload timed out.'));

    xhr.send(form);
  });

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
