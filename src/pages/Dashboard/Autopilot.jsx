import React, { useState } from 'react';
import { 
  Rocket, 
  BarChart3, 
  MousePointer2, 
  Bug, 
  Globe, 
  Wrench, 
  Play, 
  RotateCcw 
} from 'lucide-react';

const AutoPilot = () => {
  //~~ Static state for sliders and toggles
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(10);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">MNR AT Auto Pilot</h1>
        <p className="text-sm text-slate-500">AI-Powered Autonomous Web Testing Platform</p>
        <div className="h-px w-full bg-slate-100 mt-4 border-b border-dashed border-slate-200"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: -- Dashboard Stats */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <Globe size={18} className="text-slate-800" />
            <h2 className="font-bold text-slate-800">Dashboard</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Test Status */}
            <StatCard 
              icon={<Rocket className="text-blue-500" />} 
              title="Test Status" 
              status="Idle" 
              subtext="Connection: Disconnected" 
              showProgress 
            />
            {/* Test Results */}
            <StatCard 
              icon={<BarChart3 className="text-teal-500" />} 
              title="Test Results" 
              metrics={[{label: 'Total', val: 0}, {label: 'Passed', val: 0}, {label: 'Failed', val: 0}, {label: 'Visual', val: 0}]}
            />
            {/* Element Discovery */}
            <StatCard 
              icon={<MousePointer2 className="text-orange-500" />} 
              title="Element Discovery" 
              metrics={[{label: 'Found', val: 0}, {label: 'Interactive', val: 0}, {label: 'Inputs', val: 0}, {label: 'Buttons', val: 0}]}
            />
            {/* Web Crawler */}
            <StatCard 
              icon={<Bug className="text-red-500" />} 
              title="Web Crawler" 
              centerMetric={{val: 0, label: 'Pages Crawled'}}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Full Autopilot Configuration */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <Wrench size={18} className="text-slate-800" />
            <h2 className="font-bold text-slate-800">Full Autopilot</h2>
          </div>

          <div className="space-y-6">
            {/* Target URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Target URL</label>
              <input 
                type="text" 
                placeholder="Enter website URL" 
                className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
            </div>

            {/* Crawl Depth Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label className="font-medium text-slate-700">Crawl Depth: {crawlDepth}</label>
              </div>
              <input 
                type="range" min="1" max="10" 
                value={crawlDepth} 
                onChange={(e) => setCrawlDepth(e.target.value)}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <p className="text-[10px] text-slate-400">How deep should the crawler navigate (1-10)</p>
            </div>

            {/* Max Pages Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label className="font-medium text-slate-700">Maximum Pages: {maxPages}</label>
              </div>
              <input 
                type="range" min="5" max="100" 
                value={maxPages} 
                onChange={(e) => setMaxPages(e.target.value)}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-[10px] text-slate-400">Maximum number of pages to crawl and test (5-100)</p>
            </div>

            {/* Toggles */}
            <div className="space-y-4 pt-4">
              <ToggleSwitch label="Generate Test Cases" sub="Automatically Generate test cases using AI" defaultChecked />
              <ToggleSwitch label="Execute Tests" sub="Automatically Execute generated test cases" defaultChecked />
              <ToggleSwitch label="Self-Healing" sub="Enable AI Powered self-healing for test automation" defaultChecked />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6">
              <button className="bg-[#00c2a8] hover:bg-[#00ad96] text-white px-6 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-teal-500/20">
                <Play size={14} fill="currentColor" /> Start Full Autopilot
              </button>
              <button className="bg-red-400 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all">
                <RotateCcw size={14} /> Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Execution---> */}
      {/* <div className="pt-8">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          🚀 Live Test Execution
        </h3>
        <div className="h-0.5 w-full bg-slate-100"></div>
      </div> */}
    </div>
  );
};

// Reusable Stat Card Component
const StatCard = ({ icon, title, status, subtext, showProgress, metrics, centerMetric }) => (
  <div className="p-5 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      <span className="text-sm font-bold text-slate-700 tracking-tight">{title}</span>
    </div>
    
    {status && (
      <div className="space-y-3">
        {showProgress && <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-200 w-1/3"></div></div>}
        <p className="text-xs font-bold text-green-500">{status}</p>
        <p className="text-[10px] text-slate-400">{subtext}</p>
      </div>
    )}

    {metrics && (
      <div className="grid grid-cols-4 gap-2 text-center">
        {metrics.map((m, i) => (
          <div key={i}>
            <p className={`text-lg font-bold ${m.val > 0 ? 'text-teal-500' : 'text-blue-400'}`}>{m.val}</p>
            <p className="text-[10px] text-slate-400">{m.label}</p>
          </div>
        ))}
      </div>
    )}

    {centerMetric && (
      <div className="text-center py-2">
        <p className="text-2xl font-bold text-blue-500">{centerMetric.val}</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{centerMetric.label}</p>
      </div>
    )}
  </div>
);

// Reusable Toggle Component
const ToggleSwitch = ({ label, sub, defaultChecked }) => (
  <div className="flex items-start gap-3">
    <label className="relative inline-flex items-center cursor-pointer mt-1">
      <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400"></div>
    </label>
    <div>
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  </div>
);

export default AutoPilot;