import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Settings, User, ChevronDown, Key, LogOut } from 'lucide-react';

const AppHeader = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null); // Reference for "click-away" logic
  const navigate = useNavigate();

  // Handle closing the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-1 font-bold text-2xl cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-slate-800">sensu</span>
          <span className="text-orange-500 text-3xl italic">Q</span>
        </div>
        <nav className="text-sm text-gray-400">
          HOME / <span className="text-gray-900 font-medium uppercase text-[10px] tracking-widest">Dashboard</span>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-slate-100">
          <button className="p-2 hover:bg-gray-50 rounded-lg text-slate-400 transition-colors">
            <Sun size={20}/>
          </button>
          <button className="p-2 hover:bg-gray-50 rounded-lg text-slate-400 transition-colors">
            <Settings size={20}/>
          </button>
        </div>
        
        {/* Dropdown Container */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className={`flex items-center gap-2 p-1 px-2 rounded-full border transition-all ${isOpen ? 'border-teal-200 bg-teal-50/30' : 'border-slate-100'}`}
          >
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center border border-teal-200">
              <User size={18} className="text-teal-600" />
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Content */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
              <button 
                onClick={() => { navigate('/profile'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Settings size={16} className="text-slate-400" />
                <span className="font-medium">Profile</span>
              </button>
              
              <button 
                onClick={() => { navigate('/change-password'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Key size={16} className="text-slate-400" />
                <span className="font-medium">Change Password</span>
              </button>

              <div className="my-1 border-t border-slate-50"></div>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
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