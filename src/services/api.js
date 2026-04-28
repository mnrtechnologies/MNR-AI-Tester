const BASE_URL = process.env.REACT_APP_AUTH_URL;
//const AI_BASE_URL = process.env.REACT_APP_AI_TESTER_BACKEND_URL ;

const AUTH_PATH = `${BASE_URL}/auth`;

export const endpoints = {
  // AUTH (Public)
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


  GET_COMPANY_ALL_STAFF_API: `${AUTH_PATH}/get-company-staff`,
  GET_COMPANY_USER_DETAILS_API: `${AUTH_PATH}/get-company-user-details`,
  GET_USER_BY_ID_API: `${AUTH_PATH}/get-user-by-id`,

};

export const projectsEndpoints = {
  GET_USER_SESSIONS_API: `${BASE_URL}/projects/get-user-sessions`,
};

export const companyEndpoints = {
  CREATE_COMPANY_API: BASE_URL + "/company/add-company",
  GET_COMPANY_BY_ID_API: BASE_URL + "/company/get-company-details",
  GET_COMPANIES_API: BASE_URL + "/company/get-all-companies",
  EDIT_COMPANY_API: BASE_URL + "/company/edit-company-details",
  DELETE_COMPANY_API: BASE_URL + "/company/delete-company",
  ADD_COMPANY_ADMIN_API: BASE_URL + "/company/add-company-admin",
};

export const dashboardEndpoints = {
  GET_SUPER_ADMIN_DASHBOARD_STATS_API: BASE_URL + "/dashboard/get-super-admin-dashboard-stats",
  GET_COMPANY_ADMIN_DASHBOARD_STATS_API: BASE_URL + "/dashboard/get-company-admin-dashboard-stats",
  
};

export const subscriptionEndpoints = {
  ACTIVATE_SUBSCRIPTION_API: BASE_URL + "/subscription/activate",
  RENEW_SUBSCRIPTION_API: BASE_URL + "/subscription/renew",
  EXPIRE_SUBSCRIPTION_API: BASE_URL + "/subscription/expire",
  GET_SUBSCRIPTION_BY_ID_API: BASE_URL + "/subscription/get-subscription-by-id",

  INCREMENT_TEST_USAGE_API: `${BASE_URL}/subscription/usage/increment`,
};
