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
  SIGNUP_API,

  RESETPASSTOKEN_API,
  RESET_PASSWORD_API,

  GET_USER_DETAILS_API,
  UPDATE_INFO_API,
  GET_ALL_USERS_API,
  CHANGED_PASSWORD_API,
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
      //console.log("SIGNin API ERROR............", error);
      toast.error(error.response.data.message);
      navigate("/signup");
    }
    dispatch(setLoading(false));
    toast.dismiss(toastId);
  };
}

//signup no auth require
export function signUp(
  name,
  email,
  password,
  confirmPassword,
  mobile,
  navigate,
) {
  return async (dispatch) => {
    const toastId = toast.loading("Loading...");
    // dispatch(setLoading(true));
    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const response = await apiConnector("POST", SIGNUP_API, {
        name,
        email,
        password,
        confirmPassword,
        mobile,
      });

      // console.log("SIGNUP API RESPONSE............", response);

      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      toast.success("Signup Successful");
      navigate("/login");
    } catch (error) {
      // console.log("SIGNUP API ERROR............",error);
      toast.error(
        error?.response?.data?.message || error?.message || "Signup Failed",
      );
    }
    //spatch(setLoading(false));
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

//get all users
export function getAllUsers() {
  return async (dispatch) => {
    try {
      // Don't pass headers manually!
      // The apiConnector (axiosInstance) adds them automatically via interceptors.
      const response = await apiConnector("GET", GET_ALL_USERS_API);

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      return response.data.users;
    } catch (error) {
      console.error("GET_ALL_USERS ERROR:", error);
      return [];
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
