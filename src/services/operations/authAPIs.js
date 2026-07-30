import { toast } from "react-hot-toast";
import { setLoading, setToken } from "../../slices/authSlice";
import { setUser } from "../../slices/profileSlice";
import { apiConnector } from "../apiConnector";
import { endpoints } from "../api";
import socket from "../../utils/socket";

const ensureSocketConnected = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

const {
  LOGIN_API,

  RESETPASSTOKEN_API,
  RESET_PASSWORD_API,

  GET_USER_DETAILS_API,
  UPDATE_INFO_API,
  CHANGED_PASSWORD_API,

  REGISTER_API,
  GET_ALL_USERS_API,
  EDIT_USER_API,
  DELETE_USER_API,

  GET_COMPANY_ALL_STAFF_API,
  GET_COMPANY_USER_DETAILS_API,
  GET_USER_BY_ID_API
} = endpoints;

//login
export function login(email, password, navigate) {
  return async (dispatch) => {
    const toastId = toast.loading("Loading...");
    dispatch(setLoading(true));
    try {
      const response = await apiConnector("POST", LOGIN_API, {
        email,
        password,
      });

      // console.log("SIGNin API RESPONSE............", response);

      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      toast.success("Signin Successful");

      dispatch(setToken(response.data.token));

      dispatch(setUser({ ...response.data.user }));
      localStorage.setItem("token", JSON.stringify(response.data.token));
      ensureSocketConnected();
      socket.auth = {
        token: response.data.token,
      };

      socket.connect();
      navigate("/dashboard");
    } catch (error) {
      // A network failure (server down, CORS refusal, DNS) has no `response`
      // at all, so reaching straight for error.response.data threw its own
      // TypeError and buried the real cause.
      const message = error?.response?.data?.message;
      const isNetworkError = !error?.response;

      toast.error(
        message ||
          (isNetworkError
            ? "Cannot reach the server. Check that the API is running and REACT_APP_AUTH_URL is correct."
            : "Sign in failed. Please try again.")
      );

      // Stay on the login page. Bouncing to /signup hid the error and led
      // nowhere useful — accounts here are created by an administrator.
      console.error("Login failed:", error);
    }
    dispatch(setLoading(false));
    toast.dismiss(toastId);
  };
}


