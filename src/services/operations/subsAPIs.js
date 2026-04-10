// Make sure to import your endpoints and the slice action at the top of your file:
import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";
import { subscriptionEndpoints } from "../api";
import { incrementUsageCount } from "../../slices/profileSlice";
const { INCREMENT_TEST_USAGE_API } = subscriptionEndpoints;

export function incrementTestUsage() {
  return async (dispatch) => {
    try {
      // Grab the token from localStorage just like you do in getUserDetails
      const token = JSON.parse(localStorage.getItem("token"));

      // Make the POST request to your standalone increment API
      const response = await apiConnector("POST", INCREMENT_TEST_USAGE_API, {}, {
        Authorization: `Bearer ${token}`,
      });

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
        "Failed to record test usage"
      );
      
      return false;
    }
  };
}