import { useState, useEffect, useRef } from "react";
import SubscriptionGuard from "../../components/UI/SubscriptionGuard";
import { useSelector } from "react-redux";

const API = process.env.REACT_APP_AI_WEB_TESTER_BACKEND_URL;
const WS = API.replace(/^http/, "ws");

// ── Light Professional Color Palette ─────────────────────────────────────────
const C = {
  bg: "#ffffff",
  surface: "#fafafa",
  border: "#e5e7eb",
  accent: "#3b82f6",
  accent2: "#6366f1",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  text: "#000000",
  muted: "#6b7280",
};

// ── Tiny helpers ─────────────────────────────────────────────────────────────
const cx = (...cls) => cls.filter(Boolean).join(" ");

function useInterval(cb, delay) {
  const saved = useRef(cb);

  useEffect(() => {
    saved.current = cb;
  }, [cb]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ── Reusable Copy Button ─────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
      } catch (error) {
        console.error(error);
      } finally {
        textArea.remove();
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className="btn"
      style={{
        padding: "4px 10px",
        fontSize: 12,
        border: `1px solid ${C.border}`,
        minWidth: "64px",
      }}
      onClick={handleCopy}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
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
    display: block; font-size: 12px; font-weight: 600;
    color: #000000; margin-bottom: 8px;
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
    background: ${C.accent}; transition: width .4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Terminal Logs */
  .terminal-container {
    background: #09090b; border: 1px solid ${C.border}; border-radius: 8px;
    padding: 12px 16px; font-family: 'JetBrains Mono', monospace;
  }
  .log-line {
    font-size: 13px; line-height: 1.6; padding: 3px 0;
  }
  .log-cyan   { color: #3b82f6; }
  .log-green  { color: #10b981; }
  .log-yellow { color: #f59e0b; }
  .log-red    { color: #ef4444; }
  .log-white  { color: #f4f4f5; }

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
    background-size: 100% 4px; animation: scan 3s linear infinite; pointer-events: none; opacity: .4;
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
    display: flex; background: #f3f4f6; border: 1px solid ${C.border};
    border-radius: 8px; padding: 4px;
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
  .nav-tab:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Persistent download pill */
  .excel-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 6px;
    background: #ffffff; color: #000000;
    border: 1px solid ${C.border};
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all .2s;
    animation: slideIn .4s cubic-bezier(0.16, 1, 0.3, 1) both;
    white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .excel-pill:hover { background: #f9fafb; border-color: #d1d5db; }

  .excel-pill-pending {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 6px;
    background: transparent; color: ${C.muted};
    border: 1px dashed ${C.border};
    font-size: 12px; font-weight: 600;
    white-space: nowrap; cursor: not-allowed;
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

  /* Terminate Overlay & Animations */
  .terminate-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.85); z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #fff;
  }
  @keyframes pulse-ring {
    0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 25px rgba(239, 68, 68, 0); }
    100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  @keyframes terminate-spin {
    100% { transform: rotate(360deg); }
  }
  .terminate-spinner {
    width: 80px; height: 80px; border-radius: 50%; background: ${C.red};
    animation: pulse-ring 2s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
    display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
  }
  .terminate-icon {
    animation: terminate-spin 3s linear infinite;
  }
`;

// ── Live Screenshot panel ─────────────────────────────────────────────────────
function ScreenPanel({ src, label, scanning = true }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
      }}
    >
      {label && (
        <div className="label" style={{ margin: 0 }}>
          {label}
        </div>
      )}
      <div className="screen-wrap">
        <div className="browser-chrome">
          <div className="browser-dot" />
          <div className="browser-dot" />
          <div className="browser-dot" />
        </div>
        {src ? (
          <img src={src} alt="live screenshot" />
        ) : (
          <div className="screen-placeholder">
            <div className="spinner" style={{ width: 24, height: 24 }} />
            <span>Awaiting browser connection...</span>
          </div>
        )}
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
      style={{
        height: "70vh",
        minHeight: "600px",
        overflowY: "auto",
        width: "100%",
      }}
    >
      {logs.length === 0 ? (
        <div style={{ color: "#a1a1aa", fontSize: 13 }}>
          Waiting for output...
          <span
            className="font-mono"
            style={{ animation: "blink 1s step-end infinite" }}
          >
            _
          </span>
        </div>
      ) : (
        logs.map((l, i) => (
          <div key={i} className={cx("log-line", `log-${l.color || "white"}`)}>
            <span
              style={{ color: "#52525b", marginRight: 12, userSelect: "none" }}
            >
              {String(i + 1).padStart(3, "0")}
            </span>
            {l.message}
          </div>
        ))
      )}
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
          <span style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>
            {label}
          </span>
          <span style={{ fontSize: 13, color: C.muted }}>
            {value} / {max} ({pct}%)
          </span>
        </div>
      )}
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Persistent Excel Download pill ───────────────────────────────────────────
function ExcelDownloadPill({ reports }) {
  if (!reports || reports.length === 0) return null;

  const download = (urlOrB64, name) => {
    const link = document.createElement("a");
    if (urlOrB64.startsWith("http://") || urlOrB64.startsWith("https://")) {
      link.href = urlOrB64;
      link.download = name;
      link.target = "_blank";
    } else {
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${urlOrB64}`;
      link.download = name;
    }
    link.click();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-end",
      }}
    >
      {reports.map((r, i) => (
        <button
          key={i}
          className="excel-pill"
          onClick={() => download(r.urlOrB64, r.name)}
          title={`Download ${r.name}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {r.name.replace("test_report_", "").replace(".xlsx", "")}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Login
// ════════════════════════════════════════════════════════════════════════════
function PhaseLogin({ onDone, onStatusChange }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const { user } = useSelector((state) => state.profile);
  const userId = user?._id;
  const [mode, setMode] = useState("checking");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [needOtp, setNeedOtp] = useState(false);
  const [liveOtp, setLiveOtp] = useState("");
  const wsRef = useRef(null);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  const pushLog = (msg, color = "white") =>
    setLogs((p) => [...p, { message: msg, color }]);

  const connect = () => {
    if (!email || !targetUrl || (!apiKey && !anthropicApiKey)) return;
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
        ws.send(
          JSON.stringify({
            email,
            password: password || undefined,
            otp: otp || undefined,
            target_url: targetUrl,
            api_key: apiKey || undefined,
            anthropic_api_key: anthropicApiKey || undefined,
            user_id: userId || undefined,
          }),
        );
        return;
      }

      if (data.type === "log") {
        pushLog(data.message, data.color || "white");
        return;
      }
      if (data.type === "screenshot") {
        setScreenshot(`data:image/png;base64,${data.data}`);
        return;
      }
      if (data.type === "input_needed" && data.field === "otp") {
        setNeedOtp(true);
        return;
      }

      if (data.type === "done") {
        pushLog("✅ Login complete — auth.json saved", "green");
        setStatus("done");
        ws.close();
        setTimeout(
          () =>
            onDone(
              targetUrl,
              mode,
              apiKey,
              anthropicApiKey,
              goal,
              userId,
              data.session_id,
            ),
          800,
        );
        return;
      }

      if (data.type === "error") {
        pushLog(`✗ ${data.message}`, "red");
        setStatus("error");
      }
    };

    ws.onerror = () => {
      pushLog("WebSocket error", "red");
      setStatus("error");
    };
    ws.onclose = () => {
      if (status === "running") pushLog("Connection closed", "yellow");
    };
  };

  const sendOtp = () => {
    if (!liveOtp || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ otp: liveOtp }));
    pushLog(`OTP sent: ${liveOtp}`, "green");
    setNeedOtp(false);
    setLiveOtp("");
  };

  return (
    <div
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div>
        <div className="phase-header">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Phase 0
        </div>
        <div className="phase-title">Authentication Configuration</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
          Configure target credentials. The agent will stream its browser
          session live.
        </div>
      </div>

      <div style={{ width: "100%" }}>
        <ScreenPanel
          src={screenshot}
          scanning={status === "running"}
          label={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Live Browser Stream</span>
              <span
                className={cx(
                  "badge",
                  status === "running"
                    ? "badge-running"
                    : status === "done"
                      ? "badge-done"
                      : "badge-idle",
                )}
              >
                {status === "running" && (
                  <span className="spinner" style={{ width: 10, height: 10 }} />
                )}
                {status}
              </span>
            </div>
          }
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          <div>
            <label className="label">
              Target Environment URL <span style={{ color: C.red }}>*</span>
            </label>
            <input
              className="input"
              placeholder="https://staging.example.com/sign-in"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={status === "running"}
            />
          </div>
          <div>
            <label className="label">
              Email Address <span style={{ color: C.red }}>*</span>
            </label>
            <input
              className="input"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "running"}
            />
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <div>
              <label className="label">
                Password{" "}
                <span style={{ color: C.muted, fontWeight: 400 }}>
                  (Optional)
                </span>
              </label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === "running"}
              />
            </div>
            <div>
              <label className="label">
                Static OTP{" "}
                <span style={{ color: C.muted, fontWeight: 400 }}>
                  (Optional)
                </span>
              </label>
              <input
                className="input"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={status === "running"}
              />
            </div>
          </div>

          <div className="divider" style={{ margin: "4px 0" }} />

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#000000",
                marginBottom: 4,
              }}
            >
              AI Provider Credentials <span style={{ color: C.red }}>*</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              Please provide at least one API key to power the AI agent.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label
                  className="label"
                  style={{ fontWeight: 400, color: C.muted }}
                >
                  OpenAI API Key
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={status === "running"}
                />
              </div>
              <div>
                <label
                  className="label"
                  style={{ fontWeight: 400, color: C.muted }}
                >
                  Anthropic API Key
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="sk-ant-..."
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  disabled={status === "running"}
                />
              </div>
            </div>
          </div>

          <div className="divider" style={{ margin: "4px 0" }} />

          <div>
            <label className="label" style={{ marginBottom: 12 }}>
              Post-Authentication Pipeline
            </label>
            <div className="toggle-group">
              <button
                className={cx(
                  "toggle-opt",
                  mode === "checking" ? "active" : "",
                )}
                onClick={() => setMode("checking")}
                disabled={status === "running"}
              >
                <span
                  style={{ display: "block", fontSize: 16, marginBottom: 4 }}
                >
                  🔍
                </span>{" "}
                Standard Checking
              </button>
              <button
                className={cx(
                  "toggle-opt",
                  mode === "semantic" ? "active" : "",
                )}
                onClick={() => setMode("semantic")}
                disabled={status === "running"}
              >
                <span
                  style={{ display: "block", fontSize: 16, marginBottom: 4 }}
                >
                  🧠
                </span>{" "}
                Semantic AI Agent
              </button>
              <button
                className={cx("toggle-opt", mode === "feature" ? "active" : "")}
                onClick={() => setMode("feature")}
                disabled={status === "running"}
              >
                <span
                  style={{ display: "block", fontSize: 16, marginBottom: 4 }}
                >
                  🎯
                </span>{" "}
                Feature Testing
              </button>
            </div>
            {mode === "feature" && (
              <div className="fade-up" style={{ marginTop: 16 }}>
                <label className="label">
                  Test Goal <span style={{ color: C.red }}>*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. upload an image in gambar"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  disabled={status === "running"}
                />
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: "12px", marginTop: 8 }}
            onClick={connect}
            disabled={
              !email ||
              !userId ||
              !targetUrl ||
              (!apiKey && !anthropicApiKey) ||
              (mode === "feature" && !goal) ||
              status === "running" ||
              status === "done"
            }
          >
            {status === "connecting" ? (
              <>
                <span className="spinner" /> Connecting Sandbox...
              </>
            ) : status === "running" ? (
              <>
                <span className="spinner" /> Agent Running
              </>
            ) : status === "done" ? (
              "✓ Authentication Complete"
            ) : (
              "Initialize Login Sequence"
            )}
          </button>

          {needOtp && (
            <div
              className="fade-up"
              style={{
                padding: 16,
                borderRadius: 8,
                background: "rgba(245,158,11,.1)",
                border: `1px solid rgba(245,158,11,.2)`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: C.yellow,
                  marginBottom: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Live OTP Required
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Enter code"
                  value={liveOtp}
                  onChange={(e) => setLiveOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                  style={{ flex: 1, background: "#ffffff" }}
                />
                <button className="btn btn-primary" onClick={sendOtp}>
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>

        <LogPanel logs={logs} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Checking Pipeline
// ════════════════════════════════════════════════════════════════════════════
function PhaseChecking({
  targetUrl,
  apiKey,
  anthropicApiKey,
  userId,
  authSessionId,
  onExcelReady,
  onSessionReady,
  onStatusChange,
}) {
  const [jobId, setJobId] = useState(null);

  const [status, setStatus] = useState("starting");
  const [screenshot, setScreenshot] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({
    total: 0,
    completed: 0,
    current: "",
  });
  const [parentSessionId, setParentSessionId] = useState(authSessionId || null);

  // Add this effect right below your state declarations to inform the parent component instantly
  useEffect(() => {
    if (authSessionId) {
      onSessionReady(authSessionId);
    }
  }, [authSessionId, onSessionReady]);

  const wsRef = useRef(null);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  const pushLog = (msg, color = "white") =>
    setLogs((p) => [...p, { message: msg, color }]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      pushLog(`Initializing Checking Pipeline → ${targetUrl}`, "cyan");
      const res = await fetch(`${API}/checking/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: targetUrl,
          api_key: apiKey || undefined,
          anthropic_api_key: anthropicApiKey || undefined,
          user_id: userId || undefined,
          auth_session_id: authSessionId || undefined,
          session_id: authSessionId || undefined,
        }),
      });
      const data = await res.json();
      if (cancelled) return;

      setJobId(data.session_id);
      pushLog(`Job ID Assigned: ${data.job_id}`, "cyan");

      const ws = new WebSocket(`${WS}/ws/checking/${data.session_id}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);

        // 1. Failsafe: Catch parent_session on ANY incoming message
        if (msg.parent_session && !parentSessionId) {
          console.log(
            "[WS:checking] setting parentSessionId →",
            msg.parent_session,
          );
          setParentSessionId(msg.parent_session);
          onSessionReady(msg.parent_session);
        }

        if (msg.type === "ping") return;

        if (msg.type === "frame") {
          setScreenshot(`data:image/jpeg;base64,${msg.image}`);
          if (msg.current_url)
            setProgress((p) => ({ ...p, current: msg.current_url }));
          if (msg.total) setProgress((p) => ({ ...p, total: msg.total }));
          if (msg.completed !== undefined)
            setProgress((p) => ({ ...p, completed: msg.completed }));
          return;
        }
        if (msg.type === "url_started") {
          pushLog(`🔍 Exploring: ${msg.url}`, "cyan");
          setProgress((p) => ({
            ...p,
            current: msg.url,
            total: msg.total || p.total,
            completed: msg.index - 1,
          }));
          return;
        }
        if (msg.type === "url_report") {
          pushLog(`✓ Indexed: ${msg.url}`, "green");
          setProgress((p) => ({
            ...p,
            completed: msg.completed || p.completed,
            total: msg.total || p.total,
          }));
          if (msg.s3_download_url && msg.excel_filename) {
            onExcelReady(msg.s3_download_url, msg.excel_filename);
            pushLog(`📊 Report ready: ${msg.excel_filename}`, "green");
          }
          if (msg.parent_session && !parentSessionId) {
            setParentSessionId(msg.parent_session);
            onSessionReady(msg.parent_session);
          }
          return;
        }
        if (msg.message)
          pushLog(
            msg.message,
            msg.type === "error"
              ? "red"
              : msg.type === "done"
                ? "green"
                : "white",
          );

        if (msg.type === "done") {
          setStatus("done");
          pushLog(
            "✅ Phase 1 Complete — All URLs indexed and reports generated",
            "green",
          );
          if (msg.s3_download_url && msg.excel_filename) {
            onExcelReady(msg.s3_download_url, msg.excel_filename);
          }
          ws.close();
        }
        if (msg.type === "error") setStatus("error");
      };

      ws.onerror = () => pushLog("WebSocket connection error", "red");
      setStatus("running");
    };

    start().catch((e) => pushLog(String(e), "red"));

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  useInterval(
    async () => {
      if (!jobId || status !== "running") return;
      try {
        const r = await fetch(`${API}/checking/${jobId}/status`);
        const d = await r.json();
        setProgress((p) => ({
          ...p,
          total: d.total_urls || p.total,
          current: d.current_url || p.current,
        }));
      } catch {}
    },
    status === "running" ? 3000 : null,
  );

  return (
    <div
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div className="phase-header">Phase 1 — Checking</div>
          <div className="phase-title">Discovery & Crawling</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
            Mapping application structure and collecting endpoints.
          </div>
        </div>
        <span
          className={cx(
            "badge",
            status === "running"
              ? "badge-running"
              : status === "done"
                ? "badge-done"
                : "badge-failed",
          )}
        >
          {status === "running" && (
            <span className="spinner" style={{ width: 10, height: 10 }} />
          )}
          {status === "running" ? "Crawling" : status}
        </span>
      </div>

      <div style={{ width: "100%" }}>
        <ScreenPanel
          src={screenshot}
          scanning={status === "running"}
          label="Agent Viewfinder"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card">
          <div style={{ display: "flex", gap: 32, marginBottom: 24 }}>
            <div>
              <div className="stat-val">{progress.completed}</div>
              <div className="stat-lbl">URLs Processed</div>
            </div>
            <div>
              <div className="stat-val" style={{ color: C.muted }}>
                {progress.total || "—"}
              </div>
              <div className="stat-lbl">Total Discovered</div>
            </div>
          </div>
          {/* <ProgressBar
            value={progress.completed}
            max={progress.total || 1}
            label="Crawl Progress"
          /> */}

          {progress.current && (
            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: C.muted,
                display: "flex",
                gap: 8,
                wordBreak: "break-all",
                background: C.surface,
                padding: "8px 12px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}
            >
              <span style={{ color: C.accent }}>●</span>{" "}
              <span className="font-mono">{progress.current}</span>
            </div>
          )}

          {parentSessionId && (
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: 8,
                background: "rgba(59,130,246,0.05)",
                border: "1px solid rgba(59,130,246,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: C.muted,
                  marginBottom: 8,
                }}
              >
                Parent Session ID — use in Phase 3
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 13,
                    color: "#000000",
                    fontWeight: 600,
                    flex: 1,
                    wordBreak: "break-all",
                  }}
                >
                  {parentSessionId}
                </span>
                <CopyButton text={parentSessionId} />
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                Use this ID in the Phase 3 → Validation tab
              </div>
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
function PhaseSemantic({
  targetUrl,
  apiKey,
  anthropicApiKey,
  onExcelReady,
  userId,
  onSessionReady,
  onStatusChange,
}) {
  const [testId, setTestId] = useState(null);
  const [status, setStatus] = useState("starting");
  const [screenshot, setScreenshot] = useState(null);
  const [logs, setLogs] = useState([]);
  const [step, setStep] = useState(0);
  const wsRef = useRef(null);
  const [parentSessionId, setParentSessionId] = useState(null);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  const pushLog = (msg, color = "white") =>
    setLogs((p) => [...p, { message: msg, color }]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      pushLog(`Initializing Semantic AI Engine → ${targetUrl}`, "cyan");
      const res = await fetch(`${API}/semantic/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          api_key: apiKey || undefined,
          anthropic_api_key: anthropicApiKey || undefined,
          user_id: userId || undefined,
        }),
      });
      const data = await res.json();
      if (cancelled) return;

      setTestId(data.test_id);
      pushLog(`Session ID: ${data.test_id}`, "cyan");
      setParentSessionId(data.parent_session_id);
      if (data.parent_session_id) onSessionReady(data.parent_session_id);

      const ws = new WebSocket(`${WS}/ws/semantic/${data.test_id}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "ping") return;

        if (msg.type === "frame") {
          setScreenshot(`data:image/jpeg;base64,${msg.image}`);
          if (msg.step !== undefined) setStep(msg.step);
          return;
        }
        if (msg.message)
          pushLog(
            msg.message,
            msg.type === "error"
              ? "red"
              : msg.type === "done"
                ? "green"
                : "white",
          );

        if (msg.type === "done") {
          setStatus("done");
          if (msg.s3_download_url) {
            onExcelReady(msg.s3_download_url, msg.excel_filename);
            pushLog(
              "📊 Semantic report saved to S3 — Available for download",
              "green",
            );
          }
          ws.close();
        }
        if (msg.type === "error") setStatus("error");
      };

      ws.onerror = () => pushLog("WebSocket connection error", "red");
      setStatus("running");
    };

    start().catch((e) => pushLog(String(e), "red"));

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  return (
    <div
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div className="phase-header">Phase 1 — Semantic</div>
          <div className="phase-title">Autonomous Exploration</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
            AI agent is naturally exploring and identifying user journeys.
          </div>
        </div>
        <span
          className={cx(
            "badge",
            status === "running"
              ? "badge-running"
              : status === "done"
                ? "badge-done"
                : "badge-failed",
          )}
        >
          {status === "running" && (
            <span className="spinner" style={{ width: 10, height: 10 }} />
          )}
          {status === "running" ? "Exploring" : status}
        </span>
      </div>

      <div style={{ width: "100%" }}>
        <ScreenPanel
          src={screenshot}
          scanning={status === "running"}
          label="Agent Viewfinder"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card">
          <div style={{ display: "flex", gap: 32 }}>
            <div>
              <div className="stat-val">{step}</div>
              <div className="stat-lbl">Interactions Made</div>
            </div>
            <div>
              <div
                className="stat-val"
                style={{
                  color: status === "done" ? C.green : C.accent,
                  display: "flex",
                  alignItems: "center",
                  height: "34px",
                }}
              >
                {status === "done" ? (
                  "Complete"
                ) : (
                  <span className="spinner" style={{ width: 22, height: 22 }} />
                )}
              </div>
              <div className="stat-lbl">Engine Status</div>
            </div>
          </div>
          {parentSessionId && (
            <div
              style={{
                marginTop: 24,
                padding: "14px 16px",
                borderRadius: 8,
                background: "rgba(59,130,246,0.05)",
                border: "1px solid rgba(59,130,246,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: C.muted,
                  marginBottom: 8,
                }}
              >
                Parent Session ID
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 13,
                    color: "#000000",
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
                  {parentSessionId}
                </span>
                <CopyButton text={parentSessionId} />
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                Use this ID in the Phase 3 → Validation tab
              </div>
            </div>
          )}
        </div>
        <LogPanel logs={logs} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Feature Testing
// ════════════════════════════════════════════════════════════════════════════
function PhaseFeature({
  targetUrl,
  apiKey,
  anthropicApiKey,
  goal,
  onStatusChange,
}) {
  const [testId, setTestId] = useState(null);
  const [parentSessionId, setParentSessionId] = useState(null);
  const [status, setStatus] = useState("starting");
  const [screenshot, setScreenshot] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({
    current: 0,
    max: 0,
    lastAction: "",
    summary: null,
  });
  const wsRef = useRef(null);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  const pushLog = (msg, color = "white") =>
    setLogs((p) => [...p, { message: msg, color }]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      pushLog(`Initializing Feature Test Engine → ${targetUrl}`, "cyan");
      pushLog(`Goal: ${goal}`, "cyan");

      const res = await fetch(`${API}/tests/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "whitebox",
          url: targetUrl,
          goal: goal,
          steps: [],
          api_key: apiKey || undefined,
          anthropic_api_key: anthropicApiKey || undefined,
        }),
      });

      const data = await res.json();
      if (cancelled) return;

      setTestId(data.test_id);
      pushLog(`Test Session ID: ${data.test_id}`, "cyan");
      setParentSessionId(data.parent_session_id);

      const ws = new WebSocket(`${WS}/ws/tests/${data.test_id}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "ping") return;

        if (msg.type === "frame") {
          setScreenshot(`data:image/jpeg;base64,${msg.image}`);
          return;
        }
        if (msg.message)
          pushLog(
            msg.message,
            msg.type === "error"
              ? "red"
              : msg.type === "done"
                ? "green"
                : "white",
          );

        if (msg.type === "done" || msg.status === "completed") {
          setStatus("done");
          ws.close();
        }
        if (msg.type === "error" || msg.status === "failed") {
          setStatus("error");
        }
      };

      ws.onerror = () => pushLog("WebSocket connection error", "red");
      setStatus("running");
    };

    start().catch((e) => pushLog(String(e), "red"));
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [targetUrl, goal, apiKey, anthropicApiKey]);

  useInterval(
    async () => {
      if (!testId || status !== "running") return;
      try {
        const r = await fetch(`${API}/tests/${testId}/status`);
        const d = await r.json();
        setProgress((p) => ({
          ...p,
          current: d.current_step !== undefined ? d.current_step : p.current,
          max: d.max_steps || p.max,
          lastAction: d.last_action || p.lastAction,
          summary: d.summary || p.summary,
        }));
        if (d.status === "completed") setStatus("done");
        if (d.status === "failed") setStatus("error");
      } catch {}
    },
    status === "running" ? 3000 : null,
  );

  return (
    <div
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div className="phase-header">Phase 1 — Feature Testing</div>
          <div className="phase-title">Targeted Goal Execution</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
            AI Agent is autonomously pursuing the specified test objective.
          </div>
        </div>
        <span
          className={cx(
            "badge",
            status === "running"
              ? "badge-running"
              : status === "done"
                ? "badge-done"
                : "badge-failed",
          )}
        >
          {status === "running" && (
            <span className="spinner" style={{ width: 10, height: 10 }} />
          )}
          {status === "running" ? "Executing" : status}
        </span>
      </div>

      <div style={{ width: "100%" }}>
        <ScreenPanel
          src={screenshot}
          scanning={status === "running"}
          label="Agent Viewfinder"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card">
          <div style={{ marginBottom: 24 }}>
            <div className="label" style={{ marginBottom: 8 }}>
              Target Goal
            </div>
            <div
              style={{
                fontSize: 14,
                color: C.accent,
                fontWeight: 600,
                background: "rgba(59,130,246,.05)",
                padding: "10px 14px",
                borderRadius: 6,
                border: `1px solid rgba(59,130,246,.2)`,
              }}
            >
              "{goal}"
            </div>
          </div>

          <div style={{ display: "flex", gap: 32, marginBottom: 24 }}>
            <div>
              <div className="stat-val">{progress.current}</div>
              <div className="stat-lbl">Current Step</div>
            </div>
            <div>
              <div className="stat-val" style={{ color: C.muted }}>
                {progress.max || "—"}
              </div>
              <div className="stat-lbl">Max Steps Allowed</div>
            </div>
          </div>
          <ProgressBar
            value={progress.current}
            max={progress.max || 1}
            label="Execution Progress"
          />

          {progress.lastAction && (
            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: C.text,
                display: "flex",
                gap: 8,
                wordBreak: "break-all",
                background: C.surface,
                padding: "8px 12px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}
            >
              <span style={{ color: C.accent }}>●</span>{" "}
              <span>{progress.lastAction}</span>
            </div>
          )}
          {progress.summary && (
            <div
              className="fade-up"
              style={{
                marginTop: 16,
                fontSize: 13,
                color: C.green,
                lineHeight: 1.6,
                background: "rgba(16,185,129,.05)",
                padding: "12px 16px",
                borderRadius: 6,
                border: `1px solid rgba(16,185,129,.2)`,
              }}
            >
              <div
                style={{ fontWeight: 600, marginBottom: 4, color: "#000000" }}
              >
                Test Summary
              </div>
              {progress.summary}
            </div>
          )}
        </div>
        <LogPanel logs={logs} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 3 — MongoDB-Driven Validation (Manual Trigger)
// ════════════════════════════════════════════════════════════════════════════
function PhaseValidationMongoDB({
  onStatusChange,
  parentSessionId,
  setParentSessionId,
}) {
  const [status, setStatus] = useState("idle");
  const [sessions, setSessions] = useState([]);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const { user } = useSelector((state) => state.profile);
  const userId = user?._id;

  const [progress, setProgress] = useState({
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
  });

  const [taskProgress, setTaskProgress] = useState({ done: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [globalBatchReport, setGlobalBatchReport] = useState(null);
  const wsRef = useRef(null);

  // Derive the active session based on in_progress status
  const activeSessionItem = sessions.find(
    (s) => s.phase3_status === "in_progress",
  );
  const activeSessionId = activeSessionItem?.session_id || null;

  // 1. Cleanup: Ensure WebSocket closes if the component unmounts
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  const pushLog = (msg, color = "white") =>
    setLogs((p) => [...p, { message: msg, color }]);

  // 2. Fallback / Sync Polling via REST API
  useInterval(
    async () => {
      if (!parentSessionId || status !== "running") return;
      try {
        const r = await fetch(`${API}/phase3/status/${parentSessionId}`);
        const d = await r.json();

        if (d.sessions) {
          setSessions(d.sessions);
          setProgress({
            pending: d.pending || 0,
            in_progress: d.in_progress || 0,
            completed: d.completed || 0,
            failed: d.failed || 0,
          });
        }
      } catch (e) {
        console.warn(`Status poll failed: ${e}`);
      }
    },
    status === "running" ? 5000 : null,
  );

  const startPhase3 = async () => {
    if (!parentSessionId.trim()) {
      pushLog("❌ Please enter a parent session ID", "red");
      return;
    }

    setStatus("running");
    setLogs([]);
    setSessions([]);
    setTaskProgress({ done: 0, total: 0 });
    setGlobalBatchReport(null);
    setScreenshot(null);

    pushLog(`🚀 Starting Phase 3 for session: ${parentSessionId}`, "cyan");

    try {
      const res = await fetch(`${API}/phase3/start/${parentSessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropic_api_key: anthropicKey || undefined,
          api_key: openaiKey || undefined,
          user_id: userId || undefined,
        }),
      });

      const data = await res.json();

      if (data.error || res.status !== 200) {
        pushLog(
          `❌ Start Error: ${data.error || "Failed to initiate phase 3"}`,
          "red",
        );
        setStatus("error");
        return;
      }

      pushLog(
        `✓ ${data.message || `Found ${data.total_tasks} tasks to run`}`,
        "green",
      );

      const ws = new WebSocket(`${WS}/ws/phase3/${parentSessionId}`);
      wsRef.current = ws;

      ws.onopen = () => pushLog("✅ Connected to Phase 3 stream", "green");

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);

        switch (msg.type) {
          case "status":
            setSessions(msg.sessions || []);
            setProgress({
              pending: msg.pending || 0,
              in_progress: msg.in_progress || 0,
              completed: msg.completed || 0,
              failed: msg.failed || 0,
            });
            break;

          case "log":
            pushLog(msg.message, msg.color || "white");
            break;

          case "task_progress":
            setTaskProgress({ done: msg.tasks_done, total: msg.tasks_total });
            break;

          case "frame":
            const imgSrc =
              msg.image.startsWith("http") || msg.image.startsWith("data:")
                ? msg.image
                : `data:image/jpeg;base64,${msg.image}`;
            setScreenshot(imgSrc);
            break;

          case "batch_done":
            setStatus("done");
            setTaskProgress((p) => ({
              ...p,
              done: p.total > 0 ? p.total : 1,
              total: p.total > 0 ? p.total : 1,
            }));

            const summary = `(Passed: ${msg.completed || 0}, Failed: ${msg.failed || 0})`;
            pushLog(`🎉 Phase 3 complete ${summary}`, "green");

            if (msg.message === "Phase 3 complete" && msg.s3_download_url) {
              setGlobalBatchReport(msg.s3_download_url);
              pushLog(
                `📄 Batch Report generated: ${msg.excel_filename}`,
                "cyan",
              );
            }
            

            ws.close();
            wsRef.current = null;
            break;

          default:
            if (msg.message) {
              pushLog(msg.message, msg.type === "error" ? "red" : "white");
            }
            break;
        }
      };

      ws.onerror = () => pushLog("❌ WebSocket error", "red");

      ws.onclose = () => {
        if (wsRef.current !== null && status === "running") {
          pushLog("🔌 Connection closed unexpectedly", "yellow");
        }
        wsRef.current = null;
      };
    } catch (e) {
      pushLog(`❌ Start failed: ${e.message}`, "red");
      setStatus("error");
    }
  };

  const totalSess = sessions.length;
  const doneSess = progress.completed + progress.failed;
  const sessionPct =
    totalSess > 0 ? Math.round((doneSess / totalSess) * 100) : 0;

  const pct =
    taskProgress.total > 0
      ? Math.round((taskProgress.done / taskProgress.total) * 100)
      : sessionPct;

  return (
    <div
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div>
        <div className="phase-header">Phase 3 — Validation</div>
        <div className="phase-title">MongoDB-Driven Test Execution</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
          Run Phase 3 tests for any completed Phase 2 session
        </div>
      </div>

      {status === "idle" && (
        <div className="card fade-up" style={{ maxWidth: 600 }}>
          <div style={{ marginBottom: 20 }}>
            <label className="label">
              Anthropic API Key{" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>
                (recommended)
              </span>
            </label>
            <input
              className="input"
              type="password"
              placeholder="sk-ant-..."
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="label">
              OpenAI API Key{" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>
                (optional)
              </span>
            </label>
            <input
              className="input"
              type="password"
              placeholder="sk-proj-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
          </div>

          <div style={{ height: 1, background: C.border, margin: "20px 0" }} />

          <label className="label">
            Parent Session ID <span style={{ color: C.red }}>*</span>
          </label>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            Enter the parent session ID (e.g. 57d5b0ba) from Phase 2.
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              className="input"
              placeholder="e.g. 57d5b0ba"
              value={parentSessionId}
              onChange={(e) => setParentSessionId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startPhase3()}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={startPhase3}
              disabled={
                !parentSessionId.trim() ||
                !userId ||
                (!anthropicKey.trim() && !openaiKey.trim())
              }
            >
              Start Phase 3
            </button>
          </div>

          {!anthropicKey.trim() && !openaiKey.trim() && (
            <div style={{ marginTop: 12, fontSize: 12, color: C.red }}>
              At least one API key is required to run validation tests.
            </div>
          )}
        </div>
      )}

      {(status === "running" || status === "done" || status === "error") && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 13, color: C.muted }}>
              Session:{" "}
              <span className="font-mono" style={{ color: "#000" }}>
                {parentSessionId}
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {/* Global Batch Report from websocket final message */}
              {globalBatchReport && (
                <a
                  href={globalBatchReport}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    background: C.green || "#10b981",
                    color: "white",
                    padding: "6px 12px",
                    fontSize: 13,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Global Batch Report
                </a>
              )}

              <span
                className={cx(
                  "badge",
                  status === "running"
                    ? "badge-running"
                    : status === "error"
                      ? "badge-failed"
                      : "badge-done",
                )}
              >
                {status === "running" && (
                  <span className="spinner" style={{ width: 10, height: 10 }} />
                )}
                {status}
              </span>
            </div>
          </div>

          <ScreenPanel
            src={screenshot}
            scanning={status === "running"}
            label={activeSessionId ? `Running: ${activeSessionId}` : "Idle"}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="card">
              <div style={{ marginBottom: 20 }}>
                <div className="stat-val">{Math.min(pct, 100)}%</div>
                <div className="stat-lbl">Completion Progress</div>
              </div>

              <div
                style={{
                  height: 8,
                  background: "#f3f4f6",
                  borderRadius: 999,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${Math.min(pct, 100)}%`,
                    background: status === "done" ? C.green : C.accent,
                    transition: "width .5s ease",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 16,
                  marginTop: 20,
                }}
              >
                <div>
                  <div
                    className="stat-val"
                    style={{ fontSize: 20, color: C.muted }}
                  >
                    {progress.pending}
                  </div>
                  <div className="stat-lbl">Pending</div>
                </div>
                <div>
                  <div
                    className="stat-val"
                    style={{ fontSize: 20, color: C.accent }}
                  >
                    {progress.in_progress}
                  </div>
                  <div className="stat-lbl">Running</div>
                </div>
                <div>
                  <div
                    className="stat-val"
                    style={{ fontSize: 20, color: C.green }}
                  >
                    {progress.completed}
                  </div>
                  <div className="stat-lbl">Completed</div>
                </div>
                <div>
                  <div
                    className="stat-val"
                    style={{ fontSize: 20, color: C.red }}
                  >
                    {progress.failed}
                  </div>
                  <div className="stat-lbl">Failed</div>
                </div>
              </div>

              {sessions.length > 0 && (
                <div
                  style={{
                    marginTop: 20,
                    maxHeight: 300,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {sessions.map((s, i) => (
                    <div
                      key={i}
                      className={cx(
                        "test-item",
                        s.session_id === activeSessionId ? "active" : "",
                      )}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          overflow: "hidden",
                        }}
                      >
                        {s.phase3_status === "completed" ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={C.green}
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : s.phase3_status === "failed" ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={C.red}
                            strokeWidth="3"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        ) : s.phase3_status === "in_progress" ? (
                          <span
                            className="spinner"
                            style={{
                              width: 10,
                              height: 10,
                              borderWidth: "2px",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: C.muted,
                            }}
                          />
                        )}

                        <span
                          className="font-mono"
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {s.page_url}
                        </span>

                        <span
                          className={cx(
                            "badge",
                            s.phase3_status === "completed"
                              ? "badge-done"
                              : s.phase3_status === "failed"
                                ? "badge-failed"
                                : s.phase3_status === "in_progress"
                                  ? "badge-running"
                                  : "badge-idle",
                          )}
                          style={{ fontSize: 9, padding: "2px 6px" }}
                        >
                          {s.phase3_status}
                        </span>
                      </div>

                      {/* INDIVIDUAL SESSION DOWNLOAD BUTTONS */}
                      <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
                        {s.s3_download_url && (
                          <a
                            href={s.s3_download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              background: "rgba(107, 114, 128, 0.1)",
                              color: C.muted,
                              borderRadius: 6,
                              textDecoration: "none",
                              fontWeight: 600,
                              border: `1px solid rgba(107, 114, 128, 0.2)`,
                              transition: "all 0.2s ease",
                            }}
                            title="Download Initial Test Report"
                          >
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Test Report
                          </a>
                        )}

                        {s.final_report_url && (
                          <a
                            href={s.final_report_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              background: "rgba(16, 185, 129, 0.1)",
                              color: C.green || "#10b981",
                              borderRadius: 6,
                              textDecoration: "none",
                              fontWeight: 600,
                              border: `1px solid rgba(16, 185, 129, 0.2)`,
                              transition: "all 0.2s ease",
                            }}
                            title="Download Final Validation Report"
                          >
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Final Report
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <LogPanel logs={logs} />
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [phase, setPhase] = useState("login");
  const [activePhaseStatus, setActivePhaseStatus] = useState("idle");
  const [targetUrl, setTargetUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [mode, setMode] = useState("checking");
  const [goal, setGoal] = useState("");
  const { user } = useSelector((state) => state.profile);
  const userId = user?._id;
  const [activeSessionId, setActiveSessionId] = useState("");

  // Replaced timer countdown logic with an active boolean flag
  const [isTerminating, setIsTerminating] = useState(false);
  const [phase3SessionId, setPhase3SessionId] = useState("");

  const [excelReports, setExcelReports] = useState([]);
  const [authSessionId, setAuthSessionId] = useState("");
  const isProcessing = ["connecting", "starting", "running"].includes(
    activePhaseStatus,
  );

  useEffect(() => {
    if (isProcessing) {
      localStorage.setItem("autopilotRunning", "true");
    } else {
      localStorage.setItem("autopilotRunning", "false");
    }
  }, [isProcessing]);

  // Browser level refresh/close blocking
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isProcessing) {
        e.preventDefault();
        e.returnValue =
          "Processing is ongoing. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isProcessing]);

  // Reliable API hit if the user accepts the browser unload popup
  useEffect(() => {
    const handleUnload = () => {
      const idToTerminate =
        phase === "phase3" ? phase3SessionId : activeSessionId;
      if (isProcessing && idToTerminate) {
        navigator.sendBeacon(`${API}/terminate/${idToTerminate}`);
      }
    };
    window.addEventListener("unload", handleUnload);
    return () => window.removeEventListener("unload", handleUnload);
  }, [isProcessing, activeSessionId, phase, phase3SessionId]);

  // Terminate Logic directly awaiting fetch
  const handleTerminateClick = async () => {
    const idToTerminate =
      phase === "phase3" ? phase3SessionId : activeSessionId;

    if (!idToTerminate) {
      console.warn("No active session ID found to terminate.");
      return;
    }

    setIsTerminating(true);

    try {
      const res = await fetch(`${API}/terminate/${idToTerminate}`, {
        method: "POST",
      });
      const data = await res.json();

      // Successfully processed by the backend
      if (data.status === "terminated") {
        window.location.reload();
      } else {
        // Fallback reloading if the termination succeeds with a different payload
        window.location.reload();
      }
    } catch (error) {
      console.error("Termination error:", error);
      setIsTerminating(false);
      // Let the user try again
    }
  };

  const handleTabClick = (p) => {
    if (p === phase) return;
    if (isProcessing) return;
    // Block switching visually if processing is ongoing
    setPhase(p);
  };

  const handleLoginDone = (
    url,
    selectedMode,
    openaiKey,
    antKey,
    selectedGoal,
    uid,
    loginSessionId,
  ) => {
    localStorage.setItem("targetUrl", url);
    localStorage.setItem("autopilotRunning", "true");
    setTargetUrl(url);
    setApiKey(openaiKey);
    setAnthropicApiKey(antKey);
    setActiveSessionId(loginSessionId || "");
    setMode(selectedMode);
    setGoal(selectedGoal || "");

    setAuthSessionId(loginSessionId || "");
    setExcelReports([]);
    setPhase("phase2");
  };

  const handleExcelReady = (urlOrB64, name) => {
    setExcelReports((prev) => [...prev, { urlOrB64, name }]);
  };

  return (
    <SubscriptionGuard>
      <>
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
        <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
          <div
            style={{
              flex: 1,
              padding: "32px 40px",
              overflowY: "auto",
              maxWidth: "1400px",
              margin: "0 auto",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 36,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  borderBottom: `1px solid ${C.border}`,
                  width: "100%",
                  maxWidth: "500px",
                }}
              >
                {["login", "phase2", "phase3"].map((p, i) => {
                  let isDisabled = false;
                  if (isProcessing) {
                    isDisabled = p !== phase;
                  } else {
                    if (p === "phase2" && !targetUrl) isDisabled = true;
                  }

                  return (
                    <button
                      key={p}
                      className={cx("nav-tab", phase === p ? "active" : "")}
                      style={{ flex: 1 }}
                      onClick={() => handleTabClick(p)}
                      disabled={isDisabled}
                    >
                      {["0. Auth", "1. Discovery", "2. Validation"][i]}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ExcelDownloadPill reports={excelReports} />

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.muted,
                    background: C.surface,
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  {targetUrl ? (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: C.accent,
                          boxShadow: `0 0 6px ${C.accent}`,
                        }}
                      />
                      {targetUrl}
                    </div>
                  ) : (
                    "Environment not configured"
                  )}
                </div>

                <button
                  className="btn btn-danger"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={handleTerminateClick}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                  Terminate
                </button>
              </div>
            </div>

            {isProcessing && (
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #f59e0b",
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 20,
                  fontWeight: 600,
                }}
              >
                ⚠️ Autopilot test is currently running. Please do not refresh or
                leave this page until execution completes.
              </div>
            )}

            {phase === "login" && (
              <PhaseLogin
                onDone={handleLoginDone}
                onStatusChange={setActivePhaseStatus}
              />
            )}

            {phase === "phase2" && targetUrl && mode === "checking" && (
              <PhaseChecking
                targetUrl={targetUrl}
                apiKey={apiKey}
                anthropicApiKey={anthropicApiKey}
                userId={userId}
                authSessionId={authSessionId}
                onExcelReady={handleExcelReady}
                onSessionReady={(sid) => setActiveSessionId(sid)}
                onStatusChange={setActivePhaseStatus}
              />
            )}

            {phase === "phase2" && targetUrl && mode === "semantic" && (
              <PhaseSemantic
                targetUrl={targetUrl}
                apiKey={apiKey}
                anthropicApiKey={anthropicApiKey}
                onExcelReady={handleExcelReady}
                userId={userId}
                onSessionReady={(sid) => setActiveSessionId(sid)}
                onStatusChange={setActivePhaseStatus}
              />
            )}
            {phase === "phase2" && targetUrl && mode === "feature" && (
              <PhaseFeature
                targetUrl={targetUrl}
                apiKey={apiKey}
                anthropicApiKey={anthropicApiKey}
                goal={goal}
                onStatusChange={setActivePhaseStatus}
              />
            )}

            {phase === "phase3" && (
              <PhaseValidationMongoDB
                apiKey={apiKey}
                anthropicApiKey={anthropicApiKey}
                onStatusChange={setActivePhaseStatus}
                parentSessionId={phase3SessionId}
                setParentSessionId={setPhase3SessionId}
              />
            )}
          </div>
        </div>

        {isTerminating && (
          <div className="terminate-overlay">
            <h2 style={{ fontSize: 24, marginBottom: 16 }}>
              Terminating Session...
            </h2>
            <div className="terminate-spinner">
              <svg
                className="terminate-icon"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <p
              style={{
                marginTop: 24,
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "0.5px",
              }}
            >
              Don't refresh the page.
            </p>
            <p style={{ marginTop: 8, color: "#a1a1aa" }}>
              Allowing graceful teardown. Please wait...
            </p>
          </div>
        )}
      </>
    </SubscriptionGuard>
  );
}
