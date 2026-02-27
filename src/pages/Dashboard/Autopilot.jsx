import React, { useState, useRef, useEffect } from "react";
import {
  Monitor, Play, Square, RotateCcw, Globe, Loader2, 
  WifiOff, Activity, Brain, CheckCircle2, RefreshCw, Layers, Download
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_AI_TESTER_BACKEND_URL || "http://localhost:8000";

const AutoPilot = () => {
  const [targetUrl, setTargetUrl] = useState("");
  const [mode, setMode] = useState("checking"); 
  const [isRunning, setIsRunning] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [backendStatus, setBackendStatus] = useState("unknown");

  // Stream & Status State
  const [status, setStatus] = useState("System Ready");
  const [jobId, setJobId] = useState(null);
  const [liveImage, setLiveImage] = useState(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  
  // NEW: Report State
  const [reportData, setReportData] = useState({ base64: null, url: null, filename: null });

  const ws = useRef(null);

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      const data = await res.json();
      setBackendStatus(data.status);
    } catch (e) { setBackendStatus("offline"); }
  };

  // Logic to handle Base64 Download
  const downloadExcel = () => {
    if (reportData.base64) {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${reportData.base64}`;
      link.download = reportData.filename || "test_report.xlsx";
      link.click();
    } else if (reportData.url) {
      window.open(reportData.url, "_blank");
    }
  };

  const startAutopilot = async () => {
    if (!targetUrl) return alert("Please enter a Target URL");
    try {
      setIsRunning(true);
      setIsDisconnected(false);
      setReportData({ base64: null, url: null, filename: null }); // Reset report
      setStatus("Initializing Pipeline...");
      setLiveImage(null);

      const endpoint = mode === "checking" ? "/checking/start" : "/semantic/start";
      const payload = mode === "checking" ? { base_url: targetUrl } : { url: targetUrl };

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      const id = data.job_id || data.test_id;
      if (id) { setJobId(id); initWebSocket(id, mode); }
    } catch (error) {
      setStatus("Launch Failed");
      setIsRunning(false);
    }
  };

  const initWebSocket = (id, currentMode) => {
    const wsPrefix = BACKEND_URL.startsWith("https") ? "wss" : "ws";
    const wsPath = currentMode === "checking" ? `/ws/checking/${id}` : `/ws/semantic/${id}`;
    const wsUrl = `${BACKEND_URL.replace(/^https?/, wsPrefix)}${wsPath}`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "frame" && data.image) {
        setLiveImage(`data:image/jpeg;base64,${data.image}`);
        if (data.url) setCurrentUrl(data.url);
      }

      if (data.type === "status") {
        setStatus(data.message); 
      }

      if (data.type === "done") {
        setStatus(data.message || "Pipeline Completed!");
        setIsRunning(false);
        
        // NEW: Extract Excel Data from "done" message
        if (data.excel_base64 || data.download_url) {
          setReportData({
            base64: data.excel_base64,
            url: data.download_url,
            filename: data.excel_filename
          });
        }

        if (currentMode === "semantic") convertToOrchestrator(id);
      }

      if (data.completed_urls !== undefined || data.completed !== undefined) {
        setProgress({ 
          completed: data.completed_urls || data.completed || 0, 
          total: data.total_urls || data.total || 0 
        });
      }
    };

    ws.current.onclose = () => isRunning && handleDisconnect();
    ws.current.onerror = () => handleDisconnect();
  };

  const convertToOrchestrator = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/semantic/${id}/convert-to-orchestrator`, { method: "POST" });
      if(res.ok) setStatus("✅ Tests Live in Orchestrator");
    } catch (e) { setStatus("⚠️ Conversion Failed"); }
  };

  const stopAutopilot = async () => {
    if (ws.current) ws.current.close();
    try { await fetch(`${BACKEND_URL}/terminate`, { method: "POST" }); } catch (e) {}
    handleDisconnect();
  };

  const hardRestart = async () => {
    if (!window.confirm("Hard reset the master service?")) return;
    try { await fetch(`${BACKEND_URL}/terminate-and-restart`, { method: "POST" }); resetAll(); } catch (e) {}
  };

  const handleDisconnect = () => { setIsRunning(false); setIsDisconnected(true); setStatus("Disconnected"); };

  const resetAll = () => {
    if (ws.current) ws.current.close();
    setLiveImage(null);
    setStatus("System Ready");
    setTargetUrl("");
    setCurrentUrl("");
    setJobId(null);
    setIsRunning(false);
    setIsDisconnected(false);
    setProgress({ completed: 0, total: 0 });
    setReportData({ base64: null, url: null, filename: null });
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto font-sans text-slate-900">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Layers className="text-orange-500" />
            <span>MNR<span className="text-blue-900">AT</span></span>
            <span className="font-thin text-slate-400">| AUTOPILOT</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${backendStatus === "ok" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service: {backendStatus}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setMode("checking")} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${mode === 'checking' ? "bg-white shadow-sm text-blue-600" : "text-slate-400"}`}>
              <Activity size={14} /> DISCOVERY
            </button>
            <button onClick={() => setMode("semantic")} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${mode === 'semantic' ? "bg-white shadow-sm text-orange-600" : "text-slate-400"}`}>
              <Brain size={14} /> SEMANTIC
            </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="bg-slate-950 rounded-[3rem] p-4 shadow-2xl border border-slate-800 relative group">
        <div className="aspect-video rounded-[2.5rem] overflow-hidden bg-[#020408] flex items-center justify-center relative border border-white/5">
          {liveImage ? (
            <img src={liveImage} alt="Live Stream" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center space-y-6">
              {isRunning ? <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto opacity-20" /> : <Monitor className="w-24 h-24 text-slate-900 mx-auto" />}
            </div>
          )}
        </div>

        {isRunning && (
          <div className="absolute bottom-10 left-12 right-12 h-1 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-1000 ease-out ${mode === 'checking' ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${(progress.completed / (progress.total || 1)) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Command Center */}
      <div className="mt-8 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
        <div className="flex flex-col lg:flex-row gap-4">
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Enter target environment URL..."
            disabled={isRunning}
            className="flex-1 h-16 px-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-semibold outline-none"
          />
          <div className="flex gap-3">
            {!isRunning ? (
              <button onClick={startAutopilot} className="h-16 px-10 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] tracking-widest flex items-center gap-3">
                <Play size={16} fill="currentColor" /> INITIATE {mode.toUpperCase()}
              </button>
            ) : (
              <button onClick={stopAutopilot} className="h-16 px-10 bg-red-500 text-white rounded-[1.5rem] font-black text-[10px] tracking-widest flex items-center gap-3">
                <Square size={16} fill="currentColor" /> TERMINATE
              </button>
            )}
            <button onClick={resetAll} className="h-16 w-16 flex items-center justify-center bg-slate-100 text-slate-400 rounded-[1.5rem] hover:bg-slate-200 transition-all"><RotateCcw size={20} /></button>
            <button onClick={hardRestart} className="h-16 w-16 flex items-center justify-center bg-red-50 text-red-200 rounded-[1.5rem] hover:text-red-500 transition-all"><RefreshCw size={20} /></button>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRunning ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Live Engine Status</p>
              <p className="text-sm font-bold text-slate-800">{status}</p>
            </div>
          </div>
          
          {/* NEW: Download Report Button appears when file is ready */}
          {(reportData.base64 || reportData.url) && (
            <button 
              onClick={downloadExcel}
              className="mt-4 sm:mt-0 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-emerald-700 animate-bounce shadow-lg shadow-emerald-200"
            >
              <Download size={16} /> DOWNLOAD EXCEL REPORT
            </button>
          )}

          {isRunning && mode === 'checking' && (
             <div className="text-right mt-4 sm:mt-0">
                <p className="text-sm font-mono font-bold text-blue-600">{progress.completed} / {progress.total || '∞'} URLs</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoPilot;