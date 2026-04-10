import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { User } from "lucide-react";
import logo from "../../assets/MNR_AT.png";

const HomeHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleScroll = (id) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-12 py-6 bg-white/80 backdrop-blur-md border-b border-orange-100">
      {/* Brand Logo */}
      <Link to="/" className="flex items-center">
        <img src={logo} alt="MNR AT" className="h-10 w-auto object-contain" />
      </Link>

      {/* Navigation - Orange hover states */}
      <div className="hidden md:flex items-center gap-10">
        {["Home", "Features", "About", "Contact","Pricing"].map((item) => (
          <button 
            key={item}
            onClick={() => handleScroll(item.toLowerCase())}
            className="text-sm font-semibold text-slate-500 hover:text-orange-600 transition-colors"
          >
            {item === "Features" ? "MNR AT" : item}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-8">
        {/* <Link to="/signup" className="text-sm font-medium text-slate-400 hover:text-orange-600">Sign up</Link> */}
        <Link
          to="/login"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full text-sm font-bold transition-all shadow-lg shadow-orange-100"
        >
          <User size={16} strokeWidth={3} />
          <span>Log in</span>
        </Link>
      </div>
    </nav>
  );
};

export default HomeHeader;