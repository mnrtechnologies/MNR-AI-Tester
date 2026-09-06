import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

/**
 * A live, ticking "running for Xm Ys" counter. A static spinner reads as
 * "loading" for a moment; a number that visibly keeps counting up reads as
 * "genuinely still working" over a long wait — confirmed needed in practice:
 * discovery can legitimately take 5-20+ minutes, and without any live signal
 * during that stretch, a run that's actually fine looks indistinguishable
 * from one that's stuck.
 */
export default function ElapsedTimer({ since, until, active }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!since) return null;
  const startMs = new Date(since).getTime();
  if (Number.isNaN(startMs)) return null;

  // A FINISHED run has a duration, not an elapsed time. Counting to `now`
  // regardless of `until` meant a completed run kept ticking forever and
  // reported how long ago it started rather than how long it took —
  // observed reporting "2h 58m" for a run that failed after 4m 18s, which
  // sent a real investigation looking for a timeout that never happened.
  const endMs = !active && until ? new Date(until).getTime() : now;
  const safeEndMs = Number.isNaN(endMs) ? now : endMs;

  return (
    <span
      className="flex items-center gap-1.5 text-xs font-mono text-slate-500 tabular-nums"
      title={active ? 'Time since this run started' : 'Total run duration'}
    >
      <Clock size={12} className={active ? 'text-orange-500' : 'text-slate-400'} />
      {fmtElapsed(safeEndMs - startMs)}
    </span>
  );
}
