import axios from "axios";

// 1. Create a configured instance
export const axiosInstance = axios.create({
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 2. Request Interceptor (FIXED)
axiosInstance.interceptors.request.use((config) => {
  let token = localStorage.getItem("token"); 
  
  if (token) {
    // This regex removes the extra double quotes added by JSON.stringify
    token = token.replace(/^"|"$/g, '');
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || "";
    const isLoginRequest = requestUrl.includes("login");

    if (error.response?.status === 401 && !isLoginRequest) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        window.location.href = "/login"; 
      }
    }
    
    return Promise.reject(error);
  }
);

// 4. Simplified Connector
export const apiConnector = (method, url, bodyData = null, headers = {}, params = null) => {
  return axiosInstance({
    method: method.toLowerCase(),
    url: url,
    data: bodyData,
    headers: headers,
    params: params,
  });
};