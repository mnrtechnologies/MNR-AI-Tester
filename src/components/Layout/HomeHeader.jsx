import React from "react";
import { NavLink, Link } from "react-router-dom";
import { User } from "lucide-react";
import logo from "../../assets/MNR_AT.png";

const HomeHeader = () => {
  const baseStyle =
    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 font-medium text-sm";
  const inactiveStyle =
    "text-gray-500 hover:bg-orange-100 hover:text-slate-800";

  const activeStyle = "bg-orange-500 text-white shadow-sm";

  return (
    <nav className="flex items-center justify-between px-8 py-6 bg-transparent ">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 ">
        <img
          src={logo}
          alt="MNR AT"
          className="h-14 w-auto object-contain rounded-2xl  p-1 border border-blue-900 "
        />
      </Link>

      {/* Navigation Options */}
      <div className="flex items-center gap-4">
        {/* <NavLink 
          to="/" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          Home
        </NavLink> */}

        {/* <NavLink 
          to="/" 
          className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          MNR-AT
        </NavLink> */}

        {/* <NavLink 
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
        </NavLink> */}

        <NavLink
          to="/signup"
          className={({ isActive }) =>
            `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`
          }
        >
          Sign up
        </NavLink>

        {/* The Log In Button with the Icon */}
        <NavLink
          to="/login"
          className={({ isActive }) =>
            `${baseStyle} ${isActive ? activeStyle : "bg-orange-500 text-white hover:bg-orange-600"}`
          }
        >
          <User size={18} />
          <span>Log in</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default HomeHeader;
