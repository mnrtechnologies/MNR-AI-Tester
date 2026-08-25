import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { LOG_COLOR_CLASS } from '../constants';

export default function LiveLogPanel({ logs }) {
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
          <p className="text-slate-600 italic">Waiting for the run to start…</p>
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
