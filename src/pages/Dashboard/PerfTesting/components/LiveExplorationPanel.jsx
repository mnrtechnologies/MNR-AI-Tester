import React, { useEffect, useRef, useState } from 'react';
import { Eye, Minimize2, Maximize2 } from 'lucide-react';

/**
 * What the engine is looking at, right now — and everything it looked at
 * before.
 *
 * A feature-journey run spends several minutes exploring the target before it
 * has anything to report, and until now that time showed only "Discovering
 * endpoints…" sitting still. The crawler was already screenshotting every step
 * to feed its vision model and throwing every frame away; the backend now
 * publishes them (redis_store.push_screenshot) and they arrive here over the
 * same run socket as logs and endpoints.
 *
 * Two frames per step reach us: one taken while observing, one after the
 * action. The second is the informative one — it shows what the click actually
 * did — so it carries `action` and the model's own `reasoning`, and this panel
 * surfaces the most recent frame that has them rather than whichever arrived
 * last.
 *
 * Every frame of the run stays browsable in the strip, not just the newest
 * few: watching the agent work is only half of it — being able to go back and
 * see WHAT it did on a feature is how you tell a real finding from a misclick.
 */
export default function LiveExplorationPanel({ screenshots, wide = false, onToggleSize }) {
  const [selected, setSelected] = useState(null);
  const [zoomed, setZoomed] = useState(null);
  const stripRef = useRef(null);

  // Follow the live edge unless the user has deliberately pinned a frame.
  useEffect(() => {
    setSelected(null);
  }, [screenshots.length]);

  // Keep the newest thumbnail in view as frames arrive — but never yank the
  // strip while the user is looking at an earlier frame.
  useEffect(() => {
    if (selected !== null || !stripRef.current) return;
    stripRef.current.scrollLeft = stripRef.current.scrollWidth;
  }, [screenshots.length, selected]);

  // Escape closes the zoom. Bound on the document rather than the overlay so
  // it works regardless of what holds focus when the frame opens.
  useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setZoomed(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoomed]);

  if (!screenshots || screenshots.length === 0) return null;

  const current = selected !== null
    ? screenshots.find((s) => s.seq === selected) || screenshots[screenshots.length - 1]
    : screenshots[screenshots.length - 1];

  // The caption comes from the newest frame that describes an action, so it
  // does not blank out on the observe frame that follows one.
  const captioned = [...screenshots].reverse().find((s) => s.action) || null;
  const caption = selected !== null ? current : captioned;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Eye size={14} className="text-orange-500" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Live Exploration
        </p>
        <span className="ml-auto text-[11px] font-mono text-slate-400">
          {selected !== null
            ? `frame ${current.seq} of ${screenshots[screenshots.length - 1].seq}`
            : `frame ${current.seq}`}
        </span>
        {onToggleSize && (
          <button
            type="button"
            onClick={onToggleSize}
            title={wide ? 'Shrink to the side panel' : 'Expand to full width'}
            className="text-slate-400 hover:text-slate-600 transition-colors rounded p-0.5
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {wide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border-b border-slate-200">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="ml-2 text-[10px] font-mono text-slate-500 truncate">
            {current.url || '—'}
          </span>
        </div>
        {current.image ? (
          // Click to open full size. Even at full width the frame is a
          // downscale of a 1400x900 capture, which is fine for seeing WHERE
          // the agent is but not for reading the page it is on.
          <button
            type="button"
            onClick={() => setZoomed(current)}
            title="Click to view full size"
            className="block w-full cursor-zoom-in focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <img
              src={`data:image/jpeg;base64,${current.image}`}
              alt={current.action || `Exploration step ${current.step}`}
              // Capped in `wide` mode so a full-width frame cannot grow taller
              // than the screen and push everything else out of view.
              className={`block w-full object-cover object-top ${
                wide ? 'max-h-[60vh] aspect-auto' : 'aspect-[16/10]'}`}
            />
          </button>
        ) : (
          <div className="w-full aspect-[16/10] flex items-center justify-center text-xs text-slate-400">
            Waiting for the first frame…
          </div>
        )}
      </div>

      {caption?.action && (
        <div className="mt-3 flex gap-3 items-start p-3 rounded-xl bg-orange-50 border border-orange-100">
          <span className="text-[11px] font-mono text-orange-600 pt-0.5 shrink-0">
            {caption.step}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 break-words">
              {caption.action}
            </p>
            {caption.reasoning && (
              <p className="text-xs text-slate-500 mt-0.5">{caption.reasoning}</p>
            )}
          </div>
        </div>
      )}

      {screenshots.length > 1 && (
        <>
          <div className="flex items-center gap-2 mt-3 mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              All frames <span className="text-slate-300">{screenshots.length}</span>
            </p>
            {selected !== null && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[10px] font-semibold text-orange-500 hover:text-orange-600"
              >
                Back to live
              </button>
            )}
          </div>
          {/* Horizontally scrollable so every frame of the run stays reachable,
              rather than only the newest handful. */}
          <div ref={stripRef} className="flex gap-1.5 overflow-x-auto pb-1">
            {screenshots.map((s) => (
              <button
                key={s.seq}
                type="button"
                onClick={() => setSelected(s.seq === current.seq ? null : s.seq)}
                title={s.action || `Step ${s.step}`}
                className={`shrink-0 rounded-md overflow-hidden border transition
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400
                  ${s.seq === current.seq
                    ? 'border-orange-400 ring-1 ring-orange-200'
                    : 'border-slate-200 hover:border-slate-300'}`}
                style={{ width: wide ? 108 : 84 }}
              >
                <img
                  src={`data:image/jpeg;base64,${s.image}`}
                  alt={s.action || `Step ${s.step}`}
                  className="block w-full aspect-[16/10] object-cover object-top"
                />
              </button>
            ))}
          </div>
        </>
      )}

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Exploration frame, full size"
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm
                     flex items-center justify-center p-6 cursor-zoom-out"
        >
          <div className="max-w-[95vw] max-h-[92vh] flex flex-col gap-2"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-white/90 text-xs font-mono">
              <span className="truncate">{zoomed.url}</span>
              <button
                type="button"
                onClick={() => setZoomed(null)}
                className="ml-auto shrink-0 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20
                           transition-colors font-sans font-semibold"
              >
                Close
              </button>
            </div>
            <img
              src={`data:image/jpeg;base64,${zoomed.image}`}
              alt={zoomed.action || `Exploration step ${zoomed.step}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
            />
            {zoomed.action && (
              <p className="text-white/80 text-sm">
                <span className="font-mono text-white/50 mr-2">{zoomed.step}</span>
                {zoomed.action}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
