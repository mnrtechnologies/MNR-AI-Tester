import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, Eye, EyeOff, Loader2, StopCircle, Download,
  RefreshCw, Clock, ChevronDown, ChevronRight, Brain,
  CheckCircle2, XCircle, AlertTriangle, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, triggerDownload, fmtDate } from '../api';
import { stCfg, ASSESS_PHASES } from '../constants';
import StatusPill from '../components/StatusPill';
import ShimmerBar from '../components/ShimmerBar';
import AnalysisReportPanel from '../components/AnalysisReportPanel';
import TestReportPanel from '../components/TestReportPanel';

// --- NEW CREDIT IMPORTS ---
import { fetchCreditAccount, authorizeRun, settleRun, releaseRun } from '../../../../services/operations/creditAPIs';

export default function AssessmentTab() {
  const [assessForm, setAssessForm] = useState({
    provider: 'anthropic', api_key: '', model: '', replica_url: '',
    database: 'postgresql', description: '', language: 'sql',
    type: 'integration', schema: '',
  });
  const [showApiKey, setShowApiKey]               = useState(false);
  const [showReplica, setShowReplica]             = useState(false);
  const [showSchema, setShowSchema]               = useState(false);
  const [assessSubmitting, setAssessSubmitting]   = useState(false);
  const [assessment, setAssessment]               = useState(null);
  const [recentAssess, setRecentAssess]           = useState([]);
  const [assessListLoading, setAssessListLoading] = useState(false);
  const [assessDbTab, setAssessDbTab]             = useState('findings');
  const [assessTestTab, setAssessTestTab]         = useState('test_results');
  const [assessDLing, setAssessDLing]             = useState(false);
  const [cancellingAssess, setCancellingAssess]   = useState(false);
  const pollRef  = useRef(null);
  const startRef = useRef(null);
  const billingIdRef = useRef(null);

  // --- REDUX & CREDIT STATE ---
  const { user } = useSelector((state) => state.profile);
  const creditAccount = user?.creditAccount;
  const dispatch = useDispatch();

  // ─── Polling ─────────────────────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const loadAssessments = useCallback(async () => {
    setAssessListLoading(true);
    try { const d = await apiFetch('/analysis/assessments'); setRecentAssess(d.assessments || []); }
    catch { /* silent — backend not yet deployed */ }
    finally { setAssessListLoading(false); }
  }, []);

  const pollFailRef = useRef(0);

  const pollAssessment = useCallback(async (id) => {
    try {
      const data = await apiFetch(`/analysis/assessments/${id}`);
      pollFailRef.current = 0;
      setAssessment(data);
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        stopPoll();
        loadAssessments();
        
        if (data.status === 'completed') {
          toast.success('Assessment complete!');
          // --- SETTLE CREDITS ON SUCCESS ---
          if (billingIdRef.current) {
            await settleRun(billingIdRef.current);
            dispatch(fetchCreditAccount());
          }
        }
        
        if (data.status === 'failed' || data.status === 'cancelled') {
          if (data.status === 'failed') toast.error(data.error || 'Assessment failed');
          // --- RELEASE CREDITS ON FAILURE/CANCEL ---
          if (billingIdRef.current) {
            await releaseRun(billingIdRef.current);
            dispatch(fetchCreditAccount());
          }
        }
      }
    } catch {
      pollFailRef.current += 1;
      if (pollFailRef.current >= 3) {
        stopPoll();
        toast.error('Lost connection — check your network and refresh.');
      }
    }
  }, [stopPoll, loadAssessments, dispatch]);

  const startPoll = useCallback((id) => {
    stopPoll();
    startRef.current = Date.now();
    pollFailRef.current = 0;
    pollAssessment(id);
    pollRef.current = setInterval(() => {
      if (Date.now() - startRef.current > 720000) {
        stopPoll();
        setAssessment(prev => prev ? { ...prev, _timeout: true } : prev);
      } else {
        pollAssessment(id);
      }
    }, 3000);
  }, [stopPoll, pollAssessment]);

  useEffect(() => { loadAssessments(); }, [loadAssessments]);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const isAssessActive = assessment && ['pending', 'running'].includes(assessment.status);

  const getPhaseIdx = () => {
    if (!assessment) return -1;
    if (assessment.status === 'completed') return 3;
    if (assessment.status === 'running') {
      if (assessment.test_report)  return 2;
      if (assessment.db_analysis)  return 1;
      return 0;
    }
    return -1;
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const startAssessment = async (e) => {
    e.preventDefault();
    if (!assessForm.api_key.trim()) { toast.error('Provider API key is required.'); return; }
    if (!assessForm.replica_url.trim()) { toast.error('Replica URL is required.'); return; }
    
    // --- 1. PREFLIGHT CHECK ---
    const BASE_COST = 5; 
    if (
      creditAccount &&
      !creditAccount.unlimited &&
      !creditAccount.overageEnabled &&
      creditAccount.balance < BASE_COST
    ) {
      toast.error(`Not enough credits. Assessment requires ${BASE_COST} credit(s), but you only have ${creditAccount.balance}.`);
      return;
    }

    setAssessSubmitting(true); 
    setAssessment(null); 
    setAssessDbTab('findings'); 
    setAssessTestTab('test_results');
    billingIdRef.current = `db_assess_${Date.now()}`;

    try {
      // --- 2. HOLD CREDITS ---
      const authRes = await authorizeRun(billingIdRef.current, { acknowledgedOversized: false });
      if (!authRes.ok) throw new Error(authRes.message || "Failed to reserve credits.");
      dispatch(fetchCreditAccount());

      // --- 3. EXECUTE ---
      const d = await apiFetch('/analysis/assessments', {
        method: 'POST',
        body: JSON.stringify({
          provider: assessForm.provider, api_key: assessForm.api_key.trim(),
          model: assessForm.model.trim(), replica_url: assessForm.replica_url.trim(),
          database: assessForm.database, description: assessForm.description.trim(),
          language: assessForm.language, type: assessForm.type, schema: assessForm.schema.trim(),
        }),
      });
      setAssessment({ id: d.assessment_id, status: d.status });
      toast.success('Assessment started.');
      startPoll(d.assessment_id);
    } catch (e) { 
      toast.error(e.message); 
      // --- RELEASE ON IMMEDIATE FAILURE ---
      if (billingIdRef.current) {
        await releaseRun(billingIdRef.current);
        dispatch(fetchCreditAccount());
      }
    }
    finally { setAssessSubmitting(false); }
  };

  const cancelAssessment = async () => {
    if (!assessment?.id) return;
    setCancellingAssess(true);
    try {
      await apiFetch(`/analysis/assessments/${assessment.id}`, { method: 'DELETE' });
      stopPoll();
      setAssessment(p => ({ ...p, status: 'cancelled' }));
      toast.success('Assessment cancelled.');
      loadAssessments();

      // --- RELEASE CREDITS ON CANCEL ---
      if (billingIdRef.current) {
        await releaseRun(billingIdRef.current);
        dispatch(fetchCreditAccount());
      }
    } catch (e) { toast.error(e.message); }
    finally { setCancellingAssess(false); }
  };

  const downloadAssessReport = async () => {
    if (!assessment?.id || assessDLing) return;
    setAssessDLing(true);
    try {
      const blob = await apiFetch(`/analysis/assessments/${assessment.id}/report`, { blob: true });
      triggerDownload(blob, `assessment-${assessment.id.slice(0, 8)}.xlsx`);
      toast.success('Report downloaded!');
    } catch (e) { toast.error(e.message); }
    finally { setAssessDLing(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Form */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Sparkles size={13} /> Full AI Assessment — DB diagnostic + AI test generation + failure analysis
        </p>
        <form onSubmit={startAssessment} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* AI Provider */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">AI Provider *</label>
              <select value={assessForm.provider}
                onChange={e => setAssessForm(p => ({ ...p, provider: e.target.value }))}
                disabled={!!isAssessActive}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50">
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Model <span className="text-slate-400 normal-case font-normal">(optional — empty = provider default)</span>
              </label>
              <input value={assessForm.model}
                onChange={e => setAssessForm(p => ({ ...p, model: e.target.value }))}
                placeholder="e.g. claude-sonnet-4-6" disabled={!!isAssessActive}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
            </div>

            {/* Provider API Key */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Provider API Key *</label>
              <div className="relative">
                <input type={showApiKey ? 'text' : 'password'}
                  value={assessForm.api_key}
                  onChange={e => setAssessForm(p => ({ ...p, api_key: e.target.value }))}
                  placeholder="sk-ant-api03-…" required disabled={!!isAssessActive}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
                <button type="button" onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Never persisted — lives in memory for the job duration only.</p>
            </div>

            {/* Database Type */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Database Type *</label>
              <select value={assessForm.database}
                onChange={e => setAssessForm(p => ({ ...p, database: e.target.value }))}
                disabled={!!isAssessActive}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50">
                <option value="postgresql">PostgreSQL</option>
                <option value="mongodb">MongoDB</option>
                <option value="both">Both</option>
              </select>
            </div>

            {/* Replica URL */}
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Replica URL *</label>
              <div className="relative">
                <input type={showReplica ? 'text' : 'password'}
                  value={assessForm.replica_url}
                  onChange={e => setAssessForm(p => ({ ...p, replica_url: e.target.value }))}
                  placeholder="postgres://user:pass@replica-host:5432/mydb" required
                  disabled={!!isAssessActive}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
                <button type="button" onClick={() => setShowReplica(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showReplica ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Never persisted — wiped from job before analysis begins.</p>
            </div>

            {/* Test Language */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Test Language *</label>
              <select value={assessForm.language}
                onChange={e => setAssessForm(p => ({ ...p, language: e.target.value }))}
                disabled={!!isAssessActive}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50">
                <option value="sql">SQL</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>

            {/* Test Type */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Test Type *</label>
              <select value={assessForm.type}
                onChange={e => setAssessForm(p => ({ ...p, type: e.target.value }))}
                disabled={!!isAssessActive}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50">
                <option value="integration">Integration</option>
                <option value="unit">Unit</option>
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Description <span className="text-slate-400 normal-case font-normal">(optional context for the AI)</span>
              </label>
              <input value={assessForm.description}
                onChange={e => setAssessForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Check for missing indexes and slow joins on the orders table"
                disabled={!!isAssessActive}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50" />
            </div>
          </div>

          {/* Collapsible schema */}
          <div>
            <button type="button" onClick={() => setShowSchema(v => !v)}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
              <ChevronDown size={13} className={`transition-transform duration-200 ${showSchema ? 'rotate-180' : ''}`} />
              Schema DDL
              <span className="text-slate-400 font-normal normal-case">(optional — helps AI generate targeted tests)</span>
            </button>
            <AnimatePresence>
              {showSchema && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                  <textarea value={assessForm.schema}
                    onChange={e => setAssessForm(p => ({ ...p, schema: e.target.value }))}
                    rows={5} placeholder="CREATE TABLE orders (id bigint PRIMARY KEY, user_id bigint, ...);"
                    disabled={!!isAssessActive}
                    className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none disabled:opacity-50" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button type="submit" disabled={assessSubmitting || !!isAssessActive}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-bold transition-all ${
                assessSubmitting || isAssessActive
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25 hover:-translate-y-0.5 active:translate-y-0'
              }`}>
              {assessSubmitting
                ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
                : <><Brain size={16} /> Start Assessment</>}
            </button>

            {isAssessActive && (
              <button type="button" onClick={cancelAssessment} disabled={cancellingAssess}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 transition-colors disabled:opacity-60">
                {cancellingAssess ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />} Cancel
              </button>
            )}

            {assessment?.status === 'completed' && (
              <button type="button" onClick={downloadAssessReport} disabled={assessDLing}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-70">
                {assessDLing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {assessDLing ? 'Downloading…' : 'Download .xlsx'}
              </button>
            )}

            {assessment && !isAssessActive && (
              <button type="button" onClick={() => setAssessment(null)}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 transition-colors">
                <RefreshCw size={14} /> New Assessment
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Active assessment */}
      {assessment && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Pipeline card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="flex items-center gap-3 flex-wrap">
                <StatusPill status={assessment.status} />
                <span className="text-xs font-mono text-slate-400 truncate max-w-[200px]">{assessment.id}</span>
              </div>

              {/* 3-phase pipeline */}
              <div className="flex items-center gap-0">
                {ASSESS_PHASES.map((phase, i) => {
                  const phaseIdx = getPhaseIdx();
                  const done   = phaseIdx > i || assessment.status === 'completed';
                  const active = phaseIdx === i && assessment.status === 'running';
                  return (
                    <React.Fragment key={phase}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ${
                          done ? 'bg-emerald-500' : active ? 'bg-orange-500' : 'bg-slate-200'
                        }`}>
                          {done   ? <CheckCircle2 size={14} className="text-white" /> :
                           active ? <Loader2 size={13} className="text-white animate-spin" /> :
                                    <div className="w-2 h-2 rounded-full bg-slate-400" />}
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                          done ? 'text-emerald-600' : active ? 'text-orange-600' : 'text-slate-400'
                        }`}>{phase}</span>
                      </div>
                      {i < ASSESS_PHASES.length - 1 && (
                        <div className={`h-[2px] w-8 mb-4 transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* State messages */}
            {assessment.status === 'pending' && (
              <div className="mt-4 flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse shrink-0" />
                <span className="text-sm font-bold text-slate-500">Queued — waiting to start…</span>
              </div>
            )}
            {assessment.status === 'running' && !assessment.db_analysis && (
              <div className="mt-4 flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-3 border border-orange-200">
                <Loader2 size={15} className="text-orange-500 animate-spin shrink-0" />
                <span className="text-sm font-bold text-orange-700">Connecting to replica and running DB diagnostic…</span>
              </div>
            )}
            {assessment.status === 'running' && assessment.db_analysis && !assessment.test_report && (
              <div className="mt-4 flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
                <Loader2 size={15} className="text-blue-500 animate-spin shrink-0" />
                <span className="text-sm font-bold text-blue-700">DB analysis done — AI is generating and executing tests…</span>
              </div>
            )}
            {assessment._timeout && (
              <div className="mt-4 flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="text-sm font-bold text-amber-700">Taking longer than expected — assessment is still running in the background.</span>
              </div>
            )}
            {assessment.status === 'failed' && assessment.error && (
              <div className="mt-4 flex items-center gap-2 bg-rose-50 rounded-xl px-4 py-3 border border-rose-200">
                <XCircle size={14} className="text-rose-500 shrink-0" />
                <span className="text-sm font-bold text-rose-700">{assessment.error}</span>
              </div>
            )}
            {assessment.status === 'completed' && assessment.db_analysis && !assessment.test_report && (
              <div className="mt-4 flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="text-sm font-bold text-amber-700">DB analysis available — AI test phase did not produce results.</span>
              </div>
            )}

            {(assessment.status === 'pending' || assessment.status === 'running') && (
              <div className="mt-4"><ShimmerBar /></div>
            )}
          </div>

          {/* Partial db_analysis (show immediately, even mid-run) */}
          {assessment.db_analysis && (
            <div className="space-y-2">
              {assessment.status === 'running' && !assessment.test_report && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                  <Info size={12} /> DB analysis results — AI test results will appear below when ready
                </div>
              )}
              <AnalysisReportPanel
                report={assessment.db_analysis}
                activeTab={assessDbTab}
                setActiveTab={setAssessDbTab}
                label="DB Analysis"
              />
            </div>
          )}

          {/* Test report */}
          {assessment.test_report && (
            <TestReportPanel
              report={assessment.test_report}
              activeTab={assessTestTab}
              setActiveTab={setAssessTestTab}
            />
          )}
        </motion.div>
      )}

      {/* Recent assessments */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock size={12} /> Recent Assessments
          </h3>
          <button onClick={loadAssessments}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {assessListLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : recentAssess.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No assessments yet — start your first one above.</p>
        ) : (
          <div className="space-y-2">
            {recentAssess.slice(0, 10).map(a => {
              const c = stCfg[a.status] || stCfg.pending;
              return (
                <button key={a.id} onClick={async () => {
                  try {
                    const d = await apiFetch(`/analysis/assessments/${a.id}`);
                    setAssessment(d); setAssessDbTab('findings'); setAssessTestTab('test_results');
                    if (['pending', 'running'].includes(d.status)) startPoll(d.id);
                  } catch (e) { toast.error(e.message); }
                }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all text-left group">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                  <span className="text-xs font-mono text-slate-500 shrink-0 truncate max-w-[120px]">{a.id}</span>
                  <span className="text-xs font-bold text-slate-600 uppercase shrink-0">{a.database}</span>
                  <span className="text-xs text-slate-500 shrink-0">{a.provider}</span>
                  {a.score > 0 && (
                    <span className={`text-xs font-black shrink-0 ${a.score >= 70 ? 'text-emerald-600' : a.score >= 40 ? 'text-amber-500' : 'text-rose-600'}`}>
                      {a.score}/100
                    </span>
                  )}
                  <span className="text-xs text-slate-400 ml-auto shrink-0">{fmtDate(a.created_at)}</span>
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-orange-400 transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}