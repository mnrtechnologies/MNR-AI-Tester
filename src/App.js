import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux"; // Added Redux hook
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "./components/Layout/AppHeader.jsx";
import Sidebar from "./components/Layout/Sidebar.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/AuthFlow/Login.jsx";

import MainDashboard from "./pages/Dashboard/MainDashboard.jsx";
import Profile from "./pages/Settings/Profile.jsx";
import ChangePassword from "./pages/Settings/ChangePassword.jsx";
import AutoPilot from "./pages/Dashboard/WebTesting.jsx";
import ForgotPassword from "./pages/AuthFlow/ForgotPassword.jsx";
import UpdatePassword from "./pages/AuthFlow/UpdatePassword.jsx";

import socket from "./utils/socket.js";
import useCreditSocket from "./hooks/useCreditSocket";
import { logout } from "./services/operations/authAPIs.js";
import { useDispatch } from "react-redux";
import APITesting from "./pages/Dashboard/APITesting.jsx";
import MobileAppTesting from "./pages/Dashboard/MobileAppTesting.jsx";
import DBTesting from "./pages/Dashboard/DBTesting";
import TestCaseDesigner from "./pages/Dashboard/TestCaseDesigner.jsx";
import { getUserDetails } from "./services/operations/authAPIs.js";
import Projects from "./pages/Dashboard/Projects.jsx";
import SuperAdmin from "./pages/Dashboard/SuperAdmin/SuperAdmin.jsx";
import Footer from "./components/UI/Footer.jsx";
import UsersManagement from "./components/Dashboard/SuperAdmin/UsersManagement.jsx";
import UsersAddForm from "./components/Dashboard/SuperAdmin/AddUsersForm.jsx";
import SubscriptionManagement from "./components/Dashboard/SuperAdmin/SubscriptionManagement.jsx";
import AddCompanyPage from "./components/Dashboard/SuperAdmin/AddCompanyPage.jsx";
import CompanyManagement from "./components/Dashboard/SuperAdmin/CompanyManagement.jsx";
import CompanyDetails from "./components/Dashboard/SuperAdmin/CompanyDetails.jsx";
import CompanyAdminDashboard from "./pages/Dashboard/CompanyAdmin/CompanyAdminDashboard.jsx";
import CompanyStaffManagement from "./components/Dashboard/CompanyAdmin/CompanyStaffManagement.jsx";
import AddStaff from "./components/Dashboard/CompanyAdmin/AddStaff.jsx";
import CompanySubscription from "./components/Dashboard/CompanyAdmin/CompanySubscription.jsx";
import UpgradePlan from "./components/Dashboard/UpgradePlan.jsx";
import RegressionTesting from "./pages/Dashboard/RegressionTesting.jsx";
import PerfTesting from "./pages/Dashboard/PerfTesting/index.jsx";
import GitHubTesting from "./pages/Dashboard/GitHubTesting/index.jsx";

// Layout for Dashboard pages ONLY
const DashboardLayout = ({ children }) => (
  <div className="flex flex-col h-screen overflow-hidden">
    <AppHeader />
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
    </div>
  </div>
);

// Protected Route helper
const ProtectedRoute = ({ children }) => {
  // Grab the token from Redux state
  const { token } = useSelector((state) => state.auth);
  // Fallback to localStorage in case Redux hasn't rehydrated yet after a page refresh
  const localToken = localStorage.getItem("token");

  // If user is logged in, allow access to the route
  if (token !== null || localToken !== null) {
    return children;
  }

  // If no user is logged in, redirect to the home page (or login page)
  return <Navigate to="/" replace />;
};

// Optional: Open Route helper to prevent logged-in users from seeing Auth pages
const OpenRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);
  const localToken = localStorage.getItem("token");

  if (token === null && localToken === null) {
    return children;
  }

  // If user is ALREADY logged in, redirect them to the dashboard
  return <Navigate to="/dashboard" replace />;
};

// Admin Route helper ---
const CompanyAdminRoute = ({ children }) => {
  const { user } = useSelector((state) => state.profile);
  const hasToken = localStorage.getItem("token");

  const currentRole = user?.role;

  // 1. If we don't have user data yet, but a token exists, we are likely still fetching the profile.
  // Show a loading state instead of immediately kicking them out.
  if (!user && hasToken) {
    return (
      <div className="flex h-screen items-center justify-center text-blue-900 font-semibold">
        Loading...
      </div>
    );
  }

  // 2. Once the user data is loaded, check if they are an Admin.
  if (currentRole === "company_admin") {
    return children;
  }

  // 3. If they are completely loaded and NOT an Admin, redirect them.
  return <Navigate to="/dashboard" replace />;
};
const SuperAdminRoute = ({ children }) => {
  const { user } = useSelector((state) => state.profile);
  const hasToken = localStorage.getItem("token");

  const currentRole = user?.role;

  // 1. If we don't have user data yet, but a token exists, we are likely still fetching the profile.
  // Show a loading state instead of immediately kicking them out.
  if (!user && hasToken) {
    return (
      <div className="flex h-screen items-center justify-center text-blue-900 font-semibold">
        Loading...
      </div>
    );
  }

  // 2. Once the user data is loaded, check if they are an Admin.
  if (currentRole === "super_admin") {
    return children;
  }

  // 3. If they are completely loaded and NOT an Admin, redirect them.
  return <Navigate to="/dashboard" replace />;
};
// Layout for Admin pages to keep the Footer at the bottom
const AdminLayout = ({ children }) => (
  <div className="flex flex-col min-h-screen bg-slate-50">
    <AppHeader />
    {/* flex-grow pushes the footer to the bottom, pb-6 adds breathing room */}
    <main className="flex-grow pb-6">{children}</main>
    <Footer />
  </div>
);

