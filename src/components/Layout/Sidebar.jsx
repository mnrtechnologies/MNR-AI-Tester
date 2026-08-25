import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Users,
  LayoutDashboard,
  FolderKanban,
  Bot,
  Database,
  Smartphone,
  Globe,
  ChevronLeft,
  Menu,
  History,
  FileText
} from "lucide-react";
import { useSelector } from "react-redux";

const Sidebar = () => {
  const { user } = useSelector((state) => state.profile);
  const [isCollapsed, setIsCollapsed] = useState(false); // State for toggle

  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/dashboard" },
    { name: "Projects", icon: <FolderKanban size={20} />, path: "/projects" },
    { name: "Web Testing", icon: <Bot size={20} />, path: "/web-testing" },
    { name: "Doc To TestCase", icon: <FileText size={20} />, path: "/test-case-designer" },
    { name: "Regression Testing", icon: <History size={20} />, path: "/regression-testing" },
    { name: "Mobile App Testing", icon: <Smartphone size={20} />, path: "/mobile-testing" },
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
    <aside
      className={`relative border-r bg-white h-[calc(100vh-64px)] transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 bg-white border rounded-full p-1 hover:bg-gray-100 shadow-md z-10"
      >
        {isCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
      </button>

      <ul className="p-4 space-y-2 overflow-y-auto h-full">
        {menuItems.map((item, idx) => (
          <li key={idx}>
            <NavLink
              to={item.path}
              onClick={(e) => {
                const isRunning = localStorage.getItem("autopilotRunning") === "true";
                const goingToAutopilot = item.path === "/autopilot";

                if (isRunning && !goingToAutopilot) {
                  const confirmLeave = window.confirm(
                    "An Autopilot test is currently running. Leaving this page may interrupt the process. Continue?"
                  );

                  if (!confirmLeave) {
                    e.preventDefault();
                  } else {
                    localStorage.setItem("autopilotRunning", "false");
                  }
                }
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isCollapsed ? "justify-center px-2" : "justify-start"
                } ${
                  isActive
                    ? "bg-orange-50 text-orange-600 shadow-sm"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                }`
              }
              title={isCollapsed ? item.name : ""} // Show tooltip when collapsed
            >
              <span className="shrink-0">{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;