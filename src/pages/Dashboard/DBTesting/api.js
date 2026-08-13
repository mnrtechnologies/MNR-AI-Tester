export const DB_API = process.env.REACT_APP_DB_TESTER_BACKEND_URL;


export const getAuthHeader = () => {
  try {
    let t = localStorage.getItem('token');
    if (!t) return {};
    t = t.replace(/^"|"$/g, '');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
};

export const apiFetch = async (path, opts = {}) => {
  if (!DB_API) throw new Error('DB_API_NOT_CONFIGURED');
  const { blob: wantBlob = false, ...options } = opts;
  let res;
  try {
    res = await fetch(`${DB_API}/api/v1${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeader(),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw Object.assign(
      new Error('Cannot reach DB API — check REACT_APP_DB_TESTER_BACKEND_URL and ensure the server allows this origin.'),
      { code: 0 }
    );
  }
  if (res.status === 429) {
    const d = await res.json().catch(() => ({}));
    const mins = Math.ceil(Number(d.retry_after || 3600) / 60);
    throw Object.assign(new Error(`Rate limit exceeded. Retry in ~${mins} min.`), { code: 429 });
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw Object.assign(new Error(d.error || `Error ${res.status}`), { code: res.status });
  }
  if (wantBlob) return res.blob();
  return res.json();
};

export const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  URL.revokeObjectURL(url); document.body.removeChild(a);
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
