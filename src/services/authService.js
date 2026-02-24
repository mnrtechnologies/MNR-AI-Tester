import axios from "axios";

const AUTH_BASE = process.env.REACT_APP_AUTH_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: AUTH_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: async (userData) => {
    const res = await api.post("/register", userData);
    return res.data;
  },

  login: async (email, password) => {
    const res = await api.post("/login", { email, password });

    if (res.data.success) {
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
    }

    return res.data;
  },

  getUserDetails: async () => {
    const res = await api.get("/getUserDetails");
    return res.data;
  },

  updateProfile: async (profileData) => {
    const res = await api.put("/update-profile", profileData);
    return res.data;
  },

  logout: () => {
    localStorage.clear();
    window.location.href = "/login";
  },
};