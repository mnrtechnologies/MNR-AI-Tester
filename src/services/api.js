const BASE_URL = process.env.REACT_APP_AUTH_URL;
//const AI_BASE_URL = process.env.REACT_APP_AI_TESTER_BACKEND_URL ;

const AUTH_PATH = `${BASE_URL}/auth`;

export const endpoints = {
  // AUTH (Public)
  SIGNUP_API: `${AUTH_PATH}/signup`,
  LOGIN_API: `${AUTH_PATH}/login`,

  // PASSWORD RESET (Public)
  RESETPASSTOKEN_API: `${AUTH_PATH}/reset-password-token`,
  RESET_PASSWORD_API: `${AUTH_PATH}/reset-password`,

  // USER PROFILE (Protected - Requires Auth Middleware)
  GET_USER_DETAILS_API: `${AUTH_PATH}/getUserDetails`,
  UPDATE_INFO_API: `${AUTH_PATH}/update-profile`,
  CHANGED_PASSWORD_API: `${AUTH_PATH}/change-password`,

  //Admin
  REGISTER_API: `${AUTH_PATH}/register`,
  GET_ALL_USERS_API: `${AUTH_PATH}/get-all-users`,
  EDIT_USER_API: (userId) => `${AUTH_PATH}/edit-user/${userId}`,
  DELETE_USER_API: (userId) => `${AUTH_PATH}/delete-user/${userId}`,
};

export const subscriptionEndpoints = {
   
  // SIGNUP_API: `${BASE_URL}/subscription`,

  INCREMENT_TEST_USAGE_API: `${BASE_URL}/subscription/usage/increment`,
};
