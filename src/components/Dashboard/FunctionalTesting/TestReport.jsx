import React, { useState } from 'react';
import { CheckCircle2, XCircle, FileText, ShieldCheck, ChevronDown, ChevronUp, Cpu } from 'lucide-react';

export default function TestReport({ report }) {
  const [showLogs, setShowLogs] = useState(false);
  if (!report) return null;

  return (
    <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Status Header */}
      <div className={`px-6 py-5 border-b ${
        report.success ? "bg-emerald-950/20 border-emerald-900/30" : "bg-red-950/20 border-red-900/30"
      } flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-full ${report.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            {report.success ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
          </div>
          <div>
            <h2 className={`text-xl font-bold ${report.success ? "text-emerald-400" : "text-red-400"}`}>
              Test {report.success ? "Successful" : "Failed"}
            </h2>
            <p className="text-slate-400 text-sm">
              Completed {report.total_steps} steps
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
           <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Time</div>
           <div className="font-mono text-slate-200">00:42s</div> 
        </div>
      </div>

      <div className="p-6 space-y-8">
        
        {/* 1. Executive Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-950/50 rounded-lg p-5 border border-slate-800/50 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText size={16} /> AI Summary
              </h3>
              <p className="text-slate-300 leading-relaxed text-sm">
                {report.summary || "No summary provided for this test execution."}
              </p>
            </div>

            {/* 2. Assertions */}
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldCheck size={16} /> Assertions Verified
              </h3>
              <div className="space-y-3">
                {report.assertions && report.assertions.length > 0 ? (
                  report.assertions.map((assert, i) => (
                    <div key={i} className="flex gap-3 bg-slate-950/40 p-3.5 rounded-lg border border-slate-800/60 hover:border-emerald-500/30 transition-colors">
                      <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-300 text-sm font-medium">{assert}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic text-sm pl-2">No specific assertions were generated.</div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Stats Side Panel */}
          <div className="space-y-4">
             <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Cpu size={14} /> Execution Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-slate-900 pb-2">
                    <span className="text-slate-400">Total Steps</span>
                    <span className="text-white font-mono">{report.total_steps}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-900 pb-2">
                     <span className="text-slate-400">Domains</span>
                     <span className="text-white font-mono">{report.memory_stats?.total_domains || 0}</span>
                  </div>
                   <div className="flex justify-between items-center text-sm border-b border-slate-900 pb-2">
                     <span className="text-slate-400">Selectors</span>
                     <span className="text-white font-mono">{report.memory_stats?.total_selectors || 0}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* 4. Expandable Action Logs */}
        <div className="border-t border-slate-800 pt-6">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors text-sm font-medium focus:outline-none"
          >
            {showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showLogs ? "Hide Execution Logs" : "Show Full Execution Logs"}
          </button>
          
          {showLogs && (
            <div className="mt-4 bg-black rounded-lg p-4 font-mono text-xs text-slate-400 overflow-x-auto border border-slate-800 max-h-96 overflow-y-auto custom-scrollbar">
              <ul className="space-y-1.5">
                {(report.action_history || []).map((step, i) => (
                  <li key={i} className="flex gap-3 hover:bg-slate-900/50 p-1 rounded">
                    <span className="text-slate-600 select-none w-6 text-right">{(i + 1)}</span>
                    <span className="text-green-400/80">➜</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}