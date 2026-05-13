import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import {
  LayoutDashboard,
  Link as LinkIcon,
  Cpu,
  Lightbulb,
  MessageSquare,
  Plus,
  Server,
  Send,
  Loader2,
  Copy,
  ChevronDown,
  Settings,
  XCircle,
  CheckCircle2,
  Info,
  Activity,
  RefreshCw
} from "lucide-react";

// Global API configuration from environment variables
const API = process.env.REACT_APP_AI_REGRESSION_TESTER_BACKEND_URL;

// ==========================================
// ── UTILITIES ──
// ==========================================

const formatMarkdown = (text) => {
  if (!text) return "";
  return text
    // Basic sanitize
    .replace(/</g, "&lt;").replace(/>/g, "&gt;") 
    // Headers
    .replace(/^###\s+(.*$)/gim, '<h3 class="text-lg font-black mt-6 mb-3 text-slate-800 border-b border-slate-100 pb-2">$1</h3>')
    .replace(/^####\s+(.*$)/gim, '<h4 class="text-base font-bold mt-5 mb-2 text-slate-800">$1</h4>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
    // Code blocks/Inline code
    .replace(/`(.*?)`/g, '<code class="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-orange-100">$1</code>')
    // Numbered List
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<div class="mt-4 mb-2 font-bold text-slate-800 flex gap-2"><span class="text-orange-500">•</span> <span>$1</span></div>')
    // Bullet List (using dashes)
    .replace(/^\s*-\s+(.*$)/gim, '<div class="ml-4 mt-1.5 flex gap-2 items-start"><span class="text-slate-400 mt-0.5">-</span><span class="text-slate-600">$1</span></div>')
    // Line breaks
    .replace(/\n/g, '<br/>')
    // Clean up excessive line breaks around block elements
    .replace(/(<br\/>){2,}/g, '<br/><br/>')
    .replace(/(<\/h3>|<\/h4>|<\/div>)<br\/>/g, '$1')
    .replace(/<br\/>(<h3|<h4|<div)/g, '$1');
};


// ==========================================
// ── TAB COMPONENTS (UI Extraction) ──
// ==========================================

const ProjectsTab = ({ showCreate, setShowCreate, projectForm, setProjectForm, handleCreateProject, projects, activeProject, setActiveProject, addToast }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
    <div className="flex justify-between items-center">
      <h3 className="text-2xl font-bold text-slate-800">Your Projects</h3>
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-sm active:scale-95"
      >
        <Plus size={18} /> New Project
      </button>
    </div>

    {showCreate && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Server className="text-orange-500" size={20} />
            Create New Project
          </h3>
        </div>
        <form onSubmit={handleCreateProject} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Project ID <span className="text-red-500">*</span></label>
              <input required value={projectForm.project_id} onChange={(e) => setProjectForm({ ...projectForm, project_id: e.target.value })} placeholder="e.g. shop-api-load-test" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"/>
              <p className="text-xs text-slate-400 mt-1">Unique slug — no spaces</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Project Name <span className="text-red-500">*</span></label>
              <input required value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="e.g. Shop API Load Test" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"/>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Description</label>
              <input value={projectForm.desc} onChange={(e) => setProjectForm({ ...projectForm, desc: e.target.value })} placeholder="Short description of the test scenario" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"/>
            </div>
          </div>
          <div className="flex gap-4 pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-sm active:scale-95">Create Project</button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm active:scale-95">Cancel</button>
          </div>
        </form>
      </div>
    )}
    
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {projects.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <LayoutDashboard className="text-slate-300 w-8 h-8" />
          </div>
          <p className="text-slate-500 font-medium">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Project ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.project_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded font-mono text-xs">
                      {p.project_id}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{p.name}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">{p.description || "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { setActiveProject(p); addToast(`Switched to: ${p.name}`, 'success'); }}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors border ${activeProject?.project_id === p.project_id ? 'bg-orange-500 text-white border-orange-600' : 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200'}`}
                    >
                      {activeProject?.project_id === p.project_id ? 'Active' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);

const ConnectToolsTab = ({ activeProject, ingestTab, setIngestTab, snippets, copyToClipboard }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-wrap items-center gap-4">
        <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Context:</span>
        {activeProject ? (
          <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-mono font-bold">
            {activeProject.project_id}
          </span>
        ) : (
          <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-sm font-bold">
            No project selected
          </span>
        )}
        <span className="text-xs text-slate-400 ml-auto">Code snippets map to your selected project dynamically.</span>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-max border border-slate-200">
          {["jmeter", "k6", "prometheus"].map((tab) => (
          <button key={tab} onClick={() => setIngestTab(tab)} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all capitalize ${ ingestTab === tab ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-800" }`}>{tab}</button>
          ))}
      </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Integration Snippet</h3>
              <button onClick={() => copyToClipboard(snippets[ingestTab])} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-orange-600 hover:border-orange-300 transition-colors">
                  <Copy size={14} /> Copy Code
              </button>
          </div>
          <div className="p-6 bg-slate-900 text-slate-300 font-mono text-sm overflow-x-auto leading-relaxed">
              <pre>{snippets[ingestTab]}</pre>
          </div>
      </div>
  </div>
);

const MLPipelineTab = ({ activeProject, handleRunPipeline, isRunningPipeline, pipelineResult }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 pt-4 flex justify-center">
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col justify-center items-center text-center max-w-xl w-full">
      <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-4">
        <Cpu size={32} />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">Analysis Pipeline</h3>
      <p className="text-slate-500 mb-6 max-w-sm">
        Run the automated ML pipeline to detect anomalies and performance degradations.
      </p>
      
      <button 
        onClick={handleRunPipeline}
        disabled={!activeProject || isRunningPipeline}
        className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 disabled:text-orange-50 disabled:cursor-not-allowed active:scale-95"
      >
        {isRunningPipeline ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
        {isRunningPipeline ? "Running Pipeline..." : "Run ML Pipeline"}
      </button>

      {/* RENDER ALL CONCATENATED RESPONSES RETURNED BY THE API */}
      {pipelineResult && pipelineResult.length > 0 && (
        <div className="mt-8 w-full animate-in fade-in border-t border-slate-100 pt-6 text-left flex flex-col gap-4">
          {pipelineResult.map((resItem, idx) => (
            <div key={idx} className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col gap-3 relative overflow-hidden">
              {/* Colored left edge based on status */}
              <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${resItem.status === 'pipeline_completed' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
              
              <p className="text-sm text-slate-600">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-xs">Status:</span>
                <br />
                <span className={`font-semibold capitalize ${resItem.status === 'pipeline_completed' ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {resItem.status?.replace('_', ' ')}
                </span>
              </p>
              
              {resItem.raw_metrics_available !== undefined && (
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-xs">Raw Metrics Analyzed:</span>
                  <br />
                  <span className="text-orange-600 font-black text-lg">{resItem.raw_metrics_available}</span>
                </p>
              )}

              {resItem.insights_generated !== undefined && (
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-xs">Insights Generated:</span>
                  <br />
                  <span className="text-blue-600 font-black text-lg">{resItem.insights_generated}</span>
                </p>
              )}

              <div className="mt-1 text-sm text-slate-500 font-medium italic">
                "{resItem.message}"
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const InsightsTab = ({ isContextDropdownOpen, setIsContextDropdownOpen, activeProject, projects, setActiveProject, insightFilter, setInsightFilter, insights, fetchInsights, isFetchingInsights }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
    {/* Top Control Bar */}
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-4 justify-between relative">
      {/* Context Selector */}
      <div className="relative">
        <button 
          onClick={() => setIsContextDropdownOpen(!isContextDropdownOpen)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 bg-white text-slate-700 text-sm font-semibold outline-none shadow-sm flex items-center gap-2.5 hover:border-orange-400 transition-colors"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-inner"></span>
          Context: <span className="text-orange-600 font-bold truncate max-w-[150px]">{activeProject?.name || 'Select Project'}</span>
          <ChevronDown className="text-slate-400" size={16} />
        </button>
        {/* Dropdown */}
        {isContextDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50">
              {projects.length === 0 ? (
                <p className="text-xs text-slate-400 p-3 text-center">No projects found.</p>
              ) : (
                projects.map(proj => (
                    <button 
                        key={proj.project_id}
                        onClick={() => { setActiveProject(proj); setIsContextDropdownOpen(false); }}
                        className={`w-full flex flex-col p-3 rounded-lg text-left text-sm font-semibold transition-colors ${activeProject?.project_id === proj.project_id ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {proj.name}
                        <span className="text-xs text-slate-400 font-mono mt-0.5">{proj.project_id}</span>
                    </button>
                ))
              )}
          </div>
        )}
      </div>

      {/* Filtering and Refresh Button */}
      <div className="flex items-center gap-4">
        <select 
          value={insightFilter}
          onChange={(e) => setInsightFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 bg-white text-slate-700 text-sm font-semibold outline-none shadow-sm cursor-pointer"
        >
          <option value="">All Insight Types</option>
          <option value="anomaly">Anomalies</option>
          <option value="regression">Regressions</option>
          <option value="causation">Causations</option>
        </select>

        <button
          onClick={fetchInsights}
          disabled={!activeProject || isFetchingInsights}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 disabled:text-orange-50 disabled:cursor-not-allowed active:scale-95"
        >
          {isFetchingInsights ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          {isFetchingInsights ? "Fetching..." : "Refresh Insights"}
        </button>
      </div>
    </div>

    {/* Insight List */}
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Detected Insights</h4>
        <p className="text-xs text-slate-400">Total Insights: <span className="font-mono text-slate-600 font-bold">{insights.length}</span></p>
      </div>

      {insights.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <Lightbulb className="text-slate-300 w-10 h-10 mb-4" />
          <p className="text-slate-500 font-medium">No insights available.</p>
          <p className="text-slate-400 text-sm mt-1">Run the ML pipeline or click refresh to generate data.</p>
        </div>
      ) : (
        insights.map((insight, i) => {
          const typeColor = {
            anomaly: 'orange',
            regression: 'red',
            causation: 'blue'
          }[insight.insight_type] || 'slate';
          
          const ts = insight.timestamp ? new Date(insight.timestamp).toLocaleString() : '—';

          return (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm hover:border-slate-300 transition-colors">
              <div className={`mt-1.5 w-3 h-3 rounded-full bg-${typeColor}-500 shadow-sm shrink-0`}></div>
              <div className="flex-1">
                <span className={`inline-block px-2.5 py-1 rounded-lg border text-xs font-bold uppercase tracking-wider mb-2 border-${typeColor}-200 bg-${typeColor}-50 text-${typeColor}-700`}>
                  {insight.insight_type}
                </span>
                <p className="text-slate-700 text-sm font-medium leading-relaxed">{insight.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs font-mono mt-3 pb-0.5">
                  <span>{ts}</span>
                  <span>·</span>
                  <span className="truncate">Metric: {insight.metric_name}</span>
                  <span>·</span>
                  <span>Value: {insight.value}</span>
                  <span>·</span>
                  <span>Source: {insight.source}</span>
                  <span>·</span>
                  <span className={`capitalize font-semibold text-${insight.severity === 'high' ? 'red' : 'orange'}-500`}>
                    Severity: {insight.severity}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

const AIChatTab = ({ activeProject, chatMessages, isChatLoading, chatEndRef, chatInput, setChatInput, handleSendChat }) => (
  // Fixed height using vh with exact bounds to eliminate page-level scrolling 
  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[75vh] min-h-[500px] max-h-[800px] animate-in fade-in slide-in-from-bottom-2">
    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
      <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="text-orange-500" size={20} />
          Performance Assistant
      </h3>
      {activeProject && (
          <span className="text-xs font-bold bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-lg">
          Context: {activeProject.project_id}
          </span>
      )}
    </div>

    {/* min-h-0 is essential here to prevent flexbox children from expanding past parent height */}
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/30 min-h-0">
      
      {/* Empty State for Chat */}
      {chatMessages.length === 0 && !isChatLoading && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <MessageSquare size={32} className="opacity-50" />
            <p className="text-sm font-medium">Ask a question about your load test results.</p>
        </div>
      )}

      {chatMessages.map((msg, i) => (
        <div key={i} className={`flex flex-col max-w-[95%] sm:max-w-[85%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
          <div
            className={`p-4 sm:p-5 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === "user"
                ? "bg-orange-500 text-white rounded-br-sm"
                : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm overflow-hidden"
            }`}
            dangerouslySetInnerHTML={{ 
              __html: msg.role === "user" 
                ? msg.text.replace(/\n/g, '<br/>') 
                : formatMarkdown(msg.text) 
            }}
          />
          {msg.meta && (
            <span className={`text-xs text-slate-400 mt-2 px-1 ${msg.role === "user" ? "text-right" : ""}`}>
              {msg.meta}
            </span>
          )}
        </div>
      ))}
      
      {isChatLoading && (
        <div className="flex flex-col max-w-[90%] sm:max-w-[80%] mr-auto">
          <div className="p-4 rounded-2xl text-sm leading-relaxed shadow-sm bg-white border border-slate-200 text-slate-500 rounded-bl-sm flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> Analyzing insights...
          </div>
        </div>
      )}
      
      <div ref={chatEndRef} />
    </div>

    <form onSubmit={handleSendChat} className="p-3 sm:p-4 bg-white border-t border-slate-100 flex gap-2 sm:gap-3 shrink-0">
      <input
        type="text"
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        disabled={isChatLoading}
        placeholder="Ask about latency, errors, or root causes..."
        className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700 text-sm disabled:bg-slate-50 disabled:text-slate-400"
      />
      <button
        type="submit"
        disabled={!chatInput.trim() || isChatLoading}
        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white px-4 sm:px-6 py-3 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
      >
        <Send size={18} />
        <span className="hidden sm:inline">Send</span>
      </button>
    </form>
  </div>
);


// ==========================================
// ── MAIN DASHBOARD COMPONENT ──
// ==========================================

const PerformanceDashboard = () => {
  // Redux Setup
  const { user } = useSelector((state) => state.profile);
  const userId = user?._id;

  // Global & Navigation State
  const [apiBase, setApiBase] = useState(API || "https://mnr-at.com/api-v3");
  const [activePage, setActivePage] = useState("projects");
  const [activeProject, setActiveProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [toasts, setToasts] = useState([]);

  // UI States
  const [showCreate, setShowCreate] = useState(false);
  const [ingestTab, setIngestTab] = useState("jmeter");
  const [isContextDropdownOpen, setIsContextDropdownOpen] = useState(false);
  const chatEndRef = useRef(null);

  // Data States
  const [projectForm, setProjectForm] = useState({ project_id: "", name: "", desc: "" });
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineResult, setPipelineResult] = useState(null);
  
  const [insights, setInsights] = useState([]);
  const [insightFilter, setInsightFilter] = useState("");
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);
  
  // Chat States
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  // ── INIT & URL PARAMS ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("api")) setApiBase(params.get("api"));
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── HELPER: TOASTS ──
  const addToast = (msg, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // ── HELPER: API WRAPPER ──
  const apiCall = async (method, path, body) => {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(apiBase + path, opts);
      const text = await res.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (err) {
        // Attempt to parse concatenated JSON objects (e.g. {} {} returned by the backend)
        try {
          const fixedText = '[' + text.replace(/}\s*\{/g, '},{') + ']';
          data = JSON.parse(fixedText);
        } catch (err2) {
          if (!res.ok) throw new Error(text);
          return text; // Return plain text if it still won't parse
        }
      }

      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
      return data;
    } catch (e) {
      throw e;
    }
  };

  // ── DATA FETCHING ──
  const fetchInsights = useCallback(async () => {
    if (!activeProject) {
      setInsights([]);
      return;
    }
    
    setIsFetchingInsights(true);
    try {
      let path = `/api/ml/${activeProject.project_id}/insights`;
      if (insightFilter) path += `?insight_type=${insightFilter}`;
      
      const data = await apiCall("GET", path);
      setInsights(data.insights || []);
    } catch (e) {
      addToast("Failed to load insights: " + e.message, "error");
    } finally {
      setIsFetchingInsights(false);
    }
  }, [activeProject, insightFilter, apiBase]);

  // Refetch when active project or filter changes
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // ── ACTIONS ──
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.project_id || !projectForm.name) {
      addToast("Project ID and Name are required", "error");
      return;
    }
    if (!userId) {
      addToast("User ID not found. Please log in first.", "error");
      return;
    }

    try {
      const createData = await apiCall("POST", "/api/projects/", {
        project_id: projectForm.project_id,
        user_id: userId,
        name: projectForm.name,
        description: projectForm.desc
      });
      
      addToast(`Project "${projectForm.name}" created successfully!`, "success");

      const detailData = await apiCall("GET", `/api/projects/${createData.project_id}`);
      
      setProjects([...projects, detailData]);
      setActiveProject(detailData);
      setShowCreate(false);
      setProjectForm({ project_id: "", name: "", desc: "" });
    } catch (e) {
      addToast("Error: " + e.message, "error");
    }
  };

  const handleRunPipeline = async () => {
    if (!activeProject) {
      addToast("Select a project first", "error");
      return;
    }
    setIsRunningPipeline(true);
    setPipelineResult(null);

    try {
      const data = await apiCall("POST", `/api/ml/${activeProject.project_id}/run`, null);
      
      const resultsArray = Array.isArray(data) ? data : [data];
      setPipelineResult(resultsArray);
      
      const lastMsg = resultsArray[resultsArray.length - 1]?.message || "Pipeline execution finished";
      addToast(lastMsg, "success");

    } catch (e) {
      addToast("Error: " + e.message, "error");
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!activeProject) {
      addToast("Select a project first", "error");
      return;
    }
    const question = chatInput.trim();
    if (!question) return;

    setChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const data = await apiCall("POST", "/api/chat/", {
        project_id: activeProject.project_id,
        question: question
      });

      // Prevent crashing if string isn't wrapped perfectly in the "answer" param
      let answerText = typeof data === 'string' ? data : data.answer;

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: answerText,
          meta: data.insights_used ? `${data.insights_used} insights referenced` : null
        }
      ]);
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "⚠ Error: " + e.message }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => addToast("Copied!", "success"));
  };

  // ── DYNAMIC SNIPPETS ──
  const pid = activeProject?.project_id || 'YOUR_PROJECT_ID';
  const snippets = {
    jmeter: `import groovy.json.JsonOutput\nimport java.net.http.*\nimport java.net.URI\n\n// Grab result from the current sampler\ndef responseTime = prev.getTime()          // response time in ms\ndef latency      = prev.getLatency()\ndef label        = prev.getSampleLabel()\ndef errorCount   = prev.isSuccessful() ? 0 : 1\ndef responseCode = prev.getResponseCode()\ndef bytes        = prev.getBytesAsLong()\n\n// Build payload\ndef payload = JsonOutput.toJson([\n    project_id      : "${pid}",\n    timestamp       : new Date().toInstant().toString(),\n    label           : label,\n    response_time_ms: responseTime as double,\n    latency_ms      : latency as double,\n    error_count     : errorCount,\n    response_code   : responseCode,\n    bytes_received  : bytes as int\n])\n\n// POST to backend\ndef client  = HttpClient.newHttpClient()\ndef request = HttpRequest.newBuilder()\n    .uri(URI.create("${apiBase}/api/ingest/jmeter"))\n    .header("Content-Type", "application/json")\n    .POST(HttpRequest.BodyPublishers.ofString(payload))\n    .build()\n\nclient.send(request, HttpResponse.BodyHandlers.ofString())`,
    k6: `import http from 'k6/http';\nimport { check, sleep } from 'k6';\n\nconst BACKEND_URL = '${apiBase}';\nconst PROJECT_ID  = '${pid}';\n\nexport const options = {\n  vus: 50,\n  duration: '30s',\n};\n\nfunction sendToBackend(metricName, value, tags = {}) {\n  http.post(\n    \`\${BACKEND_URL}/api/ingest/k6\`,\n    JSON.stringify({\n      project_id:  PROJECT_ID,\n      timestamp:   new Date().toISOString(),\n      metric_name: metricName,\n      value:       value,\n      tags:        tags,\n    }),\n    { headers: { 'Content-Type': 'application/json' } }\n  );\n}\n\nexport default function () {\n  const res = http.get('http://your-app.com/api/endpoint');\n  check(res, { 'status is 200': (r) => r.status === 200 });\n  sendToBackend('response_time_ms', res.timings.duration, { endpoint: '/api/endpoint' });\n  sendToBackend('error_rate', res.status !== 200 ? 1 : 0,  { endpoint: '/api/endpoint' });\n  sleep(1);\n}`,
    prometheus: `curl -X POST ${apiBase}/api/projects/${pid}/prometheus \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "project_id": "${pid}",\n    "prometheus_url": "http://your-prometheus:9090",\n    "metrics": [\n      "node_cpu_seconds_total",\n      "node_memory_MemAvailable_bytes"\n    ]\n  }'`
  };

  const navItems = [
    { id: "projects", label: "Projects", icon: LayoutDashboard },
    { id: "ingest", label: "Connect Tools", icon: LinkIcon },
    { id: "ml", label: "ML Pipeline", icon: Cpu },
    { id: "insights", label: "Insights", icon: Lightbulb },
    { id: "chat", label: "AI Chat", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative">
      
      {/* GLOBAL TOAST CONTAINER */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border bg-white animate-in slide-in-from-right-4 fade-in duration-300 ${t.type === 'success' ? 'border-emerald-500' : t.type === 'error' ? 'border-red-500' : 'border-orange-500'}`}>
            {t.type === 'success' && <CheckCircle2 className="text-emerald-500" size={20} />}
            {t.type === 'error' && <XCircle className="text-red-500" size={20} />}
            {t.type === 'info' && <Info className="text-orange-500" size={20} />}
            <p className="text-sm font-semibold text-slate-800">{t.msg}</p>
          </div>
        ))}
      </div>

      {/* HORIZONTAL TOP NAVIGATION */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto w-full px-8 h-20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Activity className="text-orange-500" size={32} strokeWidth={2.5} />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
                <span className={`w-2 h-2 rounded-full ${activeProject ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                <span className="text-xs font-bold text-slate-500 tracking-wide font-mono truncate max-w-[150px]">
                  {activeProject ? activeProject.name : "No Project Selected"}
                </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto hide-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activePage === item.id
                    ? "bg-orange-50 text-orange-600 border border-orange-100 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
        
        {activePage === "projects" && (
          <ProjectsTab 
            showCreate={showCreate}
            setShowCreate={setShowCreate}
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            handleCreateProject={handleCreateProject}
            projects={projects}
            activeProject={activeProject}
            setActiveProject={setActiveProject}
            addToast={addToast}
          />
        )}

        {activePage === "ingest" && (
          <ConnectToolsTab 
            activeProject={activeProject}
            ingestTab={ingestTab}
            setIngestTab={setIngestTab}
            snippets={snippets}
            copyToClipboard={copyToClipboard}
          />
        )}

        {activePage === "ml" && (
          <MLPipelineTab 
            activeProject={activeProject}
            handleRunPipeline={handleRunPipeline}
            isRunningPipeline={isRunningPipeline}
            pipelineResult={pipelineResult}
          />
        )}

        {activePage === "insights" && (
          <InsightsTab 
            isContextDropdownOpen={isContextDropdownOpen}
            setIsContextDropdownOpen={setIsContextDropdownOpen}
            activeProject={activeProject}
            projects={projects}
            setActiveProject={setActiveProject}
            insightFilter={insightFilter}
            setInsightFilter={setInsightFilter}
            insights={insights}
            fetchInsights={fetchInsights}
            isFetchingInsights={isFetchingInsights}
          />
        )}

        {activePage === "chat" && (
          <AIChatTab 
            activeProject={activeProject}
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            chatEndRef={chatEndRef}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendChat={handleSendChat}
          />
        )}
      </main>
    </div>
  );
};

export default PerformanceDashboard;