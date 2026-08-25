import { useEffect, useRef, useState, useCallback } from 'react';
import { wsUrl } from '../api';

// Hard caps on retained history — without these, `logs` and each phase's
// `samples` grow forever for the lifetime of the WS connection. Confirmed
// happening in practice: a long-running load phase (updates every 1.5-3s)
// eventually grew these arrays large enough to exhaust the tab's memory
// (a DataCloneError out of `performance.measure`, thrown from deep inside
// React's own commit phase, was the actual symptom). This isn't just a
// long-load-test problem either — soak phases are designed to run for
// hours, so unbounded growth here was always going to crash eventually.
// Trimming to the most recent N entries is also the right UX, not just a
// memory fix: a live chart/log only ever needs to show recent history.
const MAX_LOGS = 500;
const MAX_SAMPLES_PER_PHASE = 400; // 400 * 3s tick ~= 20min of visible history
const MAX_DISCOVERED_ENDPOINTS = 200; // generous — real runs have seen single digits to a few dozen

// The backend pushes a `status` message every 1.5s UNCONDITIONALLY, for the
// entire lifetime of a run — over a 20min load phase that's 800+ messages,
// even though phase/status/phase_label are identical for most of them (only
// `progress` fields move, and even those don't always). Capping array sizes
// (above) bounds payload SIZE, but does nothing about render FREQUENCY —
// confirmed in practice that the size cap alone wasn't enough to prevent the
// same out-of-memory crash, because React 19's dev-mode component
// performance tracking (`performance.measure()` on every render, never
// cleared) accumulates in the browser's own Performance buffer regardless
// of state size. Skipping the state update entirely when nothing meaningful
// changed removes most of the redundant re-renders at the source.
const PROGRESS_ROUND = (p) => Math.round((p?.pct_complete ?? 0) * 10) / 10;
const statusesEqual = (a, b) =>
  !!a && !!b && a.status === b.status && a.phase === b.phase && a.phase_label === b.phase_label
  && PROGRESS_ROUND(a.progress) === PROGRESS_ROUND(b.progress);

// Defensive workaround for the same root cause: periodically clear the
// browser's own Performance-entries buffer so it can never grow unbounded
// over a long-running test, regardless of what's adding marks/measures to
// it (React's dev instrumentation isn't something this app's code controls).
const PERF_BUFFER_CLEAR_INTERVAL_MS = 30000;

/**
 * Opens the backend's per-run WebSocket (/ws/perf/{run_id}) and accumulates
 * everything it pushes — logs, status/phase, and live metric samples — into
 * plain state. Same raw-WebSocket lifecycle shape already used elsewhere in
 * this app for a run's live feed (see src/hooks/useLiveUsage.js), just
 * pointed at the Python performance-testing backend instead of the Node one.
 *
 * One connection per run. Closes and reconnects automatically when `runId`
 * changes; closes for good on unmount or once the backend sends `done`.
 */
export default function usePerfRunSocket(runId) {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  // { [phase]: [{t, vus, rps, p95_ms, error_rate_pct}, ...] }
  const [metricsByPhase, setMetricsByPhase] = useState({});
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [done, setDone] = useState(false);
  const wsRef = useRef(null);
  const lastStatusRef = useRef(null);

  const reset = useCallback(() => {
    setLogs([]);
    setStatus(null);
    setMetricsByPhase({});
    setDiscoveredEndpoints([]);
    setConnectionError(null);
    setDone(false);
    lastStatusRef.current = null;
  }, []);

  useEffect(() => {
    if (!runId) return undefined;
    reset();

    let closedByUs = false;
    let finished = false;      // backend sent `done` — stop reconnecting for good
    let attempt = 0;
    let reconnectTimer = null;

    const connect = () => {
      let ws;
      try {
        ws = new WebSocket(wsUrl(runId));
      } catch (e) {
        setConnectionError(e.message);
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnectionError(null);
        // The backend replays a run's ENTIRE history on every new
        // connection (see ws_run: last_log_index/last_metric_index start at
        // 0 per socket), so anything already accumulated locally would be
        // duplicated by the replay. Clearing here and letting the replay
        // rebuild is what makes reconnecting safe rather than additive.
        reset();
      };

      ws.onmessage = onMessage;

      ws.onerror = () => {
        // Only surface an error if this wasn't our own teardown; the real
        // decision about retrying happens in onclose, which always follows.
        if (!closedByUs && !finished) setConnectionError('Lost connection to the live run feed — reconnecting…');
      };

      ws.onclose = () => {
        // A dropped feed used to be terminal: there was no onclose handler
        // and no retry, so one network blip (or a proxy/idle timeout) left
        // the page frozen for the rest of the run with no way back except a
        // manual reload. Load phases run for minutes and soak phases for
        // hours, so a single drop losing the whole live view was a matter of
        // time — confirmed happening in practice mid load phase while the
        // run itself was perfectly healthy server-side.
        if (closedByUs || finished) return;
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (closedByUs || finished) return;
      attempt += 1;
      // 1s, 2s, 4s, 8s, then hold at 10s — keeps retrying for as long as the
      // run could still be alive, without hammering a backend that's down.
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      setConnectionError(`Lost connection to the live run feed — reconnecting (attempt ${attempt})…`);
      reconnectTimer = setTimeout(connect, delay);
    };

    const onMessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === 'logs') {
        setLogs((prev) => [...prev, ...msg.logs].slice(-MAX_LOGS));
      } else if (msg.type === 'status') {
        const next = { status: msg.status, phase: msg.phase, phase_label: msg.phase_label, progress: msg.progress };
        if (!statusesEqual(lastStatusRef.current, next)) {
          lastStatusRef.current = next;
          setStatus(next);
        }
      } else if (msg.type === 'metrics') {
        setMetricsByPhase((prev) => ({
          ...prev,
          [msg.phase]: [...(prev[msg.phase] || []), ...msg.samples].slice(-MAX_SAMPLES_PER_PHASE),
        }));
      } else if (msg.type === 'endpoints') {
        setDiscoveredEndpoints((prev) => [...prev, ...msg.endpoints].slice(-MAX_DISCOVERED_ENDPOINTS));
      } else if (msg.type === 'error') {
        setConnectionError(msg.message);
      } else if (msg.type === 'done') {
        finished = true;
        setDone(true);
      }
    };

    connect();

    // Belt-and-suspenders alongside the status-dedup above: even a render
    // count we've minimized still adds marks/measures we don't control
    // (React's own dev-mode instrumentation), and nothing else in the page
    // ever clears them. Bounding the browser's Performance buffer directly
    // means a long-running test can't hit this OOM again regardless of
    // render volume.
    const perfClearInterval = setInterval(() => {
      try {
        performance.clearMarks();
        performance.clearMeasures();
      } catch { /* not fatal if the browser refuses — just means it repeats sooner */ }
    }, PERF_BUFFER_CLEAR_INTERVAL_MS);

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
      clearInterval(perfClearInterval);
    };
  }, [runId, reset]);

  return { logs, status, metricsByPhase, discoveredEndpoints, connectionError, done, reset };
}
