import { useCallback, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

/**
 * Accumulate the live spend feed for a run.
 *
 * The engine pushes one `usage` event per model call (tokens, model, action)
 * and one `activity` event per physical action (click, fill, select). Both
 * arrive over the WebSocket the run already uses, so there is no extra
 * connection to manage.
 *
 * Credits are computed CLIENT-SIDE here, at the same published rates the server
 * bills on. That is deliberate: it makes the number move as the agent works
 * rather than jumping every time the billing pass runs. It is a display value —
 * the authoritative balance arrives over `credits:update` and wins.
 *
 * Rates come from /api/credits/account and are only sent to Managed plans, so
 * on a capacity plan this stays inert.
 */
export default function useLiveUsage() {
  const { user } = useSelector((state) => state.profile);
  const rates = user?.creditModelRates;
  const usdPerCredit = user?.usdPerCredit;

  const [live, setLive] = useState(() => emptyState());
  // Held in a ref as well so the WS handler can accumulate without being
  // recreated on every event, which would re-register the socket listener.
  const acc = useRef(emptyState());

  const reset = useCallback(() => {
    acc.current = emptyState();
    setLive(acc.current);
  }, []);

  const costOf = useCallback(
    (evt) => {
      if (!rates?.models || !usdPerCredit) return 0;

      const models = rates.models;
      const rate =
        models[evt.model] ||
        // Unknown model → most expensive configured rate, matching the server.
        Object.values(models).reduce(
          (worst, r) => (!worst || r.outputUsdPerMTok > worst.outputUsdPerMTok ? r : worst),
          null
        );
      if (!rate) return 0;

      const readMult = rates._cacheMultipliers?.read ?? 0.1;
      const writeMult = rates._cacheMultipliers?.write ?? 1.25;

      const usd =
        ((evt.inputTokens || 0) * rate.inputUsdPerMTok +
          (evt.cacheReadTokens || 0) * rate.inputUsdPerMTok * readMult +
          (evt.cacheWriteTokens || 0) * rate.inputUsdPerMTok * writeMult +
          (evt.outputTokens || 0) * rate.outputUsdPerMTok) /
        1_000_000;

      return usd / usdPerCredit;
    },
    [rates, usdPerCredit]
  );

  /** Feed one WS message in. Ignores anything that isn't a meter event. */
  const ingest = useCallback(
    (msg) => {
      if (!msg) return;

      if (msg.type === "usage") {
        const next = acc.current;
        next.calls += 1;
        next.inputTokens += msg.inputTokens || 0;
        next.outputTokens += msg.outputTokens || 0;
        next.credits += costOf(msg);
        next.model = msg.model || next.model;
        next.action = describeAction(msg.action) || next.action;
        acc.current = { ...next };
        setLive(acc.current);
        return;
      }

      if (msg.type === "activity") {
        // A physical action is free but it is what the user recognises, so it
        // takes precedence over the model-call label in the display.
        acc.current = { ...acc.current, action: describeActivity(msg) };
        setLive(acc.current);
      }
    },
    [costOf]
  );

  const enabled = useMemo(() => !!rates?.models && !!usdPerCredit, [rates, usdPerCredit]);

  return { live, ingest, reset, enabled };
}

function emptyState() {
  return {
    calls: 0,
    credits: 0,
    inputTokens: 0,
    outputTokens: 0,
    model: null,
    action: null,
  };
}

/** Turn an internal action label into something a customer can read. */
function describeAction(action) {
  const map = {
    scan_elements: "Scanning the page",
    decide_action: "Deciding what to do next",
    read_state: "Reading the page state",
    write_assertions: "Writing checks",
    write_summary: "Summarising results",
    write_stories: "Writing test stories",
    analyze_page: "Analysing the page",
    analyze_menu: "Analysing navigation",
    normalize_goal: "Interpreting the goal",
    repair_selector: "Recovering from a failed step",
    analyze_goal: "Planning the test",
  };
  return map[action] || null;
}

function describeActivity(msg) {
  const target = msg.target ? ` “${msg.target}”` : "";
  switch (msg.action) {
    case "click":
      return `Clicking${target}`;
    case "fill":
      return `Typing into${target}`;
    case "select":
      return `Choosing an option in${target}`;
    case "upload":
      return `Uploading a file to${target}`;
    default:
      return msg.action ? `${msg.action}${target}` : null;
  }
}
