import React from 'react';
import { stCfg } from '../constants';

export default function StatusPill({ status }) {
  const c = stCfg[status] || stCfg.queued;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${c.pill}`}>
      <div className={`w-2 h-2 rounded-full ${c.dot}`} />
      {c.label}
    </div>
  );
}
