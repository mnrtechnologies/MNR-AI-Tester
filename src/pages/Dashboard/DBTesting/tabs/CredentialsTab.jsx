import React, { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Key, Plus, RefreshCw, Loader2, Trash2, RotateCcw, Eye, EyeOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, fmtDate } from '../api';
import { credIcons } from '../constants';
import ConfirmModal from '../components/ConfirmModal';

export default function CredentialsTab() {
  const [credentials, setCredentials]   = useState([]);
  const [credsLoading, setCredsLoading] = useState(false);
  const [showAddCred, setShowAddCred]   = useState(false);
  const [credForm, setCredForm]         = useState({ name: '', type: 'database_url', value: '', description: '', expires_at: '', metadata: '' });
  const [showCredVal, setShowCredVal]   = useState(false);
  const [savingCred, setSavingCred]     = useState(false);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [deletingCred, setDeletingCred] = useState(false);
  const [confirmRot, setConfirmRot]     = useState(null);
  const [rotatingCred, setRotatingCred] = useState(false);

  const loadCredentials = useCallback(async () => {
    setCredsLoading(true);
    try { const d = await apiFetch('/credentials'); setCredentials(d.credentials || []); }
    catch { /* silent — backend not yet deployed */ }
    finally { setCredsLoading(false); }
  }, []);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  const resetForm = () => setCredForm({ name: '', type: 'database_url', value: '', description: '', expires_at: '', metadata: '' });

  const addCredential = async (e) => {
    e.preventDefault();
    if (!credForm.name.trim() || !credForm.value.trim()) { toast.error('Name and value are required.'); return; }
    setSavingCred(true);
    try {
      await apiFetch('/credentials', {
        method: 'POST',
        body: JSON.stringify({
          name: credForm.name.trim(), type: credForm.type, value: credForm.value,
          description: credForm.description.trim(),
          ...(credForm.expires_at ? { expires_at: new Date(credForm.expires_at).toISOString() } : {}),
          ...(credForm.metadata.trim() ? { metadata: JSON.parse(credForm.metadata) } : {}),
        }),
      });
      toast.success('Credential stored.');
      setShowAddCred(false); resetForm(); setShowCredVal(false);
      loadCredentials();
    } catch (e) { toast.error(e.message); }
    finally { setSavingCred(false); }
  };

  const deleteCredential = async () => {
    if (!confirmDel) return;
    setDeletingCred(true);
    try {
      await apiFetch(`/credentials/${confirmDel}`, { method: 'DELETE' });
      toast.success('Credential deleted.');
      setConfirmDel(null); loadCredentials();
    } catch (e) { toast.error(e.message); }
    finally { setDeletingCred(false); }
  };

  const rotateCredential = async () => {
    if (!confirmRot) return;
    setRotatingCred(true);
    try {
      const d = await apiFetch(`/credentials/${confirmRot}/rotate`, { method: 'POST' });
      toast.success(`Rotated — version ${d.new_version}`);
      setConfirmRot(null); loadCredentials();
    } catch (e) { toast.error(e.message); }
    finally { setRotatingCred(false); }
  };

  return (
    <div>
      {/* Delete modal */}
      <AnimatePresence>
        {confirmDel && (
          <ConfirmModal
            title="Delete Credential?" body="This action cannot be undone."
            confirmLabel="Delete" confirmClass="bg-rose-500 hover:bg-rose-600"
            icon={Trash2} iconClass="bg-rose-50 border border-rose-100 text-rose-500"
            loading={deletingCred} onConfirm={deleteCredential} onCancel={() => setConfirmDel(null)}
          />
        )}
      </AnimatePresence>

      {/* Rotate modal */}
      <AnimatePresence>
        {confirmRot && (
          <ConfirmModal
            title="Rotate Credential?" body="The stored secret will be re-encrypted and versioned."
            note={<>Current MVP: appends <code className="font-mono">_rotated_YYYYMMDD</code> to the value. Future updates will accept a new value.</>}
            confirmLabel="Rotate" confirmClass="bg-amber-500 hover:bg-amber-600"
            icon={RotateCcw} iconClass="bg-amber-50 border border-amber-100 text-amber-500"
            loading={rotatingCred} onConfirm={rotateCredential} onCancel={() => setConfirmRot(null)}
          />
        )}
      </AnimatePresence>

      {/* Add Credential modal */}
      <AnimatePresence>
        {showAddCred && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto hide-scroll">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-900">Add Credential</h3>
                <button onClick={() => { setShowAddCred(false); resetForm(); setShowCredVal(false); }}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={addCredential} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Name *</label>
                  <input value={credForm.name} onChange={e => setCredForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Production DB" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Type</label>
                    <select value={credForm.type} onChange={e => setCredForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all">
                      {['database_url', 'api_key', 'password', 'token', 'certificate'].map(t => (
                        <option key={t} value={t}>{t.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Expires At</label>
                    <input type="datetime-local" value={credForm.expires_at}
                      onChange={e => setCredForm(p => ({ ...p, expires_at: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Value *</label>
                  <div className="relative">
                    <input type={showCredVal ? 'text' : 'password'}
                      value={credForm.value} onChange={e => setCredForm(p => ({ ...p, value: e.target.value }))}
                      placeholder="postgres://user:pass@host:5432/db" required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                    <button type="button" onClick={() => setShowCredVal(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showCredVal ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Stored encrypted — cannot be retrieved after saving.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Description</label>
                  <input value={credForm.description} onChange={e => setCredForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Metadata <span className="text-slate-400 font-normal normal-case">(optional JSON key-value)</span>
                  </label>
                  <textarea value={credForm.metadata} onChange={e => setCredForm(p => ({ ...p, metadata: e.target.value }))}
                    rows={2} placeholder='{"env": "production", "region": "us-east-1"}'
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none" />
                </div>
                <button type="submit" disabled={savingCred}
                  className="w-full py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70 mt-2 shadow-lg shadow-orange-500/20">
                  {savingCred ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Plus size={15} /> Save Credential</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
              <Key size={13} /> Stored Credentials
            </h2>
            <p className="text-xs text-slate-400">Encrypted at rest — values are never returned after creation.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadCredentials}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
              <RefreshCw size={11} /> Refresh
            </button>
            <button onClick={() => setShowAddCred(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-orange-500 text-white px-3.5 py-2 rounded-xl hover:bg-orange-600 transition-colors shadow-sm">
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        {credsLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
        ) : credentials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Key size={24} className="opacity-40" />
            </div>
            <p className="font-semibold text-sm text-slate-600">No credentials stored</p>
            <p className="text-xs text-center max-w-xs">Securely store connection strings, API keys, and tokens to reuse across tests.</p>
            <button onClick={() => setShowAddCred(true)}
              className="mt-2 flex items-center gap-1.5 text-sm font-bold bg-orange-500 text-white px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-colors shadow-sm">
              <Plus size={14} /> Add First Credential
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {credentials.map(cred => {
              const Icon = credIcons[cred.type] || Key;
              const expired = cred.expires_at && new Date(cred.expires_at) < new Date();
              return (
                <div key={cred.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/40 transition-all group">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-sm text-slate-800">{cred.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                        {cred.type.replace('_', ' ')}
                      </span>
                      {cred.version > 1 && (
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">v{cred.version}</span>
                      )}
                      {expired && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">Expired</span>
                      )}
                    </div>
                    {cred.description && <p className="text-xs text-slate-500 truncate">{cred.description}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Added {fmtDate(cred.created_at)}
                      {cred.expires_at && ` · Expires ${fmtDate(cred.expires_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setConfirmRot(cred.id)} title="Rotate"
                      className="p-2 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-500 transition-colors">
                      <RotateCcw size={14} />
                    </button>
                    <button onClick={() => setConfirmDel(cred.id)} title="Delete"
                      className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
