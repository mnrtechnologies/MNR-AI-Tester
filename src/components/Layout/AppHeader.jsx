import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; // Added Redux hooks
import { logout, getUserDetails } from "../../services/operations/authAPIs"; // Imported actions
import { Sun, Settings, User, ChevronDown, Key, LogOut } from "lucide-react";
import logo from "../../assets/MNR_AT.png";

const AppHeader = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Access user data from your Redux store (assuming it's in the profile slice)
  const { user } = useSelector((state) => state.profile);

  // Fetch user details on mount if they aren't already in the Redux store
  useEffect(() => {
    if (!user) {
      dispatch(getUserDetails());
    }
  }, [dispatch, user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const logoutUser = () => {
    // Dispatch the Redux logout action and pass navigate
    dispatch(logout(navigate));
    setIsOpen(false);
  };

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src={logo}
            alt="MNR AT"
            className="h-14 w-auto object-contain rounded-2xl p-1 border border-blue-900"
          />
        </div>
        <nav className="text-sm text-gray-400">
          HOME /{" "}
          <span className="text-gray-900 font-medium uppercase text-[10px] tracking-widest">
            Dashboard
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Dropdown Container */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-3 p-1 px-3 rounded-full border transition-all ${
              isOpen ? "border-orange-200 bg-orange-50/30" : "border-slate-100"
            }`}
          >
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center border border-orange-200">
              <User size={18} className="text-orange-600" />
            </div>

            {/* USER name */}
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs font-semibold text-slate-800">
                {user?.name || "User"}
              </span>
              {user?.email && (
                <span className="text-[10px] text-slate-400">
                  {user.email.split("@")[0]}
                </span>
              )}
            </div>

            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Content */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => {
                  navigate("/profile");
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Settings size={16} className="text-slate-400" />
                <span className="font-medium">Profile</span>
              </button>

              <button
                onClick={() => {
                  navigate("/change-password");
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Key size={16} className="text-slate-400" />
                <span className="font-medium">Change Password</span>
              </button>

              <div className="my-1 border-t border-slate-50"></div>

              <button
                onClick={logoutUser}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                <span className="font-bold">Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;