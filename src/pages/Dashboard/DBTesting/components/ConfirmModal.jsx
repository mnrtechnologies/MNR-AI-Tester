import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function ConfirmModal({
  title, body, note,
  confirmLabel, confirmClass,
  icon: Icon, iconClass,
  onConfirm, onCancel, loading,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200"
      >
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{body}</p>
          </div>
        </div>
        {note && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-5 leading-relaxed">
            {note}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={loading}
            className={`flex-1 py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-70 flex items-center justify-center gap-2 ${confirmClass}`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
