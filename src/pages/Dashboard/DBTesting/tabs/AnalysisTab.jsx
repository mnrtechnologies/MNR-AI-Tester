import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Eye, EyeOff, Zap, Loader2, StopCircle,
  Download, RefreshCw, Clock, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, triggerDownload, fmtDate } from '../api';
import { guardRun } from '../../../../services/operations/runGate';
import { stCfg } from '../constants';
import StatusPill from '../components/StatusPill';
import ShimmerBar from '../components/ShimmerBar';
import AnalysisReportPanel from '../components/AnalysisReportPanel';

export default function AnalysisTab() {
  const [connStr, setConnStr]               = useState('');
  const [showConn, setShowConn]             = useState(false);
  const [jobSubmitting, setJobSubmitting]   = useState(false);
  const [analysisJob, setAnalysisJob]       = useState(null);
  const [recentJobs, setRecentJobs]         = useState([]);
  const [jobsLoading, setJobsLoading]       = useState(false);
  const [jobResTab, setJobResTab]           = useState('findings');
  const [jobDLing, setJobDLing]             = useState(false);
  const [cancellingJob, setCancellingJob]   = useState(false);
  const pollRef     = useRef(null);
  const startRef    = useRef(null);
  const pollFailRef = useRef(0);

  // ─── Polling ─────────────────────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try { const d = await apiFetch('/analysis/jobs'); setRecentJobs(d.jobs || []); }
    catch { /* silent — backend not yet deployed */ }
    finally { setJobsLoading(false); }
  }, []);

  const pollJob = useCallback(async (id) => {
    try {
      const data = await apiFetch(`/analysis/jobs/${id}`);
      pollFailRef.current = 0;
      setAnalysisJob(data);
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        stopPoll();
        loadJobs();
        if (data.status === 'completed') toast.success('DB analysis complete!');
        if (data.status === 'failed')    toast.error(data.error || 'Analysis failed');
      }
    } catch {
      pollFailRef.current += 1;
      if (pollFailRef.current >= 3) {
        stopPoll();
        toast.error('Lost connection — check your network and refresh.');
      }
    }
  }, [stopPoll, loadJobs]);

  const startPoll = useCallback((id) => {
    stopPoll();
    startRef.current = Date.now();
    pollFailRef.current = 0;
    pollJob(id);
    pollRef.current = setInterval(() => {
      if (Date.now() - startRef.current > 720000) {
        stopPoll();
        setAnalysisJob(prev => prev ? { ...prev, _timeout: true } : prev);
      } else {
        pollJob(id);
      }
    }, 3000);
  }, [stopPoll, pollJob]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const runAnalysis = async (e) => {
    e.preventDefault();
    if (!connStr.trim()) { toast.error('Enter a connection string.'); return; }
    setJobSubmitting(true); setAnalysisJob(null);
    try {
      // Billed per object scanned, so "no AI involved" does not mean free.
      if (!(await guardRun('a database analysis'))) return;

      const d = await apiFetch('/analysis/run', {
        method: 'POST',
        body: JSON.stringify({ connection_string: connStr.trim() }),
      });
      setAnalysisJob({ id: d.job_id, status: d.status, db_type: d.db_type });
      toast.success('Analysis started.');
      startPoll(d.job_id);
    } catch (e) { toast.error(e.message); }
    finally { setJobSubmitting(false); }
  };

  const cancelJob = async () => {
    if (!analysisJob?.id) return;
    setCancellingJob(true);
    try {
      await apiFetch(`/analysis/jobs/${analysisJob.id}`, { method: 'DELETE' });
      stopPoll();
      setAnalysisJob(p => ({ ...p, status: 'cancelled' }));
      toast.success('Job cancelled.');
      loadJobs();
    } catch (e) { toast.error(e.message); }
    finally { setCancellingJob(false); }
  };

  const downloadReport = async () => {
    if (!analysisJob?.id || jobDLing) return;
    setJobDLing(true);
    try {
      const blob = await apiFetch(`/analysis/jobs/${analysisJob.id}/report`, { blob: true });
      triggerDownload(blob, `db-analysis-${analysisJob.id.slice(0, 8)}.xlsx`);
      toast.success('Report downloaded!');
    } catch (e) { toast.error(e.message); }
    finally { setJobDLing(false); }
  };

  const isJobActive = analysisJob && ['pending', 'running'].includes(analysisJob.status);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Form */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
          <BarChart3 size={13} /> DB Diagnostic — no AI involved
        </p>
        <form onSubmit={runAnalysis} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Connection String *
            </label>
            <div className="relative">
              <input
                type={showConn ? 'text' : 'password'} value={connStr}
                onChange={e => setConnStr(e.target.value)}
                placeholder="postgres://user:pass@host:5432/mydb"
                disabled={!!isJobActive}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button type="button" onClick={() => setShowConn(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showConn ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Encrypted on receipt — never logged or returned.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button type="submit" disabled={jobSubmitting || !!isJobActive || !connStr.trim()}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-bold transition-all ${
                jobSubmitting || isJobActive || !connStr.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25 hover:-translate-y-0.5 active:translate-y-0'
              }`}>
              {jobSubmitting
                ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
                : <><Zap size={16} fill="currentColor" /> Run Analysis</>}
            </button>

            {isJobActive && (
              <button type="button" onClick={cancelJob} disabled={cancellingJob}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 transition-colors disabled:opacity-60">
                {cancellingJob ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />} Cancel
              </button>
            )}

            {analysisJob?.status === 'completed' && (
              <button type="button" onClick={downloadReport} disabled={jobDLing}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-70">
                {jobDLing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {jobDLing ? 'Downloading…' : 'Download .xlsx'}
              </button>
            )}

            {analysisJob && !isJobActive && (
              <button type="button" onClick={() => { setAnalysisJob(null); setConnStr(''); }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 transition-colors">
                <RefreshCw size={14} /> New Analysis
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Active job status + results */}
      {analysisJob && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-white rounded-2xl px-5 py-4 border border-slate-200 shadow-sm flex items-center gap-3 flex-wrap">
            <StatusPill status={analysisJob.status} />
            <span className="text-xs font-mono text-slate-400 truncate">{analysisJob.id}</span>
            {analysisJob.db_type && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase">{analysisJob.db_type}</span>
            )}
            {analysisJob.status === 'running' && (
              <span className="text-xs text-orange-600 font-bold flex items-center gap-1.5 ml-auto">
                <Loader2 size={12} className="animate-spin" /> Running diagnostics…
              </span>
            )}
            {analysisJob.status === 'pending' && (
              <span className="text-xs text-slate-500 font-bold ml-auto">Queued — waiting to start…</span>
            )}
            {analysisJob._timeout && (
              <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg ml-auto">Taking longer than expected</span>
            )}
            {analysisJob.status === 'failed' && analysisJob.error && (
              <span className="text-xs text-rose-600 font-bold ml-auto truncate max-w-xs">{analysisJob.error}</span>
            )}
          </div>

          {(analysisJob.status === 'pending' || analysisJob.status === 'running') && !analysisJob.report && (
            <ShimmerBar />
          )}

          {analysisJob.report && (
            <AnalysisReportPanel
              report={analysisJob.report}
              activeTab={jobResTab}
              setActiveTab={setJobResTab}
            />
          )}
        </motion.div>
      )}

      {/* Recent jobs list */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock size={12} /> Recent Jobs
          </h3>
          <button onClick={loadJobs}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {jobsLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : recentJobs.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No jobs yet — run your first analysis above.</p>
        ) : (
          <div className="space-y-2">
            {recentJobs.slice(0, 10).map(job => {
              const c = stCfg[job.status] || stCfg.pending;
              return (
                <button key={job.id} onClick={async () => {
                  try {
                    const d = await apiFetch(`/analysis/jobs/${job.id}`);
                    setAnalysisJob(d); setJobResTab('findings');
                    if (['pending', 'running'].includes(d.status)) startPoll(d.id);
                  } catch (e) { toast.error(e.message); }
                }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all text-left group">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                  <span className="text-xs font-mono text-slate-500 shrink-0 truncate max-w-[120px]">{job.id}</span>
                  <span className="text-xs font-bold text-slate-600 uppercase shrink-0">{job.db_type}</span>
                  <span className="text-xs text-slate-400 ml-auto shrink-0">{fmtDate(job.created_at)}</span>
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
