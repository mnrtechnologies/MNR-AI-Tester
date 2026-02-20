import React, { useState } from 'react';
import { Play, Globe, Target } from 'lucide-react';

export default function ConfigForm({ onStart, isLoading }) {
  const [mode, setMode] = useState("whitebox");
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url || !goal) return alert("URL and Goal are required");
    onStart({ mode, url, goal });
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 animate-fade-in">
      <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
        <div className="bg-slate-800/50 px-8 py-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">New Test Session</h2>
          <p className="text-slate-400 text-sm mt-1">Configure your AI agent's mission parameters.</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Testing Strategy
              </label>
              <select 
                value={mode} 
                onChange={(e) => setMode(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 px-4 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none"
              >
                <option value="whitebox">Whitebox (DOM Injection)</option>
                <option value="blackbox">Blackbox (Visual Analysis)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Globe size={14} /> Target URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.example.com"
                className="w-full bg-slate-950 text-slate-200 px-4 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Target size={14} /> Mission Objective
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Navigate to the contact page, fill out the form, and verify the success message..."
              rows={3}
              className="w-full bg-slate-950 text-slate-200 px-4 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none placeholder:text-slate-600"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="animate-pulse">Initializing Neural Engine...</span>
            ) : (
              <>
                <Play size={18} fill="currentColor" /> Launch Autonomous Agent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}