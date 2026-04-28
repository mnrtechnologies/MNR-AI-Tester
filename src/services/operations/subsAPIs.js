// Make sure to import your endpoints and the slice action at the top of your file:
import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";
import { subscriptionEndpoints } from "../api";
import { incrementUsageCount } from "../../slices/profileSlice";
const {
  ACTIVATE_SUBSCRIPTION_API,
  RENEW_SUBSCRIPTION_API,
  EXPIRE_SUBSCRIPTION_API,
  GET_SUBSCRIPTION_BY_ID_API,
  INCREMENT_TEST_USAGE_API,
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
export const renewSubscription = async (
  companyId,
  newEndDate,
  newCustomMaxTests,
  newPlan 
) => {
  const token = JSON.parse(localStorage.getItem("token"));
  try {
    const response = await apiConnector(
      "PUT",
      RENEW_SUBSCRIPTION_API,
      // Pass the plan to the backend
      { companyId, newEndDate, newCustomMaxTests, plan: newPlan }, 
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

//increase api usage
export function incrementTestUsage() {
  return async (dispatch) => {
    try {
      // Grab the token from localStorage just like you do in getUserDetails
      const token = JSON.parse(localStorage.getItem("token"));

      // Make the POST request to your standalone increment API
      const response = await apiConnector(
        "POST",
        INCREMENT_TEST_USAGE_API,
        {},
        {
          Authorization: `Bearer ${token}`,
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      // The backend returns the updated testsUsed count.
      // Dispatch this to Redux so the UI (and SubscriptionGuard) updates instantly!
      const newTestsUsed = response.data.data.testsUsed;
      dispatch(incrementUsageCount(newTestsUsed));

      // Return true so your component knows it succeeded
      return true;
    } catch (error) {
      // console.log("INCREMENT_TEST_USAGE API ERROR............", error);

      // If the API throws a 429 Limit Reached or 403 Expired error, show it to the user
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to record test usage",
      );

      return false;
    }
  };
}
