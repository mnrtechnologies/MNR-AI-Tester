import { useState, useEffect } from "react";
import { api } from "../services/api";

export function useTestManager() {
  const [testId, setTestId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [lastAction, setLastAction] = useState(""); // New field
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const startTest = async (config) => {
    try {
      setError(null);
      setReport(null);
      setLastAction(""); // Reset
      const data = await api.startTest(config.mode, config.url, config.goal);
      setTestId(data.test_id);
      setStatus("running");
    } catch (err) {
      setError("Failed to start test. Check backend connection.");
      console.error(err);
    }
  };

  // Poll for status
  useEffect(() => {
    if (!testId || status === "completed") return;

    const poll = setInterval(async () => {
      try {
        const data = await api.getStatus(testId);
        
        // Update status and last action safely
        if (data) {
          setStatus(data.status);
          if (data.last_action) setLastAction(data.last_action);
          
          if (data.status === "completed") {
            clearInterval(poll);
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [testId, status]);

  // Fetch report on completion
  useEffect(() => {
    if (status === "completed" && testId && !report) {
      api.getReport(testId)
        .then((data) => {
          if (data) setReport(data);
        })
        .catch(console.error);
    }
  }, [status, testId, report]);

  return { testId, status, lastAction, report, error, startTest };
}