import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bot } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20}/>, path: '/dashboard' },
    { name: 'MNR AT Auto Pilot', icon: <Bot size={20}/>, path: '/autopilot' },
  ];

  return (
    <aside className="w-64 border-r bg-white h-[calc(100vh-64px)] overflow-y-auto">
      <ul className="p-4 space-y-2">
        {menuItems.map((item, idx) => (
          <li key={idx}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-orange-600 shadow-sm'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
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