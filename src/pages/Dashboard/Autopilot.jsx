import React, { useState, useRef } from "react";
import {
  Monitor,
  Play,
  Square,
  RotateCcw,
  Globe,
  Loader2,
  WifiOff
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_AI_TESTER_BACKEND_URL;

const AutoPilot = () => {
  const [targetUrl, setTargetUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  
  // Stream & Status State
  const [status, setStatus] = useState("Idle");
  const [jobId, setJobId] = useState(null);
  const [liveImage, setLiveImage] = useState(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const ws = useRef(null);

  const startAutopilot = async () => {
    if (!targetUrl) return alert("Please enter a Target URL");

    try {
      setIsRunning(true);
      setIsDisconnected(false);
      setStatus("Initializing...");
      setLiveImage(null);

      const response = await fetch(`${BACKEND_URL}/checking/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: targetUrl }),
      });

      const data = await response.json();
      if (data.job_id) {
        setJobId(data.job_id);
        initWebSocket(data.job_id);
      }
    } catch (error) {
      console.error("Start failed:", error);
      setStatus("Failed to start");
      setIsRunning(false);
    }
  };

  const stopAutopilot = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    handleDisconnect();
  };

  const handleDisconnect = () => {
    setIsRunning(false);
    setIsDisconnected(true);
    setStatus("Disconnected");
    setLiveImage(null); // Stop displaying the last image frame
  };

  const initWebSocket = (id) => {
    const wsUrl = `${BACKEND_URL.replace("https", "wss")}/ws/checking/${id}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "frame" && data.image) {
        setLiveImage(`data:image/png;base64,${data.image}`);
        setStatus("Running");
      }

      if (data.current_url) setCurrentUrl(data.current_url);
      if (data.completed !== undefined) {
        setProgress({ completed: data.completed, total: data.total || 0 });
      }
    };

    ws.current.onclose = () => {
      handleDisconnect();
    };

    ws.current.onerror = () => {
      handleDisconnect();
    };
  };

  const resetAll = () => {
    if (ws.current) ws.current.close();
    setLiveImage(null);
    setStatus("Idle");
    setTargetUrl("");
    setCurrentUrl("");
    setJobId(null);
    setIsRunning(false);
    setIsDisconnected(false);
    setProgress({ completed: 0, total: 0 });
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      {/* Minimal Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            <span className="text-blue-900">MNR</span>
            <span className="text-orange-500">AT</span> Auto Pilot
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Autonomous Web Testing</p>
        </div>
        
        <div className="flex items-center gap-6">
            <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Status</p>
                <p className={`text-xs font-bold ${isRunning ? "text-teal-500" : isDisconnected ? "text-red-500" : "text-slate-600"}`}>
                    {status}
                </p>
            </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Viewport */}
        <div className="bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative">
          
          {/* URL Bar Overlay */}
          <div className="absolute top-4 left-4 right-4 z-20 flex justify-center">
            <div className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5 flex items-center gap-3 max-w-[80%]">
              <Globe size={14} className={isRunning ? "text-teal-400 animate-pulse" : "text-slate-500"} />
              <span className="text-xs text-slate-200 truncate font-medium">
                {currentUrl || "System Standby..."}
              </span>
            </div>
          </div>

          {/* Browser Container */}
          <div className="aspect-video flex items-center justify-center bg-[#05080f] relative">
            {liveImage ? (
              <img src={liveImage} alt="Browser Stream" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center z-10">
                {isRunning ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin opacity-40" />
                    <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">Launching Virtual Browser</p>
                  </div>
                ) : isDisconnected ? (
                  <div className="flex flex-col items-center gap-2 text-red-500">
                    <WifiOff size={48} className="opacity-40 mb-2" />
                    <p className="text-sm font-bold tracking-tighter">DISCONNECTED</p>
                    <p className="text-[10px] text-slate-500 uppercase">Stream terminated by engine</p>
                  </div>
                ) : (
                  <Monitor className="w-16 h-16 text-slate-900 mx-auto" />
                )}
              </div>
            )}

            {/* Disconnected Overlay for when a test was previously running */}
            {isDisconnected && (
                <div className="absolute inset-0 bg-red-950/10 backdrop-grayscale pointer-events-none" />
            )}
          </div>

          {/* Progress Indicator */}
          {isRunning && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
              <div 
                className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-700" 
                style={{ width: `${(progress.completed / (progress.total || 1)) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="Enter URL to test (e.g. https://staging.isalaam.me)"
                disabled={isRunning}
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-400 transition-all disabled:opacity-50"
              />
            </div>
            
            <div className="flex gap-2">
              {!isRunning ? (
                <button 
                  onClick={startAutopilot}
                  className="h-12 px-8 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-black transition-all"
                >
                  <Play size={14} fill="currentColor" /> START
                </button>
              ) : (
                <button 
                  onClick={stopAutopilot}
                  className="h-12 px-8 bg-red-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-red-600 transition-all"
                >
                  <Square size={14} fill="currentColor" /> STOP
                </button>
              )}
              
              <button 
                onClick={resetAll}
                className="h-12 w-12 flex items-center justify-center bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center px-1">
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Tested: <span className="text-slate-800">{progress.completed}</span> / {progress.total || '--'}
                </span>
             </div>
             {isRunning && (
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-teal-500 uppercase animate-pulse tracking-widest">Active Execution</span>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoPilot;