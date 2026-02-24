import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { User } from 'lucide-react';

const HomeHeader = () => {

  const baseStyle = "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 font-medium text-sm";
    const inactiveStyle = "text-gray-500 hover:bg-[#b2cfc7]/30 hover:text-slate-800";
  
  const activeStyle = "bg-[#b2cfc7] text-white shadow-sm";

  return (
    <nav className="flex items-center justify-between px-16 py-8 bg-transparent">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-1 font-bold text-2xl">
        <span className="text-slate-800">sensu</span>
        <span className="text-orange-500 text-3xl">Q</span>
      </Link>
      
      {/* Navigation Options */}
      <div className="flex items-center gap-4">
        <NavLink 
          to="/" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          Home
        </NavLink>

        <NavLink 
          to="/sensuq" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          SensuQ
        </NavLink>

        <NavLink 
          to="/about" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          About
        </NavLink>

        <NavLink 
          to="/contact" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          Contact
        </NavLink>

        <NavLink 
          to="/signup" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          Sign up
        </NavLink>

        {/* The Log In Button with the Icon */}
        <NavLink 
          to="/login" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : "bg-[#9fc7bd] text-white hover:bg-[#8bb4aa]"}`}
        >
          <User size={18} />
          <span>Log in</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default HomeHeader;