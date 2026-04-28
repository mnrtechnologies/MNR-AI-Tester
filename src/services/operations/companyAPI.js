import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";

import { companyEndpoints } from "../api";

const {
  GET_COMPANY_BY_ID_API,
  CREATE_COMPANY_API,
  GET_COMPANIES_API,
  EDIT_COMPANY_API,
  DELETE_COMPANY_API,
  ADD_COMPANY_ADMIN_API,
} = companyEndpoints;

// ===================================================================
// GET COMPANY BY ID
// ===================================================================
export const getCompanyById = async (companyId) => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "GET",
      `${GET_COMPANY_BY_ID_API}/${companyId}`,
      null,
      { Authorization: `Bearer ${token}` }
    );

    //console.log("GET COMPANY BY ID API :", response.data.data);
    return response.data.data || null;

  } catch (error) {
    // console.error("GET COMPANY BY ID API ERROR:", error?.response?.data);
    // toast.error(
    //   error?.response?.data?.message || "Unable to fetch company details"
    // );
    return null;
  }
};


// ===================================================================
// CREATE COMPANY
// ===================================================================
export const createCompany = async (formData, navigate) => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "POST",
      CREATE_COMPANY_API,
      formData,
      { Authorization: `Bearer ${token}` }
    );

    if (response.data.success) {
      toast.success("Company created successfully");
      navigate("/dashboard/super-admin/companies-management");
      return true;
    } else {
      toast.error(response.data.message || "Failed to create company");
      return false;
    }
  } catch (error) {
    console.error("CREATE COMPANY API ERROR:", error?.response?.data);
    toast.error(
      error?.response?.data?.message || "Unable to create company"
    );
    return false;
  }
};

// ===================================================================
// GET ALL COMPANIES
// ===================================================================
export const getCompanies = async () => {
  
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "GET",
      GET_COMPANIES_API,
      null,
      { Authorization: `Bearer ${token}` }
    );

    return response.data || [];

  } catch (error) {
    console.error("GET COMPANIES API ERROR:", error?.response?.data);
    toast.error(
      error?.response?.data?.message || "Unable to fetch companies"
    );
    return [];
  }
};

// ===================================================================
// EDIT COMPANY
// ===================================================================
export const editCompany = async (formData) => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "PUT",
      EDIT_COMPANY_API,
      formData,
      { Authorization: `Bearer ${token}` }
    );

    if (response.data.success) {
      toast.success("Company updated successfully");
      return true;
    } else {
      toast.error(response.data.message);
      return false;
    }
  } catch (error) {
    console.error("EDIT COMPANY API ERROR:", error?.response?.data);
    toast.error(
      error?.response?.data?.message || "Unable to edit company"
    );
    return false;
  }
};

// ===================================================================
// DELETE COMPANY
// ===================================================================
export const deleteCompany = async (companyId) => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "DELETE",
      DELETE_COMPANY_API,
      { companyId },
      { Authorization: `Bearer ${token}` }
    );

    if (response.data.success) {
      toast.success("Company deleted successfully");
      return true;
    } else {
      toast.error(response.data.message);
      return false;
    }

  } catch (error) {
    console.error("DELETE COMPANY API ERROR:", error?.response?.data);
    toast.error(
      error?.response?.data?.message || "Failed to delete company"
    );
    return false;
  }
};

// ===================================================================
// ADD COMPANY ADMIN
// ===================================================================
export const addCompanyAdmin = async (formData) => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "POST",
      ADD_COMPANY_ADMIN_API,
      formData,
      { Authorization: `Bearer ${token}` }
    );

    if (response.data.success) {
      toast.success("Company admin created successfully");
      return true;
    } else {
      toast.error(response.data.message);
      return false;
    }

  } catch (error) {
    console.error("ADD COMPANY ADMIN API ERROR:", error?.response?.data);
    toast.error(
      error?.response?.data?.message || "Unable to create company admin"
    );
    return false;
  }
};