// src/services/authService.js
const AUTH_BASE = process.env.REACT_APP_AUTH_URL || "http://localhost:4000/api/auth";

// Helper to get the token for protected routes
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const authService = {
  // Public: Register
  register: async (userData) => {
    const res = await fetch(`${AUTH_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    return res.json();
  },

  // Public: Login
  login: async (email, password) => {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem("token", data.token); // Store JWT for protected routes
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  },

  // Protected: Get User Details
  getUserDetails: async () => {
    const res = await fetch(`${AUTH_BASE}/getUserDetails`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Protected: Update Profile
  updateProfile: async (profileData) => {
    const res = await fetch(`${AUTH_BASE}/update-profile`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    });
    return res.json();
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }
};