import { useEffect, useState } from "react";
import { Eye, Monitor } from 'lucide-react';

export default function BrowserStream({ testId }) {
  const [image, setImage] = useState(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!testId) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/tests/${testId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "frame") {
        setImage(`data:image/png;base64,${data.image}`);
        setStep(data.step);
      }
    };
    
    return () => ws.close();
  }, [testId]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live View</span>
        </div>
        <span className="bg-indigo-900/30 text-indigo-400 border border-indigo-500/20 text-xs px-2 py-0.5 rounded-md font-mono">
           Step: {step}
        </span>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 relative overflow-y-auto bg-black custom-scrollbar">
        {image ? (
          <img 
            src={image} 
            alt="Live Browser" 
            className="w-full h-auto block" 
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
              <Eye className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-700" size={24} />
            </div>
            <p className="text-sm font-medium animate-pulse">Connecting to browser stream...</p>
          </div>
        )}
      </div>
    </div>
  );
}