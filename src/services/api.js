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
  // INCREMENT_TEST_USAGE_API removed — the flat per-test meter has been
  // replaced by credits (see creditEndpoints). The server returns 410 on the
  // old path for one release so stale bundles get a clear message.
};

export const creditEndpoints = {
  // Public tier tables. Internal cost anchors are stripped server-side.
  GET_PRICING_CONFIG_API: BASE_URL + "/credits/pricing",

  GET_CREDIT_ACCOUNT_API: BASE_URL + "/credits/account",
  GET_CREDIT_ESTIMATE_API: BASE_URL + "/credits/estimate",
  GET_CREDIT_LEDGER_API: BASE_URL + "/credits/ledger",
  // Itemised model spend for one run (Managed meter).
  GET_RUN_USAGE_API: BASE_URL + "/credits/usage",
  // Start-of-run balance check. Applies to both meters.
  CREDIT_PREFLIGHT_API: BASE_URL + "/credits/preflight",

  // Metering. authorize-run answers 200 / 402 (no funds) / 409 (oversized URL).
  RESERVE_EXPLORATION_API: BASE_URL + "/credits/reserve-exploration",
  AUTHORIZE_RUN_API: BASE_URL + "/credits/authorize-run",
  SETTLE_RUN_API: BASE_URL + "/credits/settle",
  RELEASE_RUN_API: BASE_URL + "/credits/release",

  // Super admin
  GRANT_CREDITS_API: BASE_URL + "/credits/grant",
  ADJUST_CREDITS_API: BASE_URL + "/credits/adjust",
  ADMIN_CREDIT_OVERVIEW_API: BASE_URL + "/credits/admin/overview",
};
