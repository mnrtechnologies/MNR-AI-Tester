import React from 'react';
import { Radar } from 'lucide-react';

const METHOD_STYLE = {
  GET:    'bg-blue-50 text-blue-700 border-blue-200',
  POST:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  PUT:    'bg-amber-50 text-amber-700 border-amber-200',
  PATCH:  'bg-amber-50 text-amber-700 border-amber-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
};

/**
 * Live-growing list of real API endpoints as discovery/crawler.py finds
 * them — fed straight from the WS `endpoints` messages (see
 * usePerfRunSocket), no polling. Discovery previously gave zero visibility
 * into what it was actually finding until the whole phase finished (which
 * can be many minutes later); this shows each one arriving in real time so
 * the user can see the run is doing real, useful work, not just waiting.
 */
export default function DiscoveredEndpointsPanel({ endpoints }) {
  if (!endpoints || endpoints.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Radar size={14} className="text-orange-500" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Endpoints Found <span className="text-slate-300">·</span> <span className="text-slate-600">{endpoints.length}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
        {endpoints.map((e, i) => (
          <div key={i} title={e.origin}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${METHOD_STYLE[e.method] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            <span className="font-bold">{e.method}</span>
            <span className="truncate max-w-[280px]">{e.path}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
