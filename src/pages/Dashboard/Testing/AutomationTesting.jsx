import React, { useState } from 'react';
import { 
 Terminal, Beaker, CheckCircle2, 
  Loader2,  FileCode,  FileSearch, Sparkles, Activity, Layers, CheckSquare, 
  Square, ShieldAlert, Code, Play, LogOut, RotateCcw
} from 'lucide-react';

const AutomationTesting = () => {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('init'); // init, analyze, results, final
  const [sessionId, setSessionId] = useState(null);
  
  // Data from API responses
  const [repoData, setRepoData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [testCaseResults, setTestCaseResults] = useState(null);
  const [finalGeneratedData, setFinalGeneratedData] = useState(null);
  
  // User selections
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [formData, setFormData] = useState({
    github_url: '',
    github_token: '',
    claude_key: '',
    openai_key: '',
    purpose: ''
  });

  const BACKEND_URL = process.env.REACT_APP_AUTOMATION_BACKEND_URL;

  // STEP 1: INITIALIZE
  const handleInit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/v1/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setSessionId(data.session_id);
      setRepoData(data);
      handleAnalyze(data.session_id); 
    } catch (error) { console.error(error); setLoading(false); }
  };

  // STEP 2: ANALYZE
  const handleAnalyze = async (sId) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/v1/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sId}` 
        }
      });
      const data = await response.json();
      setAnalysisData(data);
      
      // CHANGE 1: Manual Selection Only
      // Previously: setSelectedFiles(data.relevant_files || []);
      // Now: Initialize empty so user must select manually
      setSelectedFiles([]); 
      
      setCurrentStep('analyze');
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  // STEP 3: GENERATE TEST CASE DEFINITIONS
  const handleGenerateTests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/v1/generate-test-cases`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}` 
        },
        body: JSON.stringify({
          session_id: sessionId,
          selected_files: selectedFiles
        })
      });
      const data = await response.json();
      setTestCaseResults(data);
      setCurrentStep('results');
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  // STEP 4: FINAL CODE GENERATION & EXECUTION
  const handleFinalGenerate = async () => {
    setLoading(true);
    try {
      // Filter the test cases to include ONLY the files selected by the user
      const allTestCases = testCaseResults?.file_test_cases || [];
      const filteredTestCases = allTestCases.filter(file => 
        selectedFiles.includes(file.source_path)
      );

      const response = await fetch(`${BACKEND_URL}/v1/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}` 
        },
        body: JSON.stringify({
          session_id: sessionId,
          files_with_test_cases: filteredTestCases 
        })
      });
      const data = await response.json();
      setFinalGeneratedData(data);
      setCurrentStep('final');
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  // NEW: LOGOUT / END SESSION
  const handleLogout = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await fetch(`${BACKEND_URL}/v1/session`, {
        method: 'DELETE', // Using DELETE as it's standard for ending sessions
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}` 
        }
      });
      // Reset Application State
      setSessionId(null);
      setRepoData(null);
      setAnalysisData(null);
      setTestCaseResults(null);
      setFinalGeneratedData(null);
      setSelectedFiles([]);
      setCurrentStep('init');
    } catch (error) {
      console.error("Logout failed:", error);
    }
    setLoading(false);
  };

  const toggleFileSelection = (path) => {
    setSelectedFiles(prev => 
      prev.includes(path) ? prev.filter(f => f !== path) : [...prev, path]
    );
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Beaker className="text-cyan-400" /> AI Automation Testing
            </h1>
            <p className="text-slate-400 mt-2">End-to-end AI codebase auditing & test generation</p>
          </div>
          {sessionId && (
            <div className="flex items-center gap-4">
                <div className="bg-cyan-500/10 border border-cyan-500/30 px-4 py-2 rounded-xl">
                    <span className="text-[10px] text-cyan-500 block uppercase font-bold">Active Session</span>
                    <span className="text-xs font-mono text-cyan-200">...{sessionId.slice(-12)}</span>
                </div>
                {/* Header Logout Button */}
                <button 
                  onClick={handleLogout}
                  className="bg-red-500/10 border border-red-500/30 p-2 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors"
                  title="End Session"
                >
                    <LogOut size={18} />
                </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: FORM & INSIGHTS */}
          <div className="lg:col-span-4 space-y-6">
            <div className={`bg-[#0f172a]/80 border border-white/10 p-6 rounded-2xl transition-opacity ${currentStep !== 'init' ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" /> 1. Configuration
              </h2>
              <form onSubmit={handleInit} className="space-y-4">
                <input type="text" placeholder="GitHub URL" className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-2 px-4 text-sm outline-none" value={formData.github_url} onChange={e => setFormData({...formData, github_url: e.target.value})} required />
                <input type="password" placeholder="GitHub Token" className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-2 px-4 text-sm outline-none" value={formData.github_token} onChange={e => setFormData({...formData, github_token: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                   <input type="password" placeholder="OpenAI Key" className="bg-[#1e293b]/50 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none" value={formData.openai_key} onChange={e => setFormData({...formData, openai_key: e.target.value})} />
                   <input type="password" placeholder="Claude Key" className="bg-[#1e293b]/50 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none" value={formData.claude_key} onChange={e => setFormData({...formData, claude_key: e.target.value})} />
                </div>
                <textarea placeholder="Purpose" className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl p-3 text-sm outline-none" rows="2" value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})}></textarea>
                <button type="submit" disabled={loading} className="w-full bg-cyan-500 text-slate-900 font-bold py-2.5 rounded-xl text-sm flex justify-center items-center gap-2">
                  {loading && currentStep === 'init' ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />} Initialize
                </button>
              </form>
            </div>

            {analysisData && (
              <div className="bg-[#0f172a]/80 border border-cyan-500/20 p-6 rounded-2xl animate-in fade-in slide-in-from-left-4">
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-cyan-400" /> AI Insights
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{analysisData.reasoning}</p>
                <div className="flex gap-4">
                   <div className="flex-1 bg-white/5 p-2 rounded-lg text-center">
                     <span className="text-[10px] text-slate-500 block uppercase">Complexity</span>
                     <span className="text-xs font-bold text-orange-400">{analysisData.estimated_complexity}</span>
                   </div>
                   <div className="flex-1 bg-white/5 p-2 rounded-lg text-center">
                     <span className="text-[10px] text-slate-500 block uppercase">Framework</span>
                     <span className="text-xs font-bold text-cyan-400">{analysisData.suggested_test_framework}</span>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: WORKSPACE */}
          <div className="lg:col-span-8">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 h-[750px] flex flex-col relative overflow-hidden font-mono">
              
              {!repoData && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                  <Terminal size={64} className="mb-4" />
                  <p>Awaiting initialization...</p>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-cyan-400">
                  <Loader2 className="animate-spin mb-4" size={40} />
                  <p className="animate-pulse">Processing Request...</p>
                </div>
              )}

              {/* STEP 2: FILE SELECTION */}
              {currentStep === 'analyze' && repoData && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white text-sm flex items-center gap-2"><FileSearch size={18} /> Select Files for Test Generation</h3>
                    <span className="text-[10px] text-slate-500">{selectedFiles.length} files selected</span>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                    {(repoData.structure || []).filter(f => f.type === 'blob').map((file, i) => (
                      <div 
                        key={i} 
                        onClick={() => toggleFileSelection(file.path)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedFiles.includes(file.path) ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-100' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
                      >
                        {selectedFiles.includes(file.path) ? <CheckSquare size={16} className="text-cyan-400" /> : <Square size={16} />}
                        <FileCode size={14} className={selectedFiles.includes(file.path) ? 'text-cyan-400' : ''} />
                        <span className="text-xs truncate">{file.path}</span>
                        {analysisData?.relevant_files?.includes(file.path) && (
                          <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">Recommended</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={handleGenerateTests} disabled={selectedFiles.length === 0} className="mt-6 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-30 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    <Sparkles size={20} /> Generate {selectedFiles.length} Test Suites
                  </button>
                </div>
              )}

              {/* STEP 3: TEST DEFINITIONS PREVIEW */}
              {currentStep === 'results' && testCaseResults && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
                      <h3 className="text-emerald-400 font-bold flex items-center gap-2"><CheckCircle2 size={18}/> Test Cases Identified</h3>
                      <p className="text-xs text-emerald-200/70 mt-1">{testCaseResults?.summary || "No summary available"}</p>
                    </div>

                    {(testCaseResults?.file_test_cases || [])
                      .filter(file => selectedFiles.includes(file.source_path)) 
                      .map((file, idx) => (
                      <div key={idx} className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                          <FileCode className="text-cyan-400" size={16} />
                          <span className="text-white text-sm font-bold">{file.filename}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {(file?.test_cases || []).map((t, i) => (
                            <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/5">
                              <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-cyan-400">Test: {t.description}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase ${t.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>{t.priority}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleFinalGenerate} className="mt-6 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                    <Play size={20} /> Execute & Generate Test Code
                  </button>
                </div>
              )}

              {/* STEP 4: FINAL CODE & RESULTS */}
              {currentStep === 'final' && finalGeneratedData && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                    
                    {/* Metrics Dashboard */}
                    <div className="grid grid-cols-3 gap-4">
                       <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                          <span className="text-[10px] text-emerald-500 block uppercase">Passed</span>
                          <span className="text-2xl font-bold text-emerald-400">
                            {finalGeneratedData?.execution_result?.test_execution?.passed_tests || 0}
                          </span>
                       </div>
                       <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center">
                          <span className="text-[10px] text-red-500 block uppercase">Failed</span>
                          <span className="text-2xl font-bold text-red-400">
                            {finalGeneratedData?.execution_result?.test_execution?.failed_tests || 0}
                          </span>
                       </div>
                       <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
                          <span className="text-[10px] text-slate-500 block uppercase">Framework</span>
                          <span className="text-sm font-bold text-white">{finalGeneratedData?.execution_result?.metadata?.framework || "N/A"}</span>
                       </div>
                    </div>

                    {/* Execution Summary */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                       <h4 className="text-cyan-400 font-bold mb-2 flex items-center gap-2"><Activity size={14}/> Execution Summary</h4>
                       {finalGeneratedData.summary}
                    </div>

                    {/* Generated Code Blocks */}
                    {(finalGeneratedData?.generated_tests || []).map((test, idx) => (
                      <div key={idx} className="space-y-3">
                        <div className="flex justify-between items-center bg-white/5 px-4 py-2 rounded-t-xl border-x border-t border-white/10">
                          <span className="text-xs font-bold text-cyan-400 flex items-center gap-2"><Code size={14}/> {test.filename}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded ${test.coverage_estimate?.includes('FAILED') ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {test.coverage_estimate || 'Status Unknown'}
                          </span>
                        </div>
                        <div className="bg-black/60 p-4 rounded-b-xl border border-white/10 overflow-x-auto">
                          <code className="text-[10px] text-slate-400 leading-normal">{test.code}</code>
                        </div>
                      </div>
                    ))}
                    
                    {/* Security Logs (Filtered from Docker Logs) */}
                    {finalGeneratedData?.execution_result?.docker_logs?.stderr && (
                      <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-xl">
                         <h4 className="text-orange-400 font-bold text-xs mb-2 flex items-center gap-2"><ShieldAlert size={14}/> System & Security Logs</h4>
                         <div className="text-[10px] text-slate-500 font-mono">
                            {finalGeneratedData.execution_result.docker_logs.stderr
                              .split('\n')
                              .filter(line => line.toLowerCase().includes('vulnerabilities') || line.toLowerCase().includes('error'))
                              .map((v, i) => <p key={i} className="mb-1 border-b border-orange-500/10 pb-1">{v}</p>)
                            }
                         </div>
                      </div>
                    )}

                  </div>
                  
                  {/* CHANGE 2: End Session Button added here */}
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setCurrentStep('init')} 
                        className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        <RotateCcw size={16} /> Start New Audit
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        <LogOut size={16} /> End Session
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationTesting;