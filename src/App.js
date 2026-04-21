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
import { logout } from "./services/operations/authAPIs.js";
import { useDispatch } from "react-redux";
import APITesting from "./pages/Dashboard/APITesting.jsx";
import MobileAppTesting from "./pages/Dashboard/MobileAppTesting.jsx";
import DBTesting from "./pages/Dashboard/DBTesting.jsx";
import UserManagement from "./pages/Dashboard/Admin/UserManagement.jsx";
import AddUserForm from "./pages/Dashboard/Admin/AddUserForm.jsx";
import { getUserDetails } from "./services/operations/authAPIs.js";
import UpgradePlan from "./pages/Dashboard/UpgradePlan.jsx";
import Projects from "./pages/Dashboard/Projects.jsx";

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
// --- UPDATED: Admin Route helper ---
const AdminRoute = ({ children }) => {
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
  if (currentRole === "Admin") {
    return children;
  }

  // 3. If they are completely loaded and NOT an Admin, redirect them.
  return <Navigate to="/dashboard" replace />;
};

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

      <Route
        path="/upgrade-plan"
        element={
          <ProtectedRoute>
           <AppHeader/>
              <UpgradePlan />
           
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

      {/* Autopilot page */}
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

      {/* --- /projects Route --- */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Projects/>
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

      {/* --- Admin Route --- */}
      <Route
        path="/admin/user-management"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <DashboardLayout>
                <UserManagement />
              </DashboardLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* --- Admin Route --- */}
      <Route
        path="/admin/user-management/add-user"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <DashboardLayout>
                <AddUserForm />
              </DashboardLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch-all route for undefined URLs */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
