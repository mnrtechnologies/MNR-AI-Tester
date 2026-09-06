import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { LOG_COLOR_CLASS } from '../constants';

export default function LiveLogPanel({ logs, active, finished }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length]);

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-800/50">
        <Terminal size={13} className="text-slate-400" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Log</span>
        <span className="ml-auto text-[10px] text-slate-500">{logs.length} line{logs.length === 1 ? '' : 's'}</span>
      </div>
      <div className="h-64 overflow-y-auto px-4 py-3 font-mono text-xs space-y-1">
        {logs.length === 0 ? (
          // A finished run with no log lines is NOT "waiting to start" — its
          // live log simply aged out of Redis (8h TTL, see redis_store.py).
          // Showing the waiting message on a run that completed hours ago
          // reads as though the run never began, and hides the fact that
          // the evidence is merely expired rather than missing.
          finished ? (
            <p className="text-slate-600 italic">
              This run has finished and its live log has expired (logs are kept for 8 hours).
              The phase results and any failure reason below are stored permanently.
            </p>
          ) : active ? (
            <p className="text-slate-600 italic">Waiting for the run to start…</p>
          ) : (
            <p className="text-slate-600 italic">No log lines for this run.</p>
          )
        ) : (
          logs.map((l, i) => (
            <p key={i} className={`${LOG_COLOR_CLASS[l.color] || LOG_COLOR_CLASS.white} leading-relaxed break-words`}>
              <span className="text-slate-600 mr-2">{String(i + 1).padStart(3, '0')}</span>
              {l.message}
            </p>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
