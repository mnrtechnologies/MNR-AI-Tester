import { useState, useEffect, useRef } from "react";

const API = process.env.REACT_APP_AI_TESTER_BACKEND_URL ;
const WS = API.replace(/^http/, "ws");

// ── Light Professional Color Palette ─────────────────────────────────────────
const C = {
  bg:       "#ffffff", // Clean white background
  surface:  "#fafafa", // Very light gray for cards
  border:   "#e5e7eb", // Light border (gray-200)
  accent:   "#3b82f6", // blue-500
  accent2:  "#6366f1", // indigo-500
  green:    "#10b981", // emerald-500
  yellow:   "#f59e0b", // amber-500
  red:      "#ef4444", // red-500
  text:     "#000000", // Black text
  muted:    "#6b7280", // gray-500
};

// ── Tiny helpers ─────────────────────────────────────────────────────────────
const cx = (...cls) => cls.filter(Boolean).join(" ");

function useInterval(cb, delay) {
  const saved = useRef(cb);
  useEffect(() => { saved.current = cb; }, [cb]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ── Global CSS injected once ──────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${C.bg};
    color: ${C.text};
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

  @keyframes scan {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideIn {
    from { opacity:0; transform:translateX(10px); }
    to   { opacity:1; transform:translateX(0); }
  }

  .fade-up { animation: fadeUp .4s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* Typography */
  .font-mono { font-family: 'JetBrains Mono', monospace; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 8px 16px; border-radius: 6px; border: 1px solid transparent;
    font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all .2s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  
  .btn-primary {
    background: #000000; color: #ffffff;
  }
  .btn-primary:hover:not(:disabled) { background: #3f3f46; }
  
  .btn-danger {
    background: transparent; color: ${C.red}; border-color: rgba(239,68,68,0.3);
  }
  .btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.1); border-color: ${C.red}; }

  /* Inputs */
  .input {
    width: 100%; padding: 10px 12px; border-radius: 6px;
    background: #ffffff; border: 1px solid ${C.border};
    color: ${C.text}; font-size: 14px;
    outline: none; transition: all .2s;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05) inset;
  }
  .input:focus { border-color: ${C.accent}; box-shadow: 0 0 0 1px ${C.accent} inset; }
  .input::placeholder { color: ${C.muted}; }

  .label {
    display: block; font-size: 12px; font-weight: 600; color: #000000; margin-bottom: 8px;
  }

  /* Badges */
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
    letter-spacing: .02em; text-transform: uppercase;
  }
  .badge-running  { background: rgba(59,130,246,.1);  color: ${C.accent}; border: 1px solid rgba(59,130,246,.2); }
  .badge-done     { background: rgba(16,185,129,.1); color: ${C.green};  border: 1px solid rgba(16,185,129,.2); }
  .badge-failed   { background: rgba(239,68,68,.1);  color: ${C.red};    border: 1px solid rgba(239,68,68,.2); }
  .badge-idle     { background: ${C.surface}; color: ${C.muted}; border: 1px solid ${C.border}; }

  /* Cards */
  .card {
    background: #ffffff; border: 1px solid ${C.border};
    border-radius: 12px; padding: 24px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  }

  /* Progress Bar */
  .progress-bar-track {
    height: 6px; background: #f3f4f6; border-radius: 999px; overflow: hidden;
    border: 1px solid ${C.border};
  }
  .progress-bar-fill {
    height: 100%; border-radius: 999px;
    background: ${C.accent};
    transition: width .4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Terminal Logs (Kept dark for contrast/hacker feel) */
  .terminal-container {
    background: #09090b; border: 1px solid ${C.border}; border-radius: 8px;
    padding: 12px 16px; font-family: 'JetBrains Mono', monospace;
  }
  .log-line {
    font-size: 12px; line-height: 1.6; padding: 2px 0;
  }
  .log-cyan   { color: #3b82f6; }
  .log-green  { color: #10b981; }
  .log-yellow { color: #f59e0b; }
  .log-red    { color: #ef4444; }
  .log-white  { color: #f4f4f5; } /* Forced to white for readability in dark terminal */

  /* Browser Mockup Screen */
  .screen-wrap {
    position: relative; border-radius: 8px; overflow: hidden;
    border: 1px solid ${C.border}; background: #000;
    aspect-ratio: 16/9; display: flex; flex-direction: column;
  }
  .browser-chrome {
    height: 28px; background: #18181b; border-bottom: 1px solid #27272a;
    display: flex; align-items: center; padding: 0 12px; gap: 6px;
  }
  .browser-dot { width: 10px; height: 10px; border-radius: 50%; background: #3f3f46; }
  .browser-dot:nth-child(1) { background: #ef4444; }
  .browser-dot:nth-child(2) { background: #f59e0b; }
  .browser-dot:nth-child(3) { background: #10b981; }
  
  .screen-wrap img {
    width: 100%; flex: 1; object-fit: contain; display: block; background: #ffffff;
  }
  .screen-placeholder {
    flex: 1; width: 100%; display: flex; align-items: center;
    justify-content: center; flex-direction: column; gap: 12px;
    color: #a1a1aa; font-size: 13px; font-weight: 500;
  }
  .scan-line {
    position: absolute; top: 28px; left: 0; right: 0; height: 100%;
    background: linear-gradient(to bottom, transparent, rgba(59,130,246,.2) 50%, rgba(59,130,246,.8) 50%, transparent);
    background-size: 100% 4px;
    animation: scan 3s linear infinite; pointer-events: none; opacity: .4;
  }

  /* Typography Structure */
  .phase-header {
    font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
    color: #000000; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;
  }
  .phase-title {
    font-size: 24px; font-weight: 700; color: #000000; line-height: 1.2; letter-spacing: -0.02em;
  }

  /* Toggle Group */
  .toggle-group {
    display: flex; background: #f3f4f6; border: 1px solid ${C.border}; border-radius: 8px; padding: 4px;
  }
  .toggle-opt {
    flex: 1; padding: 8px 12px; text-align: center; cursor: pointer;
    font-size: 13px; font-weight: 600; transition: all .2s; color: ${C.muted};
    border: none; background: transparent; border-radius: 4px;
  }
  .toggle-opt.active { background: #ffffff; color: #000000; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .toggle-opt:not(.active):hover { color: #000000; }

  .divider { height: 1px; background: ${C.border}; margin: 24px 0; }

  /* Stats */
  .stat-row { display: flex; align-items: center; justify-content: space-between; }
  .stat-val { font-size: 28px; font-weight: 700; color: #000000; letter-spacing: -0.02em; line-height: 1.2; }
  .stat-lbl { font-size: 12px; font-weight: 600; color: ${C.muted}; margin-top: 4px; }

  /* Tabs */
  .nav-tab {
    padding: 12px 16px; font-size: 13px; font-weight: 600;
    border: none; background: transparent; cursor: pointer;
    border-bottom: 2px solid transparent; transition: all .2s;
    color: ${C.muted};
  }
  .nav-tab.active { color: #000000; border-bottom-color: #000000; }
  .nav-tab:hover:not(.active) { color: #000000; }

  /* Persistent download pill */
  .excel-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 6px;
    background: #ffffff; color: #000000;
    border: 1px solid ${C.border};
    font-size: 12px; font-weight: 600; cursor: pointer; transition: all .2s;
    animation: slideIn .4s cubic-bezier(0.16, 1, 0.3, 1) both;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .excel-pill:hover { background: #f9fafb; border-color: #d1d5db; }

  .excel-pill-pending {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 6px;
    background: transparent; color: ${C.muted};
    border: 1px dashed ${C.border};
    font-size: 12px; font-weight: 600; white-space: nowrap; cursor: not-allowed;
  }

  .spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid ${C.border}; border-top-color: currentColor;
    animation: spin .6s linear infinite; display: inline-block;
  }

  /* List items for Phase 3 */
  .test-item {
    display: flex; align-items: center; gap: 12px; padding: 12px; 
    border-radius: 8px; border: 1px solid ${C.border}; background: #ffffff;
    transition: all 0.2s;
  }
  .test-item.active { border-color: ${C.accent}; background: rgba(59,130,246,0.05); }
`;

// ── Live Screenshot panel ─────────────────────────────────────────────────────
function ScreenPanel({ src, label, scanning = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      {label && <div className="label" style={{ margin: 0 }}>{label}</div>}
      <div className="screen-wrap">
        <div className="browser-chrome">
          <div className="browser-dot" />
          <div className="browser-dot" />
          <div className="browser-dot" />
        </div>
        {src
          ? <img src={src} alt="live screenshot" />
          : <div className="screen-placeholder">
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <span>Awaiting browser connection...</span>
            </div>
        }
        {scanning && <div className="scan-line" />}
      </div>
    </div>
  );
}

// ── Log panel ─────────────────────────────────────────────────────────────────
function LogPanel({ logs }) {
  const ref = useRef(null);
  
  useEffect(() => { 
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; 
  }, [logs]);

  return (
    <div 
      ref={ref} 
      className="terminal-container" 
      // Set a fixed height here (e.g., 350px) to prevent it from growing
      style={{ height: 550, overflowY: "auto" }} 
    >
      {logs.length === 0
        ? <div style={{ color: "#a1a1aa", fontSize: 13 }}>Waiting for output...<span className="font-mono" style={{ animation: "blink 1s step-end infinite" }}>_</span></div>
        : logs.map((l, i) => (
            <div key={i} className={cx("log-line", `log-${l.color || "white"}`)}>
              <span style={{ color: "#52525b", marginRight: 12, userSelect: "none" }}>{String(i + 1).padStart(3, "0")}</span>
              {l.message}
            </div>
          ))
      }
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value = 0, max = 100, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label && (
        <div className="stat-row" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>{label}</span>
          <span style={{ fontSize: 13, color: C.muted }}>{value} / {max} ({pct}%)</span>
        </div>
      )}
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Persistent Excel Download pill (shown in top bar) ────────────────────────
function ExcelDownloadPill({ excelB64, excelName, mode }) {
  if (mode !== "semantic") return null;

  const download = () => {
    if (!excelB64 || !excelName) return;
    const link = document.createElement("a");
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelB64}`;
    link.download = excelName;
    link.click();
  };

  if (!excelB64) {
    return (
      <div className="excel-pill-pending" title="Semantic report will appear here when Phase 1 completes">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        Semantic Report
        <span style={{ opacity: .5 }}>pending</span>
      </div>
    );
  }

  return (
    <button className="excel-pill" onClick={download} title={`Download ${excelName}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download Report
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 0 — Login
// ════════════════════════════════════════════════════════════════════════════
function PhaseLogin({ onDone }) {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [otp,       setOtp]       = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [mode,      setMode]      = useState("checking");
  const [status,    setStatus]    = useState("idle");
  const [logs,      setLogs]      = useState([]);
  const [screenshot,setScreenshot]= useState(null);
  const [needOtp,   setNeedOtp]   = useState(false);
  const [liveOtp,   setLiveOtp]   = useState("");
  const wsRef = useRef(null);

  const pushLog = (msg, color = "white") => setLogs(p => [...p, { message: msg, color }]);

  const connect = () => {
    if (!email || !targetUrl) return;
    setStatus("connecting");
    setLogs([]);
    setScreenshot(null);

    const ws = new WebSocket(`${WS}/ws/login`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("running");

    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);

      if (data.type === "connected") {
        pushLog(data.message, "cyan");
        ws.send(JSON.stringify({ email, password: password || undefined, otp: otp || undefined, target_url: targetUrl }));
        return;
      }
      if (data.type === "log")        { pushLog(data.message, data.color || "white"); return; }
      if (data.type === "screenshot") { setScreenshot(`data:image/png;base64,${data.data}`); return; }
      if (data.type === "input_needed" && data.field === "otp") { setNeedOtp(true); return; }
      if (data.type === "done") {
        pushLog("✅ Login complete — auth.json saved", "green");
        setStatus("done");
        ws.close();
        setTimeout(() => onDone(targetUrl, mode), 800);
        return;
      }
      if (data.type === "error") { pushLog(`✗ ${data.message}`, "red"); setStatus("error"); }
    };

    ws.onerror = () => { pushLog("WebSocket error", "red"); setStatus("error"); };
    ws.onclose = () => { if (status === "running") pushLog("Connection closed", "yellow"); };
  };

  const sendOtp = () => {
    if (!liveOtp || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ otp: liveOtp }));
    pushLog(`OTP sent: ${liveOtp}`, "green");
    setNeedOtp(false);
    setLiveOtp("");
  };

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div className="phase-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Phase 0
        </div>
        <div className="phase-title">Authentication Configuration</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>Configure target credentials. The agent will stream its browser session live.</div>
      </div>

      {/* TOP ROW: Large live feed */}
      <div style={{ width: "100%" }}>
        <ScreenPanel src={screenshot} scanning={status === "running"} label={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Live Browser Stream</span>
            <span className={cx("badge", status === "running" ? "badge-running" : status === "done" ? "badge-done" : "badge-idle")}>
              {status === "running" && <span className="spinner" style={{ width: 10, height: 10 }} />}
              {status}
            </span>
          </div>
        } />
      </div>

      {/* BOTTOM ROW: Form (Left) and Logs (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label className="label">Target Environment URL <span style={{ color: C.red }}>*</span></label>
            <input className="input" placeholder="https://staging.example.com/sign-in" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} disabled={status === "running"} />
          </div>
          <div>
            <label className="label">Email Address <span style={{ color: C.red }}>*</span></label>
            <input className="input" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={status === "running"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="label">Password <span style={{ color: C.muted, fontWeight: 400 }}>(Optional)</span></label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={status === "running"} />
            </div>
            <div>
              <label className="label">Static OTP <span style={{ color: C.muted, fontWeight: 400 }}>(Optional)</span></label>
              <input className="input" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} disabled={status === "running"} />
            </div>
          </div>

          <div className="divider" style={{ margin: "4px 0" }} />

          <div>
            <label className="label" style={{ marginBottom: 12 }}>Post-Authentication Pipeline</label>
            <div className="toggle-group">
              <button className={cx("toggle-opt", mode === "checking" ? "active" : "")} onClick={() => setMode("checking")} disabled={status === "running"}>
                <span style={{ display: "block", fontSize: 16, marginBottom: 4 }}>🔍</span>
                Standard Checking
              </button>
              <button className={cx("toggle-opt", mode === "semantic" ? "active" : "")} onClick={() => setMode("semantic")} disabled={status === "running"}>
                <span style={{ display: "block", fontSize: 16, marginBottom: 4 }}>🧠</span>
                Semantic AI Agent
              </button>
            </div>
          </div>

          <button className="btn btn-primary" style={{ padding: "12px", marginTop: 8 }}
            onClick={connect} disabled={!email || !targetUrl || status === "running" || status === "done"}>
            {status === "connecting" ? <><span className="spinner" /> Connecting Sandbox...</>
             : status === "running"   ? <><span className="spinner" /> Agent Running</>
             : status === "done"      ? "✓ Authentication Complete"
             : "Initialize Login Sequence"}
          </button>

          {needOtp && (
            <div className="fade-up" style={{ padding: 16, borderRadius: 8, background: "rgba(245,158,11,.1)", border: `1px solid rgba(245,158,11,.2)` }}>
              <div style={{ fontSize: 13, color: C.yellow, marginBottom: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Live OTP Required
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" placeholder="Enter code" value={liveOtp} onChange={e => setLiveOtp(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendOtp()}
                  style={{ flex: 1, background: "#ffffff" }} />
                <button className="btn btn-primary" onClick={sendOtp}>Submit</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LogPanel logs={logs} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Checking Pipeline
// ════════════════════════════════════════════════════════════════════════════
function PhaseChecking({ targetUrl, onPhase3 }) {
  const [jobId,      setJobId]      = useState(null);
  const [status,     setStatus]     = useState("starting");
  const [screenshot, setScreenshot] = useState(null);
  const [logs,       setLogs]       = useState([]);
  const [progress,   setProgress]   = useState({ total: 0, completed: 0, current: "" });
  const wsRef = useRef(null);

  const pushLog = (msg, color = "white") => setLogs(p => [...p, { message: msg, color }]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      pushLog(`Initializing Checking Pipeline → ${targetUrl}`, "cyan");
      const res = await fetch(`${API}/checking/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: targetUrl }),
      });
      const data = await res.json();
      if (cancelled) return;

      setJobId(data.job_id);
      pushLog(`Job ID Assigned: ${data.job_id}`, "cyan");

      const ws = new WebSocket(`${WS}/ws/checking/${data.job_id}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "frame") {
          setScreenshot(`data:image/jpeg;base64,${msg.image}`);
          if (msg.current_url) setProgress(p => ({ ...p, current: msg.current_url }));
          if (msg.total)       setProgress(p => ({ ...p, total: msg.total }));
          if (msg.completed !== undefined) setProgress(p => ({ ...p, completed: msg.completed }));
          return;
        }
        if (msg.type === "url_report") {
          pushLog(`✓ Indexed: ${msg.url}`, "green");
          setProgress(p => ({ ...p, completed: msg.completed || p.completed, total: msg.total || p.total }));
          return;
        }
        if (msg.message) pushLog(msg.message, msg.type === "error" ? "red" : msg.type === "done" ? "green" : "white");
        if (msg.type === "done") {
          setStatus("done");
          pushLog("Checking phase complete — Handing off to Phase 2 validation", "cyan");
          ws.close();
          triggerPhase3(data.job_id);
        }
        if (msg.type === "error") { setStatus("error"); }
      };

      ws.onerror = () => pushLog("WebSocket connection error", "red");
      setStatus("running");
    };

    start().catch(e => pushLog(String(e), "red"));
    return () => { cancelled = true; wsRef.current?.close(); };
  }, []);

  useInterval(async () => {
    if (!jobId || status !== "running") return;
    try {
      const r = await fetch(`${API}/checking/${jobId}/status`);
      const d = await r.json();
      setProgress({ total: d.total_urls, completed: d.completed_urls, current: d.current_url || "" });
    } catch {}
  }, status === "running" ? 3000 : null);

  const triggerPhase3 = async (jid) => {
    try {
      const r = await fetch(`${API}/checking/${jid}/trigger-all-tests`, { method: "POST" });
      const d = await r.json();
      pushLog(`Phase 2 batch queued — ${d.total_tasks} tasks`, "cyan");
      onPhase3("checking", jid);
    } catch (e) { pushLog(`Phase 2 handoff failed: ${e}`, "red"); }
  };

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="phase-header">Phase 1 — Checking</div>
          <div className="phase-title">Discovery & Crawling</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>Mapping application structure and collecting endpoints.</div>
        </div>
        <span className={cx("badge", status === "running" ? "badge-running" : status === "done" ? "badge-done" : "badge-failed")}>
          {status === "running" && <span className="spinner" style={{ width: 10, height: 10 }} />}
          {status === "running" ? "Crawling" : status}
        </span>
      </div>

      {/* TOP ROW: Large live feed */}
      <div style={{ width: "100%" }}>
        <ScreenPanel src={screenshot} scanning={status === "running"} label="Agent Viewfinder" />
      </div>

      {/* BOTTOM ROW: Stats (Left) and Logs (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card">
          <div style={{ display: "flex", gap: 32, marginBottom: 24 }}>
            <div>
              <div className="stat-val">{progress.completed}</div>
              <div className="stat-lbl">URLs Processed</div>
            </div>
            <div>
              <div className="stat-val" style={{ color: C.muted }}>{progress.total || "—"}</div>
              <div className="stat-lbl">Total Discovered</div>
            </div>
          </div>
          <ProgressBar value={progress.completed} max={progress.total || 1} label="Crawl Progress" />
          {progress.current && (
            <div style={{ marginTop: 16, fontSize: 12, color: C.muted, display: "flex", gap: 8, wordBreak: "break-all", background: C.surface, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}` }}>
              <span style={{ color: C.accent }}>●</span> <span className="font-mono">{progress.current}</span>
            </div>
          )}
        </div>
        <LogPanel logs={logs} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Semantic Driver
// ════════════════════════════════════════════════════════════════════════════
function PhaseSemantic({ targetUrl, onPhase3, onExcelReady }) {
  const [testId,     setTestId]     = useState(null);
  const [status,     setStatus]     = useState("starting");
  const [screenshot, setScreenshot] = useState(null);
  const [logs,       setLogs]       = useState([]);
  const [step,       setStep]       = useState(0);
  const wsRef = useRef(null);

  const pushLog = (msg, color = "white") => setLogs(p => [...p, { message: msg, color }]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      pushLog(`Initializing Semantic AI Engine → ${targetUrl}`, "cyan");
      const res = await fetch(`${API}/semantic/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      if (cancelled) return;

      setTestId(data.test_id);
      pushLog(`Session ID: ${data.test_id}`, "cyan");

      const ws = new WebSocket(`${WS}/ws/semantic/${data.test_id}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "frame") {
          setScreenshot(`data:image/jpeg;base64,${msg.image}`);
          if (msg.step !== undefined) setStep(msg.step);
          return;
        }
        if (msg.message) pushLog(msg.message, msg.type === "error" ? "red" : msg.type === "done" ? "green" : "white");
        if (msg.type === "done") {
          setStatus("done");
          // ── Lift Excel data up to parent so it survives phase transitions ──
          if (msg.excel_base64) {
            onExcelReady(msg.excel_base64, msg.excel_filename);
            pushLog("📊 Semantic report generated. Available for download.", "green");
          }
          ws.close();
          triggerConvert(data.test_id);
        }
        if (msg.type === "error") setStatus("error");
      };

      ws.onerror = () => pushLog("WebSocket connection error", "red");
      setStatus("running");
    };

    start().catch(e => pushLog(String(e), "red"));
    return () => { cancelled = true; wsRef.current?.close(); };
  }, []);

  const triggerConvert = async (tid) => {
    try {
      pushLog("Translating semantic findings to Orchestrator tasks...", "cyan");
      const r = await fetch(`${API}/semantic/${tid}/convert-to-orchestrator`, { method: "POST" });
      const d = await r.json();
      pushLog(`Phase 2 batch queued — ${d.total_tasks} tasks`, "cyan");
      onPhase3("semantic", tid);
    } catch (e) { pushLog(`Conversion failed: ${e}`, "red"); }
  };

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="phase-header">Phase 1 — Semantic</div>
          <div className="phase-title">Autonomous Exploration</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>AI agent is naturally exploring and identifying user journeys.</div>
        </div>
        <span className={cx("badge", status === "running" ? "badge-running" : status === "done" ? "badge-done" : "badge-failed")}>
          {status === "running" && <span className="spinner" style={{ width: 10, height: 10 }} />}
          {status === "running" ? "Exploring" : status}
        </span>
      </div>

      {/* TOP ROW: Large live feed */}
      <div style={{ width: "100%" }}>
        <ScreenPanel src={screenshot} scanning={status === "running"} label="Agent Viewfinder" />
      </div>

      {/* BOTTOM ROW: Stats (Left) and Logs (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card">
          <div style={{ display: "flex", gap: 32 }}>
            <div>
              <div className="stat-val">{step}</div>
              <div className="stat-lbl">Interactions Made</div>
            </div>
            <div>
              <div className="stat-val" style={{ color: status === "done" ? C.green : C.accent, display: "flex", alignItems: "center", height: "34px" }}>
                {status === "done" ? "Complete" : <span className="spinner" style={{ width: 22, height: 22 }} />}
              </div>
              <div className="stat-lbl">Engine Status</div>
            </div>
          </div>
        </div>
        <LogPanel logs={logs} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Validation (Sequential test runner)
// ════════════════════════════════════════════════════════════════════════════
function PhaseValidation({ source }) {
  const [tests,       setTests]       = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [screenshot,  setScreenshot]  = useState(null);
  const [logs,        setLogs]        = useState([]);
  const wsRef        = useRef(null);
  const knownIds     = useRef(new Set());
  const activeWsRef  = useRef(null);

  const pushLog = (msg, color = "white") => setLogs(p => [...p, { message: msg, color }]);

  useInterval(async () => {
    try {
      const r = await fetch(`${API}/tests`);
      const d = await r.json();
      const ids = Object.keys(d);
      const fresh = ids.filter(id => !knownIds.current.has(id));
      fresh.forEach(id => {
        knownIds.current.add(id);
        setTests(p => [...p, { id, status: d[id].status }]);
        pushLog(`Task initialized: ${id}`, "cyan");
      });
      setTests(p => p.map(t => ({ ...t, status: d[t.id]?.status || t.status })));
    } catch {}
  }, 4000);

  useEffect(() => {
    const running = tests.find(t => t.status === "running");
    if (!running) return;
    if (running.id === activeId) return;

    setActiveId(running.id);
    activeWsRef.current?.close();

    const ws = new WebSocket(`${WS}/ws/tests/${running.id}`);
    activeWsRef.current = ws;

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "frame") {
        setScreenshot(`data:image/jpeg;base64,${msg.image}`);
        return;
      }
      if (msg.message) pushLog(msg.message, "white");
    };

    ws.onerror = () => pushLog(`Stream disconnected for ${running.id}`, "red");

    return () => ws.close();
  }, [tests]);

  const done    = tests.filter(t => t.status === "completed").length;
  const failed  = tests.filter(t => t.status === "failed").length;
  const total   = tests.length;

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div className="phase-header">Phase 2 — Validation</div>
        <div className="phase-title">Sequential Execution Engine</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 8, display: "inline-flex", background: C.surface, padding: "4px 10px", borderRadius: 4, border: `1px solid ${C.border}` }}>
          Source Data: <span className="font-mono" style={{ marginLeft: 6, color: "#000000" }}>{source}</span>
        </div>
      </div>

      {/* TOP ROW: Large live feed */}
      <div style={{ width: "100%" }}>
        <ScreenPanel src={screenshot} scanning={!!activeId} label={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="font-mono" style={{ color: C.muted, fontSize: 12 }}>Executing:</span>
            <span className="font-mono" style={{ color: "#000000", fontSize: 13 }}>{activeId || "Idle"}</span>
          </div>
        } />
      </div>

      {/* BOTTOM ROW: Queue/Stats (Left) and Logs (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ display: "flex", gap: 32 }}>
            <div><div className="stat-val">{total}</div><div className="stat-lbl">Queued</div></div>
            <div><div className="stat-val" style={{ color: C.green }}>{done}</div><div className="stat-lbl">Verified Passed</div></div>
            <div><div className="stat-val" style={{ color: C.red }}>{failed}</div><div className="stat-lbl">Anomalies</div></div>
          </div>

          <div className="card" style={{ padding: "20px" }}>
             {total > 0 ? (
               <ProgressBar value={done + failed} max={total} label="Suite Execution Progress" />
             ) : (
               <div style={{ fontSize: 13, color: C.muted }}>Awaiting task payload...</div>
             )}
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
            {tests.map(t => (
              <div key={t.id} className={cx("test-item", t.id === activeId ? "active" : "")}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16 }}>
                  {t.status === "completed" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                   : t.status === "failed" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   : t.status === "running" ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: "2px", borderColor: `transparent transparent ${C.accent} ${C.accent}` }} />
                   : <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.muted }} />
                  }
                </div>
                <span style={{ color: t.id === activeId ? "#000000" : C.muted, flex: 1, fontSize: 13 }} className="font-mono">{t.id}</span>
                <span className={cx("badge", t.status === "completed" ? "badge-done" : t.status === "failed" ? "badge-failed" : t.status === "running" ? "badge-running" : "badge-idle")} style={{ fontSize: 10, padding: "2px 8px" }}>
                  {t.status}
                </span>
              </div>
            ))}
            {tests.length === 0 && (
              <div style={{ color: C.muted, fontSize: 13, padding: "16px", textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 8 }}>
                Orchestrator is preparing tests...<span className="font-mono" style={{ animation: "blink 1s step-end infinite" }}>_</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LogPanel logs={logs} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [phase,      setPhase]      = useState("login");
  const [targetUrl,  setTargetUrl]  = useState("");
  const [mode,       setMode]       = useState("checking");
  const [p3Source,   setP3Source]   = useState("");

  // ── Excel state lifted here so it survives phase transitions ────────────
  const [excelB64,   setExcelB64]   = useState(null);
  const [excelName,  setExcelName]  = useState(null);

  const handleLoginDone = (url, selectedMode) => {
    setTargetUrl(url);
    setMode(selectedMode);
    // Reset excel state on new run
    setExcelB64(null);
    setExcelName(null);
    setPhase("phase2");
  };

  const handlePhase3 = (source, id) => {
    setP3Source(`${source} / ${id}`);
    setPhase("phase3");
  };

  // Called by PhaseSemantic when the report arrives
  const handleExcelReady = (b64, name) => {
    setExcelB64(b64);
    setExcelName(name);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>

        {/* Removed Sidebar as requested. Main content now expands to full width with a max-width for readability */}
        <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
          
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
            <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${C.border}`, width: "100%", maxWidth: "500px" }}>
              {["login", "phase2", "phase3"].map((p, i) => (
                <button key={p} className={cx("nav-tab", phase === p ? "active" : "")}
                  style={{ flex: 1 }}
                  onClick={() => setPhase(p)}
                  disabled={p === "phase2" && !targetUrl || p === "phase3" && !p3Source}>
                  {["0. Auth", "1. Discovery", "2. Validation"][i]}
                </button>
              ))}
            </div>

            {/* Right side of top bar — persistent download pill + URL + Terminate Button */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              
              <ExcelDownloadPill excelB64={excelB64} excelName={excelName} mode={mode} />

              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, background: C.surface, padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                {targetUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, boxShadow: `0 0 6px ${C.accent}` }} />
                    {targetUrl}
                  </div>
                ) : (
                  "Environment not configured"
                )}
              </div>

              {/* Terminate button relocated here so you don't lose the functionality */}
<button
                className="btn btn-danger"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={async () => {
                  try {
                    await fetch(`${API}/terminate`, { method: "POST" });
                  } catch (error) {
                    console.error("Termination error:", error);
                  } finally {
                    window.location.reload();
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                Terminate
              </button>
            </div>
          </div>

          {/* Phase content */}
          {phase === "login" && <PhaseLogin onDone={handleLoginDone} />}

          {phase === "phase2" && targetUrl && mode === "checking" && (
            <PhaseChecking targetUrl={targetUrl} onPhase3={handlePhase3} />
          )}
          {phase === "phase2" && targetUrl && mode === "semantic" && (
            <PhaseSemantic
              targetUrl={targetUrl}
              onPhase3={handlePhase3}
              onExcelReady={handleExcelReady}
            />
          )}

          {phase === "phase3" && <PhaseValidation source={p3Source} />}
        </div>
      </div>
    </>
  );
}