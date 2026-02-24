// for functional testing

const API_BASE = process.env.REACT_APP_AI_TESTER_BACKEND_URL || "http://localhost:4000";

export const api = {
  startTest: async (mode, url, goal) => {
    const res = await fetch(`${API_BASE}/tests/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, url, goal, steps: [], headless: true }),
    });
    return res.json();
  },

  getStatus: async (testId) => {
    const res = await fetch(`${API_BASE}/tests/${testId}/status`);
    return res.json();
  },

  getReport: async (testId) => {
    const res = await fetch(`${API_BASE}/tests/${testId}/report`);
    return res.json();
  },

  checkWaiting: async (testId) => {
    const res = await fetch(`${API_BASE}/tests/${testId}/waiting`);
    return res.json();
  },

  sendInput: async (testId, elementId, value) => {
    return fetch(`${API_BASE}/tests/${testId}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ element_id: elementId, value }),
    });
  },
};