function App() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.profile);
  const localToken = localStorage.getItem("token");

  useEffect(() => {
    if (localToken && !user) {
      dispatch(getUserDetails(localToken, navigate));
    }
  }, [dispatch, localToken, user, navigate]);

  useEffect(() => {
    const handleForceLogout = () => {
      dispatch(logout(navigate));

      alert("Logged in from another device");
    };

    socket.on("forceLogout", handleForceLogout);

    return () => {
      socket.off("forceLogout", handleForceLogout);
    };
  }, [dispatch, navigate]);

  // Live credit balance, app-wide. Mounted here (once) so the header, the run
  // guard and the usage meter never disagree — including when a teammate's run
  // is what moved the balance.
  useCreditSocket();

  return (
    <Routes>
      {/* --- PUBLIC ROUTES --- */}
      <Route
        path="/"
        element={
          <OpenRoute>
            <Home />
          </OpenRoute>
        }
      />

      {/* Public auth pages */}
      <Route
        path="/login"
        element={
          <OpenRoute>
            <Login />
          </OpenRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <OpenRoute>
            <ForgotPassword />
          </OpenRoute>
        }
      />
      <Route
        path="/update-password/:token"
        element={
          <OpenRoute>
            <UpdatePassword />
          </OpenRoute>
        }
      />

      {/* Super Admin */}

      <Route
        path="/dashboard/super-admin"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <AdminLayout>
                <SuperAdmin />
              </AdminLayout>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/super-admin/users-management"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <AdminLayout>
                <UsersManagement />
              </AdminLayout>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/super-admin/users-management/add-users"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <AdminLayout>
                <UsersAddForm />
              </AdminLayout>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/super-admin/subscriptions"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <AdminLayout>
                <SubscriptionManagement />
              </AdminLayout>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/super-admin/companies-management"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <AdminLayout>
                <CompanyManagement />
              </AdminLayout>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/super-admin/companies-management/add-company"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <AdminLayout>
                <AddCompanyPage />
              </AdminLayout>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/super-admin/companies-management/:id"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <AdminLayout>
                <CompanyDetails />
              </AdminLayout>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      {/* --- PRIVATE ROUTES: Dashboard and Testing --- */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <MainDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* web testing page */}
      <Route
        path="/web-testing"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <AutoPilot />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Regression Testing */}
      <Route
        path="/regression-testing"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <RegressionTesting />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- /db-testing Route --- */}
      <Route
        path="/db-testing"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DBTesting />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- /performance-testing Route --- */}
      <Route
        path="/performance-testing"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PerfTesting />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- /github-testing Route --- */}
      <Route
        path="/github-testing"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <GitHubTesting />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- /mobile-testing Route --- */}
      <Route
        path="/mobile-testing"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <MobileAppTesting />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- /api-testing Route --- */}
      <Route
        path="/api-testing"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <APITesting />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- /test-case-designer Route --- */}
      <Route
        path="/test-case-designer"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <TestCaseDesigner />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- /projects Route --- */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Projects />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- Profile Route --- */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Profile />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* --- Change Password Route --- */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ChangePassword />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/upgrade-plan"
        element={
          <ProtectedRoute>
            <AppHeader />
            <UpgradePlan />
          </ProtectedRoute>
        }
      />

      {/* --- Admin Route --- */}
      <Route
        path="/organization-admin-dashboard"
        element={
          <ProtectedRoute>
            <CompanyAdminRoute>
              <AdminLayout>
                <CompanyAdminDashboard />
              </AdminLayout>
            </CompanyAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/organization-admin-dashboard/staff-management"
        element={
          <ProtectedRoute>
            <CompanyAdminRoute>
              <AdminLayout>
                {" "}
                <CompanyStaffManagement />
              </AdminLayout>
            </CompanyAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/organization-admin-dashboard/staff-management/add-staff"
        element={
          <ProtectedRoute>
            <CompanyAdminRoute>
              <AdminLayout>
                <AddStaff />
              </AdminLayout>
            </CompanyAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/organization-admin-dashboard/organization-profile"
        element={
          <ProtectedRoute>
            <CompanyAdminRoute>
              <AdminLayout>
                <CompanySubscription />
              </AdminLayout>
            </CompanyAdminRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch-all route for undefined URLs */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
