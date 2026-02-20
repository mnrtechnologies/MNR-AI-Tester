import React from "react";
import ConfigForm from "../../../components/Dashboard/FunctionalTesting/ConfigForm.jsx";
import BrowserStream from "../../../components/Dashboard/FunctionalTesting/BrowserStream";
import ChatPanel from "../../../components/Dashboard/FunctionalTesting/ChatPanel";
import TestReport from "../../../components/Dashboard/FunctionalTesting/TestReport";
import { useTestManager } from "../../../hooks/useTestManager.js";
import { Terminal, Loader2 } from 'lucide-react';

function App() {
  const { testId, status, lastAction, report, error, startTest } = useTestManager();

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200">

      <main className="container mx-auto px-4 py-8 max-w-[1600px]"> {/* Increased max-width */}
        
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 text-red-200 border border-red-900/50 rounded-xl flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
             <span>{error}</span>
          </div>
        )}

        {!testId && <ConfigForm onStart={startTest} isLoading={status === "initializing"} />}

        {testId && (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Action Bar */}
            <div className="bg-slate-900 px-6 py-4 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    {status === 'running' ? (
                      <Loader2 size={18} className="text-indigo-400 animate-spin" />
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${status === 'completed' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                    )}
                    <span className="font-bold text-white capitalize tracking-wide">{status}</span>
                 </div>
                 <div className="h-4 w-px bg-slate-700 mx-2"></div>
                 <span className="font-mono text-xs text-slate-500">ID: {testId.split('-')[0]}</span>
              </div>

              <div className="flex-1 md:text-right overflow-hidden">
                 <p className="text-sm text-indigo-200 truncate flex items-center justify-end gap-2">
                   <Terminal size={14} className="text-indigo-500" />
                   {lastAction || "Agent Initializing..."}
                 </p>
              </div>
            </div>

            {/* Main Workspace - Adjusted Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[75vh]">
              {/* Browser - Takes 8 cols */}
              <div className="lg:col-span-8 h-full min-h-0">
                <BrowserStream testId={testId} />
              </div>
              
              {/* Chat - Takes 4 cols */}
              <div className="lg:col-span-4 h-full min-h-0">
                <ChatPanel testId={testId} status={status} />
              </div>
            </div>

            {/* Full Report - Appears below workspace when done */}
            {status === "completed" && report && (
              <TestReport report={report} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;