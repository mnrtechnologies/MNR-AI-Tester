import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";
import { dashboardEndpoints } from "../api";

const { GET_SUPER_ADMIN_DASHBOARD_STATS_API,GET_COMPANY_ADMIN_DASHBOARD_STATS_API } = dashboardEndpoints;

export const getSuperAdminDashboardStats = async () => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "GET",
      GET_SUPER_ADMIN_DASHBOARD_STATS_API,
      null,
      { Authorization: `Bearer ${token}` }
    );

   // console.log("GET_DASHBOARD_STATS_API RESPONSE:", response);

    // FIX 1: Check if the response IS the data (based on your logs)
    // We check for a known key like 'totalUsers' or 'totalSchools'
    if (response?.data && response.data.totalUsers !== undefined) {
      return response.data;
    }

    // FIX 2: Check for the standard { success: true, data: ... } wrapper
    if (response?.data?.success) {
      return response.data.data;
    }

    // FIX 3: If we reach here, it failed. 
    // We must pass a STRING to toast.error, not the whole object.
    const errorMessage = response?.data?.message || "Failed to load dashboard stats";
    toast.error(errorMessage);
    
    return null;

  } catch (error) {
    console.error("GET DASHBOARD STATS API ERROR:", error);
    // FIX 4: Safety check on the error message
    const errorMsg = error?.response?.data?.message || "Server error";
    toast.error(errorMsg);
    return null;
  }
};

export const getCompanyAdminDashboardStats = async () => {
  const token = JSON.parse(localStorage.getItem("token"));
  
  try {
    const response = await apiConnector(
      "GET",
      GET_COMPANY_ADMIN_DASHBOARD_STATS_API,
      null,
      { Authorization: `Bearer ${token}` }
    );

    // Based on your response payload, we check for the standard { success: true, data: ... } wrapper
    if (response?.data?.success) {
      return response.data.data;
    }

    // If success is false or missing, handle it as an error
    const errorMessage = response?.data?.message || "Failed to load company dashboard stats";
    toast.error(errorMessage);
    
    return null;

  } catch (error) {
    console.error("GET COMPANY DASHBOARD STATS API ERROR:", error);
    // Safety check on the error message
    const errorMsg = error?.response?.data?.message || "Server error while fetching company stats";
    toast.error(errorMsg);
    return null;
  }
};