export function getUserDetails() {
  return async (dispatch) => {
    dispatch(setLoading(true));
    try {
      const token = JSON.parse(localStorage.getItem("token"));

      const response = await apiConnector("GET", GET_USER_DETAILS_API, null, {
        Authorization: `Bearer ${token}`,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const userData = response.data.user;
      dispatch(setUser(userData));
      return true;
    } catch (error) {
      // console.log("GET_USER_DETAILS ERROR:", error);
      toast.error("Failed to fetch user details");
      localStorage.removeItem("token");
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  };
}

export function getPasswordResetToken(email, setEmailSent) {
  return async (dispatch) => {
    const toastId = toast.loading("Loading...");
    dispatch(setLoading(true));
    try {
      const response = await apiConnector("POST", RESETPASSTOKEN_API, {
        email,
      });

      //  console.log("RESETPASSTOKEN RESPONSE............", response);

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      toast.success("Reset Email Sent");
      setEmailSent(true);
    } catch (error) {
      // console.log("RESETPASSTOKEN ERROR............", error);
      toast.error("Failed To Send Reset Email");
    }
    toast.dismiss(toastId);
    dispatch(setLoading(false));
  };
}

export function resetPassword(password, confirmPassword, token, navigate) {
  return async (dispatch) => {
    const toastId = toast.loading("Loading...");
    dispatch(setLoading(true));
    try {
      const response = await apiConnector("POST", RESET_PASSWORD_API, {
        password,
        confirmPassword,
        token,
      });

      // console.log("RESETPASSWORD RESPONSE............", response);

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      toast.success("Password Reset Successfully");
      navigate("/login");
    } catch (error) {
      // console.log("RESETPASSWORD ERROR............", error);
      toast.error("Failed To Reset Password");
    }
    toast.dismiss(toastId);
    dispatch(setLoading(false));
  };
}

// change password
export function changePassword(
  oldPassword,
  newPassword,
  confirmPassword,
  onSuccess,
) {
  return async (dispatch) => {
    const toastId = toast.loading("Changing password...");
    try {
      // Send all 3 fields matching the backend req.body
      const response = await apiConnector("POST", CHANGED_PASSWORD_API, {
        oldPassword,
        newPassword,
        confirmPassword,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      toast.success(response.data.message || "Password changed successfully");

      // Call optional success callback to clear form
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to change password",
      );
    } finally {
      toast.dismiss(toastId);
    }
  };
}

export function updateBasicInfo(
  { name, email, mobile, country, state, city },
  onSuccess,
) {
  return async (dispatch) => {
    const toastId = toast.loading("Updating profile...");

    try {
      // The interceptor automatically handles the Authorization header,
      // so we just need to pass the method, URL, and the body data.
      const response = await apiConnector("PUT", UPDATE_INFO_API, {
        name,
        email,
        mobile,
        country,
        state,
        city,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      // Update the Redux store with the fresh user data returned from the backend
      dispatch(setUser(response.data.data));

      // Show the success message sent from the backend ("User profile updated successfully")
      toast.success(response.data.message || "Profile updated");

      if (onSuccess) {
        onSuccess(response.data.data);
      }
    } catch (error) {
      console.error("UPDATE_BASIC_INFO ERROR:", error);
      toast.error(error?.response?.data?.message || "Failed to update profile");
    } finally {
      toast.dismiss(toastId);
    }
  };
}

export function logout(navigate) {
  return (dispatch) => {
    socket.disconnect();
    dispatch(setToken(null));
    dispatch(setUser(null));
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged Out");
    navigate("/");
  };
}

//Admin functions

//register user
export function register(
  name,
  email,
  password,
  confirmPassword,
  mobile,
  country,
  state,
  city,
  role,
  companyId, 
  navigate,
  returnPath
) {
  return async (dispatch) => {
    const toastId = toast.loading("Processing Registration...");
    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      
      const token = JSON.parse(localStorage.getItem("token"));
      
      const response = await apiConnector(
        "POST",
        REGISTER_API,
        {
          name,
          email,
          password,
          confirmPassword,
          mobile,
          country,
          state,
          city,
          role,
          companyId, // <--- ADDED TO PAYLOAD
        },
        {
          Authorization: `Bearer ${token}`,
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      
      toast.success(response.data.message || "Register Successful");


      navigate(returnPath || "/dashboard");
    } catch (error) {
      console.error("REGISTRATION API ERROR............", error);
      toast.error(
        error?.response?.data?.message || error?.message || "Signup Failed",
      );
    }
    toast.dismiss(toastId);
  };
}

//get all users
export function getAllUsers() {
  return async (dispatch) => {
    try {
      const token = JSON.parse(localStorage.getItem("token"));
      const response = await apiConnector("GET", GET_ALL_USERS_API, null, {
        Authorization: `Bearer ${token}`,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      return response.data.users;
    } catch (error) {
      // console.error("GET_ALL_USERS ERROR:", error);
      return [];
    }
  };
}

//edit user
export function editUser(userId, updatedData, onSuccess) {
  return async (dispatch) => {
    const toastId = toast.loading("Updating user...");
    //dispatch(setLoading(true));
    try {
      const token = JSON.parse(localStorage.getItem("token"));
      const response = await apiConnector(
        "PUT",
        EDIT_USER_API(userId),
        updatedData,
        {
          Authorization: `Bearer ${token}`,
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      toast.success("User updated successfully");
      onSuccess && onSuccess(response.data.user); // Optional callback
    } catch (error) {
      //  console.error("EDIT_USER ERROR:", error);
      toast.error(error?.response?.data?.message || "Failed to update user");
    }
    toast.dismiss(toastId);
    // dispatch(setLoading(false));
  };
}

//delete user
export function deleteUser(userId, onSuccess) {

  return async (dispatch) => {
    const toastId = toast.loading("Deleting user...");
    //dispatch(setLoading(true));
    try {
      const token = JSON.parse(localStorage.getItem("token"));
     
      const response = await apiConnector(
        "DELETE",
        DELETE_USER_API(userId),
        {},
        {
          Authorization: `Bearer ${token}`,
        },
      );
    

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      toast.success("User deleted successfully");
      onSuccess && onSuccess(); // Optional callback to refresh UI
    } catch (error) {
      // console.error("DELETE_USER ERROR:", error);
      toast.error(error?.response?.data?.message || "Failed to delete user");
    }
    toast.dismiss(toastId);
    // dispatch(setLoading(false));
  };
}


// get user id
export function getUserById(userid) {
  return async (dispatch) => {
    //const toastId = toast.loading("Loading...");
    dispatch(setLoading(true));

    try {
      const response = await apiConnector("POST", GET_USER_BY_ID_API, {
        userid,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      return response.data.user;
      //console.log("response",response)
    } catch (error) {
     // toast.error("Fail To Fetched");
    }

    //  toast.dismiss(toastId);
    dispatch(setLoading(false));
  };
}

// get all Company data
export function getAllCompanyUsers() {
  return async (dispatch) => {
    const token = JSON.parse(localStorage.getItem("token"));
    try {
      const response = await apiConnector("GET", GET_COMPANY_USER_DETAILS_API, null, {
        Authorization: `Bearer ${token}`,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      
      console.log("company users", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching company users:", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to fetch company users. Please login again."
      );
    }
  };
}

// get company staff (and admins)
export function getCompanyAllStaff() {
  return async (dispatch) => {
    try {
      const token = JSON.parse(localStorage.getItem("token"));
      
      const response = await apiConnector("GET", GET_COMPANY_ALL_STAFF_API, null, {
        Authorization: `Bearer ${token}`,
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      
      // Return the combined personnel roster, fallback to empty array if undefined
      return response.data.staff || []; 
      
    } catch (error) {
      console.error("GET_COMPANY_ALL_STAFF_API ERROR:", error?.response?.data || error.message);
      // If you are using react-hot-toast, you can uncomment the line below to alert the user
      // toast.error(error?.response?.data?.message || "Failed to fetch company personnel");
      return []; // Always return an array to prevent .map() crashes in the UI
    }
  };
}
