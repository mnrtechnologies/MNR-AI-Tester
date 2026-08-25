import React, { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Activity, CheckCircle2 } from 'lucide-react';

const AXIS_STYLE = { fontSize: 11, fill: '#94a3b8' };

const PHASE_LABEL = {
  smoke: 'Smoke', load: 'Load', stress: 'Stress', spike: 'Spike', soak: 'Soak',
};

function useElapsedSamples(samples) {
  return useMemo(() => {
    if (!samples || samples.length === 0) return [];
    const t0 = samples[0].t;
    return samples.map((s) => ({
      elapsed: Math.max(0, Math.round(s.t - t0)),
      rps: s.rps ?? 0,
      vus: s.vus ?? 0,
      p95_ms: s.p95_ms ?? 0,
      error_rate_pct: s.error_rate_pct ?? 0,
    }));
  }, [samples]);
}

/**
 * Fed directly from the run socket's metricsByPhase[phase] — no polling.
 * `live` marks this as the phase currently running; once the run moves on
 * to the next phase, the parent keeps rendering this same block (instead of
 * unmounting it) with `live=false` so a completed phase's chart stays on
 * screen rather than vanishing the moment progress moves forward.
 */
export default function LiveMetricsChart({ phase, samples, live = true }) {
  const data = useElapsedSamples(samples);
  const label = PHASE_LABEL[phase] || phase;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        {live ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> {label} · Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <CheckCircle2 size={12} className="text-emerald-500" /> {label} · Complete
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="py-8 text-center">
          <Activity size={20} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs text-slate-400">Waiting for the first metric sample from the {label} phase…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Throughput &amp; Virtual Users</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="elapsed" tick={AXIS_STYLE} tickFormatter={(v) => `${v}s`} />
                <YAxis yAxisId="left" tick={AXIS_STYLE} />
                <YAxis yAxisId="right" orientation="right" tick={AXIS_STYLE} />
                <Tooltip labelFormatter={(v) => `${v}s elapsed`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="rps" name="RPS" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="vus" name="Virtual Users" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">p95 Latency &amp; Error Rate</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="elapsed" tick={AXIS_STYLE} tickFormatter={(v) => `${v}s`} />
                <YAxis yAxisId="left" tick={AXIS_STYLE} />
                <YAxis yAxisId="right" orientation="right" tick={AXIS_STYLE} unit="%" />
                <Tooltip labelFormatter={(v) => `${v}s elapsed`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="p95_ms" name="p95 (ms)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="error_rate_pct" name="Error rate" stroke="#e11d48" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
