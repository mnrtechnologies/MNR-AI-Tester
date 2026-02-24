import axios from "axios";

export const axiosInstance = axios.create({
 
  baseURL: process.env.REACT_APP_AUTH_URL, 
});


axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiConnector = (method, url, bodyData, headers, params) => {
  return axiosInstance({
    method: method,
    url: url,
    data: bodyData || null,
    headers: headers || null,
    params: params || null,
  });
};