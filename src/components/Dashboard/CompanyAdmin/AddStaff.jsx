import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Eye, EyeOff, User, Mail, Phone, Lock, Building, Users, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

// --- ACTUAL API IMPORT ---
// Adjust path if necessary based on your project structure
import { register } from "../../../services/operations/authAPIs";

export default function AddStaff() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Pull the logged-in admin's details to automatically assign the new staff to their company
  const { user } = useSelector((state) => state.profile);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneno: "",
    password: "",
    confirmPassword: "",
    role: "staff", // Default to staff
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validatePassword = (password) => {
    // Basic validation, adjust as needed to match your exact backend requirements
    return password.length >= 8;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validatePassword(form.password)) {
      return toast.error("Password must be at least 8 characters long.");
    }

    if (form.password !== form.confirmPassword) {
      return toast.error("Passwords do not match.");
    }

    if (!user?.companyId) {
      return toast.error("Error: Could not identify your company ID.");
    }

    // Determine the correct return path based on the logged-in user's role
    const returnPath = user?.role === "super_admin" 
      ? "/dashboard/super-admin/users-management" 
      : "/organization-admin-dashboard/staff-management";

    dispatch(
      register(
        form.name,
        form.email,
        form.password,
        form.confirmPassword,
        form.phoneno, // mapped to mobile
        "", // country
        "", // state
        "", // city
        form.role,
        user.companyId, // Automatically link to the admin's company
        navigate,
        returnPath
      )
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* STANDARD HEADER SECTION WITH BACK BUTTON */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-start sm:items-center gap-4">
          <button 
            type="button"
            onClick={() => navigate(-1)}
            className="mt-1 sm:mt-0 p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div>
            <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-100">
              <Building size={14} />
              <span>Organization Settings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Provision <span className="text-orange-500">New Account</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Create and assign a new staff or manager account to your corporate network.
            </p>
          </div>
        </div>
      </div>

      {/* FORM SECTION */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-6 sm:p-8 max-w-4xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ROW 1: Name & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input 
                    type="text" 
                    name="name"
                    required 
                    placeholder="e.g. Jane Doe" 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-12 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:bg-white" 
                    value={form.name} 
                    onChange={handleChange} 
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input 
                    type="email" 
                    name="email"
                    required 
                    placeholder="name@organization.com" 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-12 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:bg-white" 
                    value={form.email} 
                    onChange={handleChange} 
                  />
                </div>
              </div>
            </div>

            {/* ROW 2: Phone & Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Phone Number <span className="text-slate-400 font-normal normal-case tracking-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input 
                    type="tel" 
                    name="phoneno"
                    placeholder="+1 (555) 000-0000" 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-12 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:bg-white" 
                    value={form.phoneno} 
                    onChange={handleChange} 
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Organizational Role</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <select 
                    name="role"
                    required 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-12 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:bg-white appearance-none cursor-pointer" 
                    value={form.role} 
                    onChange={handleChange}
                  >
                    <option value="staff">Staff (Standard Access)</option>
                    <option value="company_admin">Organization Admin (Full Access)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ROW 3: Passwords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password"
                    required 
                    placeholder="Create password (min. 8 chars)" 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-12 pr-12 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:bg-white" 
                    value={form.password} 
                    onChange={handleChange} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    name="confirmPassword"
                    required 
                    placeholder="Confirm password" 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-12 pr-12 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:bg-white" 
                    value={form.confirmPassword} 
                    onChange={handleChange} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-6 flex justify-end">
              <button 
                type="submit" 
                className="w-full md:w-auto px-8 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
              >
                Provision Account
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}