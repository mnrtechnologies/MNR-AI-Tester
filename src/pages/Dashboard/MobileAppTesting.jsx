import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Smartphone, Terminal, CheckCircle2, XCircle, Play, Activity,
  Loader2, Box, LayoutDashboard, ListChecks, StopCircle, Download,
  Upload, AlertTriangle, Wifi, WifiOff, X, Zap, RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SubscriptionGuard from '../../components/UI/SubscriptionGuard';

// --- NEW CREDIT IMPORTS ---
import {
  fetchCreditAccount,
  authorizeRun,
  settleRun,
  releaseRun,
} from '../../services/operations/creditAPIs';

const API_URL    = process.env.REACT_APP_AI_MOBILE_TESTER_BACKEND_URL;
const UPLOAD_URL = process.env.REACT_APP_AI_MOBILE_UPLOAD_URL;
const WS_URL     = process.env.REACT_APP_AI_MOBILE_TESTER_BACKEND_WS_URL;

const PHASE_ORDER = ['Validation', 'Exploration', 'Testing'];

const getAuthHeader = () => {
  try {
    const token = JSON.parse(localStorage.getItem('token'));
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

export default function MobileTestingDashboard() {
  // --- REDUX & CREDIT STATE ---
  const { user } = useSelector((state) => state.profile);
  const creditAccount = user?.creditAccount;
  const dispatch = useDispatch();

  const [activeTab, setActiveTab]             = useState('logs');
  const [formData, setFormData]               = useState({ email: '', password: '', maxActions: 200 });
  const [apkFile, setApkFile]                 = useState(null);
  const [isDragOver, setIsDragOver]           = useState(false);
  const [uploadedApkInfo, setUploadedApkInfo] = useState(null);

  const [sessionId, setSessionId]             = useState(null);
  const [loadingState, setLoadingState]       = useState(null); // null | 'uploading' | 'starting' | 'running'
  const [screenshot, setScreenshot]           = useState(null);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [phase, setPhase]                     = useState('idle');
  const [backendStatus, setBackendStatus]     = useState('');
  const [logs, setLogs]                       = useState([]);
  const [stats, setStats]                     = useState({ screens: 0, passed: 0, failed: 0 });
  const [assertions, setAssertions]           = useState([]);
  const [wsConnected, setWsConnected]         = useState(false);

  const [showStopModal, setShowStopModal]     = useState(false);
  const [isDownloading, setIsDownloading]     = useState(false);

  const wsRef                 = useRef(null);
  const shouldReconnectRef    = useRef(false);
  const lastWsEventRef        = useRef(Date.now());
  const silentReconnectRef    = useRef(0);
  const autoRestartCallbackRef = useRef(null);
  const logsEndRef            = useRef(null);
  const fileInputRef          = useRef(null);
  
  // --- BILLING REF: Tracks current test run for WS events ---
  const billingIdRef          = useRef(null);

  // Fetch credit balance on mount
  useEffect(() => {
    dispatch(fetchCreditAccount());
  }, [dispatch]);

  // auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeTab]);

  const addLog = useCallback((text) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { text, ts }]);
  }, []);

  // WebSocket — connect when sessionId is set, auto-reconnect on drop
  useEffect(() => {
    if (!sessionId || !WS_URL) return;

    shouldReconnectRef.current = true;
    lastWsEventRef.current = Date.now();
    let reconnectTimer;
    let watchdogTimer;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        lastWsEventRef.current = Date.now();
        ws.send(JSON.stringify({ action: 'SUBSCRIBE', sessionId }));

        // Watchdog: ping every 15s; if silent for 30s force-close to trigger reconnect
        watchdogTimer = setInterval(() => {
          if (!mounted) return;
          if (ws.readyState === WebSocket.OPEN) {
            if (Date.now() - lastWsEventRef.current > 30000) {
              silentReconnectRef.current += 1;
              if (silentReconnectRef.current >= 2) {
                // Two silent cycles → server needs a fresh POST /sessions call
                addLog('↺ Stream unresponsive — triggering auto-restart…');
                clearInterval(watchdogTimer);
                shouldReconnectRef.current = false; // stop onclose from spawning another reconnect
                ws.close();
                autoRestartCallbackRef.current?.();
              } else {
                addLog('⚠ Stream silent — reconnecting…');
                ws.close();
              }
            } else {
              try { ws.send(JSON.stringify({ action: 'PING' })); } catch {}
            }
          }
        }, 15000);
      };

      ws.onmessage = (msg) => {
        try {
          const { event, payload } = JSON.parse(msg.data);
          switch (event) {
            case 'SCREENSHOT_FRAME':
              lastWsEventRef.current   = Date.now();
              silentReconnectRef.current = 0;
              setScreenshot(`data:image/jpeg;base64,${payload.base64}`);
              setScreenshotFlash(true);
              setTimeout(() => setScreenshotFlash(false), 350);
              break;
            case 'PHASE_STARTED': {
              lastWsEventRef.current   = Date.now();
              silentReconnectRef.current = 0;
              const pName = payload.phase
                ? payload.phase.charAt(0).toUpperCase() + payload.phase.slice(1).toLowerCase()
                : payload.phase;
              setPhase(pName);
              addLog(`▶ Phase: ${pName} — ${payload.description}`);
              break;
            }
            case 'PHASE_COMPLETED':
              lastWsEventRef.current   = Date.now();
              silentReconnectRef.current = 0;
              addLog(`✓ ${payload.summary}`);
              break;
            case 'NEW_SCREEN_DISCOVERED':
              lastWsEventRef.current   = Date.now();
              silentReconnectRef.current = 0;
              setStats(s => ({ ...s, screens: s.screens + 1 }));
              addLog(`📱 Screen: ${payload.screenTitle} (${payload.elementCount} elements)`);
              break;
            case 'ASSERTION_RESULT':
              lastWsEventRef.current   = Date.now();
              silentReconnectRef.current = 0;
              setAssertions(a => [...a, payload]);
              setStats(s => ({
                ...s,
                passed: payload.passed ? s.passed + 1 : s.passed,
                failed: !payload.passed ? s.failed + 1 : s.failed,
              }));
              addLog(`${payload.passed ? '✅' : '❌'} ${payload.elementText}`);
              break;
            case 'SESSION_COMPLETED':
              shouldReconnectRef.current = false;
              setPhase('done');
              setLoadingState(null);
              addLog('🎉 Session complete — report is ready for download.');
              toast.success('Testing complete! Download your report.');
              
              // --- SETTLE CREDITS ON SUCCESS ---
              if (billingIdRef.current) {
                settleRun(billingIdRef.current).then(() => dispatch(fetchCreditAccount()));
              }
              break;
            case 'SESSION_FAILED':
              shouldReconnectRef.current = false;
              setPhase('failed');
              setLoadingState(null);
              addLog(`💥 Session failed: ${payload.error}`);
              toast.error(`Session failed: ${payload.error}`);
              
              // --- RELEASE CREDITS ON FAILURE ---
              if (billingIdRef.current) {
                releaseRun(billingIdRef.current).then(() => dispatch(fetchCreditAccount()));
              }
              break;
            default:
              break;
          }
        } catch { /* malformed frame */ }
      };

      ws.onclose = () => {
        clearInterval(watchdogTimer);
        setWsConnected(false);
        if (mounted && shouldReconnectRef.current) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
        addLog('⚠ WebSocket error — retrying…');
      };
    };

    connect();

    return () => {
      mounted = false;
      shouldReconnectRef.current = false;
      clearInterval(watchdogTimer);
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [sessionId, addLog, dispatch]);

  // Status polling — fallback sync when WS lags
  useEffect(() => {
    if (!sessionId || phase === 'done' || phase === 'failed') return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}`, {
          headers: { ...getAuthHeader() },
        });
        const result = await res.json();
        if (result.success) {
          const d = result.data;
          setBackendStatus(d.status || '');
          setStats(prev => ({
            screens: Math.max(prev.screens, d.totalScreens || 0),
            passed:  Math.max(prev.passed,  d.passedChecks || 0),
            failed:  Math.max(prev.failed,  d.failedChecks || 0),
          }));
          // Sync pipeline phase from polling in case WS events are missed
          const statusPhaseMap = {
            VALIDATION: 'Validation', EXPLORING: 'Exploration',
            EXPLORATION: 'Exploration', TESTING: 'Testing',
            COMPLETED: 'done', COMPLETE: 'done',
          };
          const mappedPhase = statusPhaseMap[(d.status || '').toUpperCase()];
          if (mappedPhase) setPhase(mappedPhase);
        }
      } catch { /* silent */ }
    };

    const id = setInterval(poll, 5000);
    poll();
    return () => clearInterval(id);
  }, [sessionId, phase]);

  // helpers
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast.error('Please select a valid .apk file.');
      return;
    }
    setApkFile(file);
    setUploadedApkInfo(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxActions' ? (parseInt(value, 10) || 200) : value,
    }));
  };

  const resetSession = () => {
    shouldReconnectRef.current = false;
    wsRef.current?.close();
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSessionId(null);
    setLoadingState(null);
    setScreenshot(null);
    setPhase('idle');
    setBackendStatus('');
    setLogs([]);
    setStats({ screens: 0, passed: 0, failed: 0 });
    setAssertions([]);
    setUploadedApkInfo(null);
    setApkFile(null);
    setWsConnected(false);
    setActiveTab('logs');
    silentReconnectRef.current = 0;
    billingIdRef.current = null;
  };

  // Auto-restart: skips re-upload, goes straight to POST /sessions with existing serverApkPath
  const autoRestart = useCallback(async () => {
    const apkPath = uploadedApkInfo?.serverApkPath;
    if (!apkPath) return;

    // --- PREFLIGHT FOR AUTO-RESTART ---
    const BASE_COST = 5;
    if (creditAccount && !creditAccount.unlimited && !creditAccount.overageEnabled && creditAccount.balance < BASE_COST) {
      addLog(`💥 Restart failed: Insufficient credits. Needs ${BASE_COST}.`);
      return;
    }

    // Generate new billing ID
    const restartBillingId = `mob_restart_${Date.now()}`;
    billingIdRef.current = restartBillingId;

    silentReconnectRef.current = 0;
    addLog('↺ Stream dead — restarting session (no re-upload)…');
    setLoadingState('starting');

    try {
      // --- HOLD CREDITS ---
      const authRes = await authorizeRun(restartBillingId, { acknowledgedOversized: false });
      if (!authRes.ok) throw new Error(authRes.message || "Failed to reserve credits.");
      dispatch(fetchCreditAccount());

      const appPackage  = uploadedApkInfo?.appPackage;
      const appActivity = uploadedApkInfo?.appActivity;
      const sessionBody = { apkPath, appPackage, appActivity, maxActions: formData.maxActions };
      if (formData.email || formData.password) {
        sessionBody.credentials = { username: formData.email, password: formData.password };
      }

      const res  = await fetch(`${API_URL}/sessions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body:    JSON.stringify(sessionBody),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Restart failed');

      const newId = json.data?.sessionId || json.data?.id || json.sessionId;
      if (!newId) throw new Error('No session ID returned');

      setSessionId(newId);
      setLoadingState('running');
      addLog(`✓ Session restarted — ID: ${newId}`);
    } catch (err) {
      // --- RELEASE CREDITS ON FAILURE ---
      if (billingIdRef.current) {
        await releaseRun(billingIdRef.current);
        dispatch(fetchCreditAccount());
      }
      
      addLog(`💥 Auto-restart failed: ${err.message}`);
      setLoadingState(null);
      toast.error('Auto-restart failed — please relaunch manually.');
    }
  }, [uploadedApkInfo, formData, addLog, creditAccount, dispatch]);

  // Keep ref current so the WS watchdog (closure) can always call the latest version
  autoRestartCallbackRef.current = autoRestart;

  const formatSize = (bytes) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  // Main flow: Step 1 – upload APK → Step 2 – start session
  const startSession = async (e) => {
    e.preventDefault();
    if (!apkFile) { toast.error('Please select an APK file.'); return; }

    // --- 1. PREFLIGHT CHECK ---
    const BASE_COST = 5; // Standard cost configuration for a run
    if (
      creditAccount &&
      !creditAccount.unlimited &&
      !creditAccount.overageEnabled &&
      creditAccount.balance < BASE_COST
    ) {
      toast.error(`Not enough credits. Mobile app testing requires ${BASE_COST} credits, but you only have ${creditAccount.balance}.`);
      return;
    }

    setLogs([]);
    setAssertions([]);
    setStats({ screens: 0, passed: 0, failed: 0 });
    setScreenshot(null);
    setUploadedApkInfo(null);
    setPhase('starting');
    setActiveTab('logs');
    
    // Create a local billing identifier for this run
    const sessionBillingId = `mob_${Date.now()}`;
    billingIdRef.current = sessionBillingId;

    try {
      // --- 2. HOLD CREDITS (Before expensive upload) ---
      setLoadingState('starting');
      addLog('💳 Reserving credits for test run…');
      const authRes = await authorizeRun(sessionBillingId, { acknowledgedOversized: false });
      
      if (!authRes.ok) {
        throw new Error(authRes.message || "Failed to reserve credits.");
      }
      dispatch(fetchCreditAccount());

      // Step 1: Upload APK
      setLoadingState('uploading');
      addLog('⬆ Uploading APK to server…');

      const uploadBody = new FormData();
      uploadBody.append('apk', apkFile);

      const uploadRes  = await fetch(UPLOAD_URL, {
        method: 'POST',
        body:   uploadBody,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) throw new Error(uploadJson.error || 'APK upload failed');

      const { serverApkPath, appPackage, appActivity } = uploadJson.data;
      setUploadedApkInfo({ serverApkPath, appPackage, appActivity });
      addLog(`✓ APK uploaded — package: ${appPackage}`);

      // Step 2: Start session
      setLoadingState('starting');
      addLog('▶ Initializing AI test agent…');

      const sessionBody = {
        apkPath:     serverApkPath,
        appPackage,
        appActivity,
        maxActions:  formData.maxActions,
      };
      if (formData.email || formData.password) {
        sessionBody.credentials = { username: formData.email, password: formData.password };
      }

      const sessionRes  = await fetch(`${API_URL}/sessions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body:    JSON.stringify(sessionBody),
      });
      const sessionJson = await sessionRes.json();
      if (!sessionJson.success) throw new Error(sessionJson.error || 'Failed to start session');

      const newId =
        sessionJson.data?.sessionId ||
        sessionJson.data?.id        ||
        sessionJson.sessionId;
      if (!newId) throw new Error('No session ID returned from server');

      setSessionId(newId);
      setLoadingState('running');
      addLog(`✓ Session started — ID: ${newId}`);
      toast.success('Agent launched! Monitoring live stream…');

    } catch (err) {
      // --- 3. RELEASE CREDITS ON FAILURE ---
      if (billingIdRef.current) {
        await releaseRun(billingIdRef.current);
        dispatch(fetchCreditAccount());
        billingIdRef.current = null;
      }
      
      addLog(`💥 ${err.message}`);
      toast.error(err.message);
      setPhase('failed');
      setLoadingState(null);
    }
  };

  // Stop session
  const confirmStop = async () => {
    setShowStopModal(false);
    if (!sessionId) return;
    addLog('🛑 Sending stop signal to agent…');
    try {
      const res    = await fetch(`${API_URL}/sessions/${sessionId}/stop`, {
        method:  'POST',
        headers: { ...getAuthHeader() },
      });
      const result = await res.json();
      if (result.success) {
        addLog('🛑 Agent stopped by user.');
        toast.success('Session stopped.');
      } else {
        addLog(`💥 Stop failed: ${result.error}`);
        toast.error(result.error || 'Failed to stop session');
      }
    } catch (err) {
      addLog(`💥 Network error: ${err.message}`);
      toast.error('Network error while stopping session');
    } finally {
      // --- RELEASE CREDITS ON MANUAL STOP ---
      if (billingIdRef.current) {
        await releaseRun(billingIdRef.current);
        dispatch(fetchCreditAccount());
      }
      
      shouldReconnectRef.current = false;
      setPhase('failed');
      setLoadingState(null);
    }
  };

  // Download report
  const handleDownloadReport = async () => {
    if (!sessionId || isDownloading) return;
    setIsDownloading(true);
    addLog('⬇ Requesting report…');
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/report`, {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Report not found');
      }
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `report-${sessionId.slice(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addLog('✓ Report downloaded successfully.');
      toast.success('Report downloaded!');
    } catch (err) {
      addLog(`💥 Download failed: ${err.message}`);
      toast.error(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // style helpers
  const getLogStyle = (text) => {
    if (/✅|✓|🎉/.test(text))   return 'border-emerald-500 text-emerald-200';
    if (/❌|💥|🛑/.test(text))   return 'border-rose-500 text-rose-200';
    if (/▶|⬆|⬇|📱/.test(text)  ) return 'border-orange-500 text-orange-200';
    if (/⚠/.test(text))           return 'border-amber-500 text-amber-200';
    return 'border-slate-600 text-slate-300';
  };

  const getPhaseStatus = (step) => {
    const phaseIdx = PHASE_ORDER.indexOf(phase);
    const stepIdx  = PHASE_ORDER.indexOf(step);
    if (phase === 'done')                                    return 'done';
    if (phase === 'failed')  return stepIdx < phaseIdx ? 'done' : 'idle';
    if (phase === 'starting' && step === 'Validation')       return 'active';
    if (stepIdx < phaseIdx)                                  return 'done';
    if (stepIdx === phaseIdx)                                return 'active';
    return 'idle';
  };

  const phaseDotClass  = { done: 'bg-emerald-500', active: 'bg-orange-500 animate-pulse', idle: 'bg-slate-200' };
  const phaseTextClass = { done: 'text-emerald-600', active: 'text-orange-600',            idle: 'text-slate-400' };

  const isSessionActive = !!(sessionId && phase !== 'done' && phase !== 'failed');
  const isLoading       = loadingState !== null;

  const loadingLabel = loadingState === 'uploading' ? 'Uploading APK…'
    : loadingState === 'starting' ? 'Starting Agent…'
    : loadingState === 'running'  ? 'Agent Running'
    : 'Launch Agent';

  const statusConfig = isSessionActive
    ? { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse', label: backendStatus || 'Running' }
    : phase === 'done'
    ? { pill: 'bg-blue-50 text-blue-700 border-blue-200',           dot: 'bg-blue-500',   label: 'Completed' }
    : phase === 'failed'
    ? { pill: 'bg-rose-50 text-rose-700 border-rose-200',           dot: 'bg-rose-500',   label: 'Stopped'   }
    : { pill: 'bg-slate-50 text-slate-500 border-slate-200',        dot: 'bg-slate-400',  label: 'Offline'   };

  const progressWidth =
    phase === 'done'     || phase === 'Testing'    ? 'calc(100% - 4rem)' :
    phase === 'Exploration'                        ? 'calc(50% - 2rem)'  :
    phase === 'Validation' || phase === 'starting' ? '0'                  : '0';

  const progressColor =
    phase === 'done'   ? '#10b981' :
    phase === 'failed' ? '#f43f5e' : '#f97316';

  return (
    <SubscriptionGuard featureName="Mobile App Testing">
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .shimmer-bar {
          background: linear-gradient(90deg, #fed7aa 25%, #fb923c 50%, #fed7aa 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
      `}} />

      {/* Stop Confirmation Modal */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Stop the Agent?</h3>
                <p className="text-sm text-slate-500 mt-0.5">This will terminate the active test session immediately.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-6 leading-relaxed">
              A partial report may still be available after stopping.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStopModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStop}
                className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
              >
                <StopCircle size={15} /> Stop Agent
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6 pb-12 pt-4 px-4">

        {/* 1. Agent Control Panel */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-500/20">
                <Activity size={13} /><span>Agent Control Panel</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Mobile <span className="text-orange-500">Test Runner</span>
              </h1>
              <p className="text-slate-500 mt-1.5 text-sm">Upload your APK and launch the autonomous AI testing agent.</p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              
              {/* --- NEW HEADER CREDIT DISPLAY --- */}
              {creditAccount && !creditAccount.unlimited && (
                <div 
                  className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 mb-1 shadow-sm"
                  title={creditAccount.reserved > 0 ? `${creditAccount.reserved} credits reserved for a running test` : "Available Balance"}
                >
                  Credits: 
                  <span className={creditAccount.balance <= 0 ? "text-rose-500" : "text-emerald-600"}>
                    {creditAccount.balance}
                  </span>
                  {creditAccount.reserved > 0 && (
                    <span className="text-orange-500 ml-1">({creditAccount.reserved} reserved)</span>
                  )}
                </div>
              )}

              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${statusConfig.pill}`}>
                <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                {statusConfig.label}
              </div>

              {sessionId && (
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${wsConnected ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {wsConnected ? 'Live stream active' : 'Reconnecting…'}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isSessionActive && (
                  <button
                    onClick={() => setShowStopModal(true)}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white border border-rose-200 text-rose-600 px-3.5 py-1.5 rounded-full hover:bg-rose-50 transition-colors"
                  >
                    <StopCircle size={13} /> Stop Agent
                  </button>
                )}
                {phase === 'done' && (
                  <button
                    onClick={handleDownloadReport}
                    disabled={isDownloading}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-emerald-500 text-white px-3.5 py-1.5 rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-70"
                  >
                    {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    {isDownloading ? 'Downloading…' : 'Download Report'}
                  </button>
                )}
                {(phase === 'done' || phase === 'failed') && (
                  <button
                    onClick={resetSession}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-500 px-3.5 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw size={12} /> New Test
                  </button>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={startSession} className="flex flex-col gap-5">

            {/* APK drag-and-drop zone */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">APK File</label>
              <div
                onDragOver={(e) => { e.preventDefault(); if (!isSessionActive) setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (!isSessionActive) handleFileSelect(e.dataTransfer.files[0]); }}
                onClick={() => !isSessionActive && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-5 flex items-center gap-4 transition-all ${
                  isSessionActive
                    ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50'
                    : isDragOver
                    ? 'border-orange-400 bg-orange-50 cursor-copy'
                    : apkFile
                    ? 'border-emerald-300 bg-emerald-50/60 cursor-pointer'
                    : 'border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/30 cursor-pointer'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apk"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  disabled={isSessionActive}
                  className="hidden"
                />
                {apkFile ? (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <Smartphone size={22} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate">{apkFile.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatSize(apkFile.size)} · Android Package</div>
                      {uploadedApkInfo && (
                        <div className="text-xs text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                          <CheckCircle2 size={11} /> {uploadedApkInfo.appPackage}
                        </div>
                      )}
                    </div>
                    {!isSessionActive && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setApkFile(null); setUploadedApkInfo(null); }}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isDragOver ? 'bg-orange-200' : 'bg-orange-50'}`}>
                      <Upload size={20} className={isDragOver ? 'text-orange-600' : 'text-orange-400'} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700">
                        {isDragOver ? 'Drop your APK here' : 'Drag & drop APK or click to browse'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">Supports .apk files only</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Credentials + maxActions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Login Email <span className="text-slate-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="email" name="email" value={formData.email}
                  onChange={handleInputChange} disabled={isSessionActive}
                  placeholder="user@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Password <span className="text-slate-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="password" name="password" value={formData.password}
                  onChange={handleInputChange} disabled={isSessionActive}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Max Actions <span className="text-orange-500 font-black">{formData.maxActions}</span>
                </label>
                <input
                  type="range" name="maxActions" min="50" max="500" step="50"
                  value={formData.maxActions}
                  onChange={handleInputChange} disabled={isSessionActive}
                  className="w-full mt-2 accent-orange-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>50</span><span>500</span>
                </div>
              </div>
            </div>

            {/* Upload / starting progress banners */}
            {loadingState === 'uploading' && (
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping shrink-0" />
                <span className="text-sm font-bold text-orange-700 flex-1">Uploading APK to server…</span>
                <div className="w-28 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full shimmer-bar" />
                </div>
              </div>
            )}
            {loadingState === 'starting' && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                <Loader2 size={15} className="text-blue-500 animate-spin shrink-0" />
                <span className="text-sm font-bold text-blue-700">Initializing AI test agent…</span>
              </div>
            )}

            {/* Launch button */}
            <button
              type="submit"
              disabled={isSessionActive || isLoading || !apkFile}
              className={`w-full py-4 rounded-2xl text-white text-base font-bold tracking-wide flex items-center justify-center gap-2.5 transition-all duration-200 ${
                isSessionActive || isLoading
                  ? 'bg-slate-400 cursor-not-allowed shadow-none'
                  : !apkFile
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {isLoading
                ? <><Loader2 size={19} className="animate-spin" /><span>{loadingLabel}</span></>
                : <><Zap size={19} fill="currentColor" /><span>Launch Agent</span></>
              }
            </button>
          </form>
        </div>

        {/* 2. Pipeline + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

          <div className="md:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 text-center">Pipeline Status</h2>
            <div className="flex justify-between items-start px-4 relative max-w-[260px] mx-auto w-full">
              <div className="absolute top-[7px] left-8 right-8 h-[2px] bg-slate-100" />
              <div
                className="absolute top-[7px] left-8 h-[2px] transition-all duration-700"
                style={{ width: progressWidth, background: progressColor }}
              />
              {PHASE_ORDER.map((step) => {
                const status = getPhaseStatus(step);
                return (
                  <div key={step} className="flex flex-col items-center gap-2 relative z-10 bg-white px-2">
                    <div className={`w-[15px] h-[15px] rounded-full border-2 border-white shadow transition-all duration-300 ${phaseDotClass[status]}`} />
                    <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${phaseTextClass[status]}`}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-7 grid grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow">
              <LayoutDashboard size={15} className="text-slate-400 mb-0.5" />
              <span className="text-3xl font-black text-slate-800 tabular-nums">{stats.screens}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Screens</span>
            </div>
            <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 shadow-sm flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow">
              <CheckCircle2 size={15} className="text-emerald-500 mb-0.5" />
              <span className="text-3xl font-black text-emerald-700 tabular-nums">{stats.passed}</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Passed</span>
            </div>
            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 shadow-sm flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow">
              <XCircle size={15} className="text-rose-400 mb-0.5" />
              <span className="text-3xl font-black text-rose-700 tabular-nums">{stats.failed}</span>
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Failed</span>
            </div>
          </div>
        </div>

        {/* 3. Device Feed + Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[600px]">

          {/* Live device stream */}
          <div
            className={`lg:col-span-5 bg-[#0f172a] rounded-3xl relative overflow-hidden flex flex-col border-[6px] transition-all duration-300 ${
              screenshotFlash
                ? 'border-orange-400 shadow-[0_0_32px_rgba(249,115,22,.35)]'
                : 'border-slate-800 shadow-2xl'
            }`}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-[70px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-700/10 rounded-full blur-[70px] pointer-events-none" />

            <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-2.5 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/40 z-20">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected && isSessionActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Stream</span>
              </div>
              {screenshot && (
                <span className="text-[9px] text-slate-600 font-mono">{new Date().toLocaleTimeString()}</span>
              )}
            </div>

            <div className="flex-1 pt-9 pb-3 px-3 flex items-center justify-center">
              {screenshot ? (
                <img
                  src={screenshot}
                  alt="Live device feed"
                  className="max-h-full max-w-full object-contain rounded-2xl shadow-[0_0_40px_rgba(0,0,0,.7)]"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  {isSessionActive ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <Loader2 size={26} className="text-orange-400 animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-300">Waiting for device stream</p>
                        <p className="text-xs text-slate-600 mt-1">Screenshots will appear here</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                          <Smartphone size={26} className="text-slate-500" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-orange-400/60" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-500">No stream active</p>
                        <p className="text-xs text-slate-700 mt-1">Launch an agent to begin</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Logs + Assertions */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">

            <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 p-2 gap-2">
              {[
                { id: 'logs',    icon: <Terminal size={14} />,        label: 'Live Logs' },
                { id: 'results', icon: <ListChecks size={14} />,
                  label: assertions.length > 0 ? `Results (${assertions.length})` : phase === 'done' ? 'Report' : 'Results' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {tab.icon}{tab.label}
                  {phase === 'done' && assertions.length === 0 && tab.id === 'results' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 relative min-h-0">

              {/* LOGS tab */}
              <div className={`absolute inset-0 bg-[#0f172a] overflow-y-auto hide-scroll p-5 font-mono text-xs flex flex-col ${activeTab === 'logs' ? '' : 'hidden'}`}>
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-slate-600 gap-3">
                    <Terminal size={28} className="opacity-20" />
                    <p className="italic text-sm">System ready — awaiting session start…</p>
                  </div>
                ) : (
                  <div className="space-y-1 pb-3">
                    {logs.map((log, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 pl-3 py-1.5 pr-2 border-l-[3px] bg-slate-800/30 rounded-r leading-relaxed ${getLogStyle(log.text)}`}
                      >
                        <span className="text-slate-600 shrink-0 tabular-nums text-[10px] pt-px">{log.ts}</span>
                        <span className="break-words min-w-0">{log.text}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} className="h-1" />
                  </div>
                )}
              </div>

              {/* RESULTS tab — assertions list OR report ready card */}
              <div className={`absolute inset-0 bg-slate-50 overflow-y-auto hide-scroll flex flex-col ${activeTab === 'results' ? '' : 'hidden'}`}>

                {/* Report ready card — shown when done with no assertions, or always at top when done */}
                {phase === 'done' && assertions.length === 0 && (
                  <div className="p-5 flex flex-col items-center justify-center flex-1 gap-5">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <FileSpreadsheet size={30} className="text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-black text-slate-800 text-base">Report Ready</p>
                      <p className="text-xs text-slate-400 mt-1">All 3 phases completed — your Excel report is available</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                      <div className="bg-white rounded-2xl p-3 text-center border border-slate-200 shadow-sm">
                        <div className="text-xl font-black text-slate-800">{stats.screens}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Screens</div>
                      </div>
                      <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100 shadow-sm">
                        <div className="text-xl font-black text-emerald-700">{stats.passed}</div>
                        <div className="text-[9px] font-bold text-emerald-500 uppercase mt-0.5">Passed</div>
                      </div>
                      <div className="bg-rose-50 rounded-2xl p-3 text-center border border-rose-100 shadow-sm">
                        <div className="text-xl font-black text-rose-700">{stats.failed}</div>
                        <div className="text-[9px] font-bold text-rose-400 uppercase mt-0.5">Failed</div>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadReport}
                      disabled={isDownloading}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-70"
                    >
                      {isDownloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                      {isDownloading ? 'Downloading…' : 'Download Report (.xlsx)'}
                    </button>
                  </div>
                )}

                {/* Inline download banner when assertions exist and done */}
                {phase === 'done' && assertions.length > 0 && (
                  <div className="shrink-0 mx-3 mt-3 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <FileSpreadsheet size={14} /><span>Report ready</span>
                    </div>
                    <button
                      onClick={handleDownloadReport}
                      disabled={isDownloading}
                      className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-70"
                    >
                      {isDownloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                      {isDownloading ? 'Downloading…' : 'Download .xlsx'}
                    </button>
                  </div>
                )}

                {/* Assertions list */}
                {assertions.length > 0 ? (
                  <div className="space-y-2.5 p-5 pb-3">
                    {assertions.map((ass, i) => (
                      <div
                        key={i}
                        className={`bg-white p-4 rounded-xl border shadow-sm flex items-start gap-3 hover:shadow-md transition-shadow ${ass.passed ? 'border-emerald-100' : 'border-rose-100'}`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {ass.passed
                            ? <CheckCircle2 size={17} className="text-emerald-500" />
                            : <XCircle     size={17} className="text-rose-500"    />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">{ass.screenName}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${ass.passed ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                              {ass.passed ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 leading-snug break-words">{ass.elementText}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : phase !== 'done' && (
                  <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-3 p-5">
                    <Box size={28} className="opacity-40" />
                    <p className="font-semibold text-sm">No results yet</p>
                    <p className="text-xs text-slate-300 text-center">Test assertions appear here as the agent runs</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    </SubscriptionGuard>
  );
}