import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, Terminal, CheckCircle2, XCircle, Play, Activity, 
  Loader2, Box, LayoutDashboard, ListChecks, StopCircle, Download
} from 'lucide-react';

const API_URL = process.env.REACT_APP_AI_MOBILE_TESTER_BACKEND_URL;
const WS_URL = process.env.REACT_APP_AI_MOBILE_TESTER_BACKEND_WS_URL;

export default function MobileTestingDashboard() {
  const [activeTab, setActiveTab] = useState('logs');
  
  const [formData, setFormData] = useState({
    email: '', password: '', maxActions: 200,
  });
  const [apkFile, setApkFile] = useState(null);

  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [backendStatus, setBackendStatus] = useState(''); // New state for API status
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ screens: 0, passed: 0, failed: 0 });
  const [assertions, setAssertions] = useState([]);

  const wsRef = useRef(null);
  const logsEndRef = useRef(null);

  // Scroll logs to bottom
  useEffect(() => {
    if (activeTab === 'logs') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeTab]);

  // WebSocket Integration
  useEffect(() => {
    if (!sessionId) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ action: 'SUBSCRIBE', sessionId }));
    ws.onmessage = (msg) => {
      const { event, payload } = JSON.parse(msg.data);
      switch (event) {
        case 'SCREENSHOT_FRAME': setScreenshot(`data:image/jpeg;base64,${payload.base64}`); break;
        case 'PHASE_STARTED': setPhase(payload.phase); addLog(`▶ ${payload.phase} — ${payload.description}`); break;
        case 'PHASE_COMPLETED': addLog(`✓ ${payload.summary}`); break;
        case 'NEW_SCREEN_DISCOVERED': setStats(s => ({ ...s, screens: s.screens + 1 })); addLog(`📱 ${payload.screenTitle} (${payload.elementCount} elements)`); break;
        case 'ASSERTION_RESULT': setAssertions(a => [...a, payload]); setStats(s => ({ ...s, passed: payload.passed ? s.passed + 1 : s.passed, failed: !payload.passed ? s.failed + 1 : s.failed })); addLog(`${payload.passed ? '✅' : '❌'} ${payload.elementText}`); break;
        case 'SESSION_COMPLETED': setPhase('done'); setIsLoading(false); addLog('🎉 Done! Report saved.'); break;
        case 'SESSION_FAILED': setPhase('failed'); setIsLoading(false); addLog(`💥 ${payload.error}`); break;
        default: break;
      }
    };
    return () => ws.close();
  }, [sessionId]);

  // NEW: Status Polling API
  useEffect(() => {
    if (!sessionId || phase === 'done' || phase === 'failed') return;
    
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sessions/${sessionId}`);
        const result = await response.json();
        
        if (result.success) {
          const data = result.data;
          setBackendStatus(data.status);
          
          // Optionally sync stats if WS drops
          setStats(prev => ({
            screens: Math.max(prev.screens, data.totalScreens || 0),
            passed: Math.max(prev.passed, data.passedChecks || 0),
            failed: Math.max(prev.failed, data.failedChecks || 0)
          }));
        }
      } catch (err) {
        console.error("Failed to fetch session status", err);
      }
    };

    const intervalId = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    fetchStatus(); // Initial fetch
    
    return () => clearInterval(intervalId);
  }, [sessionId, phase]);

  const addLog = (message) => setLogs((prev) => [...prev, message]);
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) setApkFile(e.target.files[0]);
  };

  const startSession = async (e) => {
    e.preventDefault();
    if (!apkFile) {
        addLog("💥 Please select an APK file.");
        return;
    }

    setIsLoading(true); setLogs([]); setAssertions([]); setBackendStatus('');
    setStats({ screens: 0, passed: 0, failed: 0 }); setScreenshot(null); setPhase('starting'); setActiveTab('logs');

    try {
      const payload = new FormData();
      payload.append('apkPath', apkFile);
      payload.append('maxActions', formData.maxActions);

      if (formData.email || formData.password) {
        payload.append('credentials', JSON.stringify({
          email: formData.email,
          password: formData.password
        }));
      }

      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST', 
        body: payload,
      });

      const result = await response.json();
      if (result.success) setSessionId(result.data.sessionId || result.data.id);
      else { addLog(`💥 Error starting session`); setIsLoading(false); setPhase('failed'); }
    } catch (err) { addLog(`💥 Network error: ${err.message}`); setIsLoading(false); setPhase('failed'); }
  };

  // NEW: Stop Session API
  const handleStopSession = async () => {
    if (!sessionId) return;
    try {
      addLog("▶ Sending stop signal to agent...");
      // Using /stop endpoint. If your backend uses exact POST /api/sessions/{id}, remove the /stop
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/stop`, { method: 'POST' });
      const result = await response.json();
      
      if (!result.success) {
        addLog(`💥 Stop error: ${result.error}`);
      } else {
        addLog("🛑 Agent stopped by user.");
        setPhase('failed'); // Force UI into stopped state
        setIsLoading(false);
      }
    } catch (err) {
      addLog(`💥 Failed to stop: ${err.message}`);
    }
  };

  // NEW: Download Report API
  const handleDownloadReport = async () => {
    if (!sessionId) return;
    try {
      addLog("▶ Requesting report download...");
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/report`);
      
      if (!response.ok) {
         // Attempt to parse JSON error if it failed
         const result = await response.json().catch(() => ({}));
         addLog(`💥 Download failed: ${result.error || 'Report not found'}`);
         return;
      }

      // Convert response to blob and trigger download natively
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${sessionId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addLog("✓ Report downloaded successfully.");

    } catch (err) {
      addLog(`💥 Network error during download: ${err.message}`);
    }
  };

  const getLogColorClass = (text) => {
    if (text.includes('✅') || text.includes('passed')) return 'border-emerald-500 text-emerald-100';
    if (text.includes('❌') || text.includes('failed') || text.includes('💥') || text.includes('🛑')) return 'border-rose-500 text-rose-100';
    if (text.includes('▶') || text.includes('✓')) return 'border-orange-500 text-orange-100';
    return 'border-slate-600 text-slate-300';
  };

  const getPhaseDotClass = (targetPhase) => {
    if (phase === 'idle' && targetPhase === 'Validation') return 'bg-slate-300';
    if (phase === 'failed') return 'bg-rose-500';
    if (phase === 'done' || phase === 'Testing' || (phase === 'Exploration' && targetPhase === 'Validation')) return 'bg-emerald-500';
    if (phase === targetPhase || (phase === 'starting' && targetPhase === 'Validation')) return 'bg-orange-500 animate-pulse';
    return 'bg-slate-300';
  };

  const isSessionActive = sessionId && phase !== 'done' && phase !== 'failed';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-6 px-4">
        
        {/* --- 1. AGENT CONTROL PANEL (TOP) --- */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-500/20">
                <Activity size={14} /><span>Agent Control Panel</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                New <span className="text-orange-500">Test Run</span>
              </h1>
              <p className="text-slate-500 mt-2">Configure and launch the autonomous testing agent.</p>
            </div>
            
            {/* NEW: Action Buttons (Status Pill, Stop, Download) */}
            <div className="flex flex-col items-end gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${sessionId ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                <div className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                {sessionId ? (backendStatus || 'Connection Active') : 'Agent Offline'}
              </div>
              
              {isSessionActive && (
                <button onClick={handleStopSession} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-white border border-rose-200 text-rose-600 px-4 py-2 rounded-full shadow-sm hover:bg-rose-50 transition-colors">
                  <StopCircle size={14} /> Stop Agent
                </button>
              )}

              {phase === 'done' && (
                <button onClick={handleDownloadReport} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-emerald-500 border border-emerald-600 text-white px-4 py-2 rounded-full shadow-md hover:bg-emerald-600 transition-colors">
                  <Download size={14} /> Download Report
                </button>
              )}
            </div>
          </div>

          <form onSubmit={startSession} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">APK File</label>
                <input 
                  required 
                  type="file" 
                  accept=".apk"
                  onChange={handleFileChange} 
                  disabled={isSessionActive}
                  className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all
                             file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Login Email (Optional)</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={isSessionActive} className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Login Password (Optional)</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} disabled={isSessionActive} className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" placeholder="••••••••" />
              </div>
            </div>
            
            <button type="submit" disabled={isSessionActive || isLoading} className={`w-full py-4 rounded-xl text-white text-base font-bold tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg ${isSessionActive || isLoading ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20 hover:shadow-orange-500/40'}`}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {isSessionActive ? 'Agent is Running...' : isLoading ? 'Initializing Agent...' : 'Launch Agent'}
            </button>
          </form>
        </div>

        {/* --- 2. PIPELINE & STATS (MIDDLE) --- */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Pipeline Tracker */}
          <div className="md:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">Pipeline Status</h2>
            <div className="flex justify-between items-center px-4 relative max-w-xs mx-auto w-full">
              <div className="absolute top-2 left-8 right-8 h-[2px] bg-slate-200 -z-0"></div>
              {['Validation', 'Exploration', 'Testing'].map((step, i) => (
                <div key={step} className="flex flex-col items-center gap-2 relative z-10 bg-white px-2">
                  <div className={`w-4 h-4 rounded-full shadow-sm border-2 border-white ${getPhaseDotClass(step)}`}></div>
                  <span className="text-[10px] font-bold uppercase text-slate-600">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="md:col-span-7 grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1"><LayoutDashboard size={14}/> Screens</span>
              <span className="text-3xl font-black text-slate-800">{stats.screens}</span>
            </div>
            <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 shadow-sm flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-emerald-600 uppercase mb-1">Passed</span>
              <span className="text-3xl font-black text-emerald-700">{stats.passed}</span>
            </div>
            <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 shadow-sm flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-rose-600 uppercase mb-1">Failed</span>
              <span className="text-3xl font-black text-rose-700">{stats.failed}</span>
            </div>
          </div>
        </div>

        {/* --- 3. DEVICE FEED & LOGS (BOTTOM) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[650px]">
          
          {/* LEFT: Live Device Stream */}
          <div className="lg:col-span-5 bg-[#1e293b] rounded-3xl relative overflow-hidden flex flex-col items-center justify-center border-[8px] border-slate-800 shadow-2xl p-4">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/10 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-slate-400/5 rounded-full blur-[80px] pointer-events-none"></div>
            
            {screenshot ? (
              <img 
                src={screenshot} 
                alt="Live Device" 
                className="relative z-10 max-h-full max-w-full object-contain rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-black" 
              />
            ) : (
              <div className="relative h-full w-full max-w-[260px] z-10 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-3xl border-4 border-slate-600 flex flex-col justify-between p-5 overflow-hidden">
                  <div className="w-1/3 h-1.5 bg-slate-600 mx-auto rounded-full opacity-50 mb-6"></div>
                  <div className="flex-1 flex flex-col space-y-4">
                    <div className="w-full h-12 bg-slate-600/20 rounded-xl animate-pulse"></div>
                    <div className="w-3/4 h-4 bg-slate-600/20 rounded-lg animate-pulse"></div>
                    <div className="w-5/6 h-4 bg-slate-600/20 rounded-lg animate-pulse delay-75"></div>
                  </div>
                  <div className="text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-6">Awaiting Stream</div>
                </div>
                <div className="absolute -bottom-4 -right-4 bg-orange-500 text-white p-4 rounded-2xl shadow-xl rotate-12">
                  <Smartphone size={28} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Logs & Assertions Tabs */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
            
            {/* Tab Headers */}
            <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 p-2 gap-2">
              {[
                { id: 'logs', icon: <Terminal size={16} />, label: 'Live Agent Logs' },
                { id: 'assertions', icon: <ListChecks size={16} />, label: `Test Assertions (${assertions.length})` },
              ].map((tab) => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:bg-slate-200/40 hover:text-slate-700'}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content Areas */}
            <div className="flex-1 relative min-h-0">
              
              {/* LOGS */}
              <div className={`absolute inset-0 bg-[#0f172a] overflow-y-auto hide-scroll p-6 font-mono text-xs ${activeTab === 'logs' ? 'block' : 'hidden'}`}>
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-3">
                    <Terminal size={32} className="opacity-20"/>
                    <p className="italic text-sm">System initialized. Awaiting session start...</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pb-4">
                    {logs.map((log, index) => (
                      <div key={index} className={`pl-3 py-2 pr-3 border-l-[3px] ${getLogColorClass(log)} bg-slate-800/40 rounded-r shadow-sm break-words leading-relaxed`}>
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} className="h-2" />
                  </div>
                )}
              </div>

              {/* ASSERTIONS */}
              <div className={`absolute inset-0 bg-slate-50 overflow-y-auto hide-scroll p-6 ${activeTab === 'assertions' ? 'block' : 'hidden'}`}>
                {assertions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                    <Box size={32} className="opacity-40"/>
                    <p className="font-medium text-sm">Waiting for test cases to execute...</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-4">
                    {assertions.map((ass, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3 hover:shadow-md transition-shadow">
                        <div className="mt-0.5 shrink-0">{ass.passed ? <CheckCircle2 size={18} className="text-emerald-500"/> : <XCircle size={18} className="text-rose-500"/>}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded truncate">{ass.screenName}</span>
                            {!ass.passed && <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Failed</span>}
                          </div>
                          <div className="text-sm font-semibold text-slate-800 leading-snug break-words">{ass.elementText}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}