import React from "react";
import { NavLink } from "react-router-dom";
import {
  Users,
  LayoutDashboard,
  FolderKanban,
  Bot,
  Database,
  Smartphone,
  Globe,
} from "lucide-react";
import { useSelector } from "react-redux";

const Sidebar = () => {
  const { user } = useSelector((state) => state.profile);

  const menuItems = [
    {
      name: "Dashboard",
      icon: <LayoutDashboard size={20} />,
      path: "/dashboard",
    },
    { name: "Projects", icon: <FolderKanban size={20} />, path: "/projects" },
    { name: "Web Testing", icon: <Bot size={20} />, path: "/web-testing" },
        { name: "Regression Testing", icon: <Bot size={20} />, path: "/regression-testing" },

    {
      name: "Mobile App Testing",
      icon: <Smartphone size={20} />,
      path: "/mobile-testing",
    },
        { name: "API Testing", icon: <Globe size={20} />, path: "/api-testing" },
    { name: "DB Testing", icon: <Database size={20} />, path: "/db-testing" },
  ];

  if (user?.role === "company_admin") {
    menuItems.push({
      name: "Admin Portal",
      icon: <Users size={20} />,
      path: "/organization-admin-dashboard",
    });
  }

  if (user?.role === "super_admin") {
    menuItems.push({
      name: "Super Admin Portal",
      icon: <Users size={20} />,
      path: "/dashboard/super-admin",
    });
  }

  return (
    <aside className="w-64 border-r bg-white h-[calc(100vh-64px)] overflow-y-auto">
      <ul className="p-4 space-y-2">
        {menuItems.map((item, idx) => (
          <li key={idx}>
            <NavLink
              to={item.path}
              onClick={(e) => {
                // Check if autopilot is actively running
                const isRunning =
                  localStorage.getItem("autopilotRunning") === "true";
                const goingToAutopilot = item.path === "/autopilot";

                // Only block navigation if running AND leaving the autopilot page
                if (isRunning && !goingToAutopilot) {
                  const confirmLeave = window.confirm(
                    "An Autopilot test is currently running. Leaving this page may interrupt the process. Continue?",
                  );

                  if (!confirmLeave) {
                    e.preventDefault(); // Stop navigation if they click "Cancel"
                  } else {
                    // Optional: Clean up if they forcefully leave
                    localStorage.setItem("autopilotRunning", "false");
                  }
                }
              }}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-orange-50 text-orange-600 shadow-sm"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
