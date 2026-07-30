import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";
import { subscriptionEndpoints } from "../api";
const {
  ACTIVATE_SUBSCRIPTION_API,
  RENEW_SUBSCRIPTION_API,
  EXPIRE_SUBSCRIPTION_API,
  GET_SUBSCRIPTION_BY_ID_API,
} = subscriptionEndpoints;

// GET SUBSCRIPTION BY ID
export const getSubscriptionById = async (subscriptionId) => {
  console.log("subid",subscriptionId)
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "GET",
      `${GET_SUBSCRIPTION_BY_ID_API}/${subscriptionId}`,
      null,
      { Authorization: `Bearer ${token}` },
    );

    if (response.data.success) {
      return response.data.subscription; // return full details
    }

    toast.error(response.data.message || "Failed to fetch subscription");
    return null;
  } catch (error) {
    console.error("GET SUBSCRIPTION BY ID API ERROR:", error?.response?.data);
    toast.error(error?.response?.data?.message || "Server error");
    return null;
  }
};

// ---------------------------------------------------------------------
// ACTIVATE SUBSCRIPTION (Super Admin Only)
// ---------------------------------------------------------------------
export const activateSubscription = async (data) => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "POST",
      ACTIVATE_SUBSCRIPTION_API,
      data,
      { Authorization: `Bearer ${token}` },
    );

    if (response.data.success) {
      toast.success("Subscription activated successfully");
      return response.data.subscription;
    }

    toast.error(response.data.message || "Failed to activate subscription");
    return null;
  } catch (error) {
    console.error("ACTIVATE SUBSCRIPTION API ERROR:", error?.response?.data);
    toast.error(error?.response?.data?.message || "Server error");
    return null;
  }
};

// ---------------------------------------------------------------------
// RENEW SUBSCRIPTION (Super Admin Only)
// ---------------------------------------------------------------------
export const renewSubscription = async (payload) => {
  const token = JSON.parse(localStorage.getItem("token"));
  try {
    // payload: { companyId, newEndDate, planType, tierKey, customCredits?,
    //            customPriceUsd?, rolloverPolicy? }
    const response = await apiConnector(
      "PUT",
      RENEW_SUBSCRIPTION_API,
      payload,
      { Authorization: `Bearer ${token}` },
    );

    if (response.data.success) {
      toast.success("Subscription renewed successfully");
      return response.data.subscription;
    }

    toast.error(response.data.message || "Failed to renew subscription");
    return null;
  } catch (error) {
    console.error("RENEW SUB API ERROR:", error);
    toast.error(error?.response?.data?.message || "Server error");
    return null;
  }
};

// ---------------------------------------------------------------------
// EXPIRE SUBSCRIPTION (Super Admin Only)
// ---------------------------------------------------------------------
export const expireSubscription = async (companyId) => {
  const token = JSON.parse(localStorage.getItem("token"));

  try {
    const response = await apiConnector(
      "PUT",
      EXPIRE_SUBSCRIPTION_API,
      { companyId },
      { Authorization: `Bearer ${token}` },
    );

    if (response.data.success) {
      toast.success("Subscription expired successfully");
      return response.data.subscription;
    }

    toast.error(response.data.message || "Failed to expire subscription");
    return null;
  } catch (error) {
    console.error("EXPIRE SUB API ERROR:", error?.response?.data);
    toast.error(error?.response?.data?.message || "Server error");
    return null;
  }
};

// The `incrementTestUsage` thunk that used to live here has been removed.
// It called POST /subscription/usage/increment (now 410 Gone) and dispatched
// `incrementUsageCount`, which wrote to a Redux field the backend never sent —
// so it was doubly dead. Metering now goes through
// src/services/operations/creditAPIs.js.
