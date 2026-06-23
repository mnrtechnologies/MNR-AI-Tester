import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, Key, Plus, Loader2, Trash2, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, fmtDate } from '../api';
import ConfirmModal from '../components/ConfirmModal';

// ─── RevokeByIdForm ───────────────────────────────────────────────────────────

function RevokeByIdForm({ onRevoke }) {
  const [keyId, setKeyId]     = useState('');
  const [revoking, setRevoking] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    const id = parseInt(keyId.trim(), 10);
    if (!keyId.trim() || isNaN(id)) { toast.error('Enter a valid integer key ID.'); return; }
    setRevoking(true);
    try { await onRevoke(id); setKeyId(''); }
    catch (e) { toast.error(e.message); }
    finally { setRevoking(false); }
  };

  return (
    <form onSubmit={handle} className="flex gap-3 items-end flex-wrap">
      <div className="flex-1 min-w-[160px]">
        <input value={keyId} onChange={e => setKeyId(e.target.value)}
          placeholder="Integer key ID (e.g. 42)" type="number" min="1"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-400 outline-none transition-all" />
      </div>
      <button type="submit" disabled={revoking || !keyId.trim()}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-bold transition-all ${
          revoking || !keyId.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'
        }`}>
        {revoking ? <><Loader2 size={14} className="animate-spin" /> Revoking…</> : <><Trash2 size={14} /> Revoke</>}
      </button>
    </form>
  );
}

// ─── ApiKeysTab ───────────────────────────────────────────────────────────────

export default function ApiKeysTab() {
  const [apiKeys, setApiKeys]         = useState([]);
  const [newKeyName, setNewKeyName]   = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey]   = useState(null);
  const [copiedKey, setCopiedKey]     = useState(false);
  const [revokingId, setRevokingId]   = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const createApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) { toast.error('Enter a key name.'); return; }
    setCreatingKey(true);
    try {
      const d = await apiFetch('/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      setApiKeys(prev => [{ id: d.id, name: d.name, expires_at: d.expires_at }, ...prev]);
      setCreatedKey({ value: d.api_key, name: d.name, expires_at: d.expires_at, id: d.id });
      setNewKeyName(''); setCopiedKey(false);
    } catch (e) { toast.error(e.message); }
    finally { setCreatingKey(false); }
  };

  const revokeApiKey = async () => {
    if (!confirmRevoke) return;
    setRevokingId(confirmRevoke.id);
    try {
      await apiFetch(`/auth/api-keys/${confirmRevoke.id}`, { method: 'DELETE' });
      toast.success('API key revoked.');
      setApiKeys(prev => prev.filter(k => k.id !== confirmRevoke.id));
      setConfirmRevoke(null);
    } catch (e) { toast.error(e.message); }
    finally { setRevokingId(null); }
  };

  const copyKey = async (val) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch { toast.error('Could not copy — please select and copy manually.'); }
  };

  return (
    <div className="space-y-5">

      {/* Revoke confirm modal */}
      <AnimatePresence>
        {confirmRevoke && (
          <ConfirmModal
            title="Revoke API Key?"
            body={`"${confirmRevoke.name}" will stop working immediately.`}
            confirmLabel="Revoke" confirmClass="bg-rose-500 hover:bg-rose-600"
            icon={Trash2} iconClass="bg-rose-50 border border-rose-100 text-rose-500"
            loading={revokingId === confirmRevoke.id}
            onConfirm={revokeApiKey} onCancel={() => setConfirmRevoke(null)}
          />
        )}
      </AnimatePresence>

      {/* One-time key reveal modal */}
      <AnimatePresence>
        {createdKey && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Key size={20} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">API Key Created</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Copy it now — it <span className="font-bold text-rose-600">will not be shown again</span>.
                  </p>
                </div>
              </div>
              <div className="bg-[#0f172a] rounded-2xl p-4 mb-3 relative">
                <p className="text-emerald-300 font-mono text-sm break-all pr-8 leading-relaxed select-all">{createdKey.value}</p>
                <button onClick={() => copyKey(createdKey.value)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                  {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mb-1">
                Name: <span className="font-semibold text-slate-600">{createdKey.name}</span>
              </p>
              <p className="text-[10px] text-slate-400 mb-1">
                ID: <span className="font-semibold text-slate-600 font-mono">{createdKey.id}</span>
                <span className="ml-1 text-slate-400">(note this down to revoke later)</span>
              </p>
              {createdKey.expires_at && (
                <p className="text-[10px] text-slate-400 mb-5">
                  Expires: <span className="font-semibold text-slate-600">{fmtDate(createdKey.expires_at)}</span>
                </p>
              )}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-5 leading-relaxed">
                Pass the full string as the <code className="font-mono bg-amber-100 px-1 rounded">X-Api-Key</code> header value when calling the DB API.
              </div>
              <button onClick={() => setCreatedKey(null)}
                className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors">
                I've saved it — close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create card */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
        <div className="mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
            <Shield size={13} /> API Keys — authenticate to the DB Testing API
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Use <code className="font-mono bg-slate-100 px-1 rounded">X-Api-Key: &lt;key&gt;</code> as an alternative to Bearer tokens.
            Keys are shown <span className="font-semibold text-slate-600">once on creation</span> — store them immediately.
          </p>
        </div>
        <form onSubmit={createApiKey} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Key Name *</label>
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              placeholder="e.g. Production key, Staging…" required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
          </div>
          <button type="submit" disabled={creatingKey || !newKeyName.trim()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-white text-sm font-bold transition-all ${
              creatingKey || !newKeyName.trim()
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25 hover:-translate-y-0.5 active:translate-y-0'
            }`}>
            {creatingKey ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><Plus size={15} /> Create Key</>}
          </button>
        </form>
      </div>

      {/* Session key list + revoke by ID */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Key size={12} /> Active Keys
        </h3>

        {apiKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <Shield size={22} className="opacity-30" />
            <p className="text-sm font-semibold text-slate-500">No keys created yet</p>
            <p className="text-xs">Create your first key above.</p>
          </div>
        ) : (
          <div className="space-y-2.5 mb-6">
            {apiKeys.map(k => (
              <div key={k._tempId}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/40 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                  <Key size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800">{k.name}</p>
                  {k.expires_at && <p className="text-[10px] text-slate-400 mt-0.5">Expires {fmtDate(k.expires_at)}</p>}
                </div>
                <button onClick={() => setConfirmRevoke({ id: k.id, name: k.name })}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-all">
                  <Trash2 size={13} /> Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Revoke by ID */}
        <div className={apiKeys.length > 0 ? 'border-t border-slate-100 pt-5' : ''}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Revoke by ID</p>
          <RevokeByIdForm onRevoke={async (id) => {
            await apiFetch(`/auth/api-keys/${id}`, { method: 'DELETE' });
            toast.success(`Key ID ${id} revoked.`);
            setApiKeys(prev => prev.filter(k => k._tempId !== id));
          }} />
        </div>
      </div>

    </div>
  );
}
