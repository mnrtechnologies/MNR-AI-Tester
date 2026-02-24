import { Routes, Route, Navigate } from "react-router-dom";
import AppHeader from "./components/Layout/AppHeader.jsx";
import Sidebar from "./components/Layout/Sidebar.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/AuthFlow/Login.jsx";
import Signup from "./pages/AuthFlow/Signup.jsx";
import TestHome from "./pages/Dashboard/Testing/TestHome";
import AutomationTesting from "./pages/Dashboard/Testing/AutomationTesting.jsx";
import FunctionalTesting from "./pages/Dashboard/Testing/FunctionalTesting";
import MainDashboard from "./pages/Dashboard/MainDashboard.jsx";
import Profile from "./pages/Dashboard/Profile.jsx";
import ChangePassword from "./pages/Dashboard/ChangePassword.jsx";
import AutoPilot from "./pages/Dashboard/Autopilot.jsx";

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
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      {/* --- PUBLIC ROUTES */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* --- PRIVATE ROUTES: Dashboard and Testing  */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout>
            {/* <TestHome /> */}
            <MainDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      {/* Autopilot page */}
      <Route path="/autopilot" element={
        <ProtectedRoute>
          <DashboardLayout><AutoPilot /></DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/functional-testing" element={
        <ProtectedRoute>
          <DashboardLayout><FunctionalTesting /></DashboardLayout>
        </ProtectedRoute>
      } />

      {/* --- New Profile Route --- */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Profile />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* --- New Change Password Route --- */}
      <Route path="/change-password" element={
        <ProtectedRoute>
          <DashboardLayout>
            <ChangePassword />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;