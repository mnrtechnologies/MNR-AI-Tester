import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Lock,
  Building,
  ShieldCheck,
  ArrowLeft,
  UserPlus,
} from "lucide-react";

// --- ACTUAL API IMPORTS ---
import { register } from "../../../services/operations/authAPIs";
import { getCompanies } from "../../../services/operations/companyAPI";

const UsersAddForm = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

    // Pull the logged-in admin's details to automatically assign the new staff to their company
  const { user } = useSelector((state) => state.profile);

  const [companies, setCompanies] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneno: "",
    role: "",
    companyId: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validatePassword = (password) => {
    const isValidLength = password.length >= 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return (
      isValidLength &&
      hasUppercase &&
      hasLowercase &&
      hasNumber &&
      hasSpecialChar
    );
  };

  // -------------------------------
  // FETCH COMPANY LIST
  // -------------------------------
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const fetchedCompanies = await getCompanies();

        // Safely extract the array to prevent mapping errors
        if (
          fetchedCompanies?.companies &&
          Array.isArray(fetchedCompanies.companies)
        ) {
          setCompanies(fetchedCompanies.companies);
        } else if (
          fetchedCompanies?.data &&
          Array.isArray(fetchedCompanies.data)
        ) {
          setCompanies(fetchedCompanies.data);
        } else if (Array.isArray(fetchedCompanies)) {
          setCompanies(fetchedCompanies);
        } else {
          setCompanies([]);
        }
      } catch (error) {
        console.error("Error loading companies:", error);
        setCompanies([]);
      }
    };

    loadCompanies();
  }, []);

      // Determine the correct return path based on the logged-in user's role
    const returnPath = user?.role === "super_admin" 
      ? "/dashboard/super-admin/users-management" 
      : "/organization-admin-dashboard/staff-management";

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validatePassword(form.password)) {
      toast.error(
        "Password must be 12+ chars and include uppercase, lowercase, numbers, and special characters.",
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    // If role is not super_admin → company allocation is required
    if (form.role !== "super_admin" && !form.companyId) {
      toast.error("Please select a company allocation.");
      return;
    }

    

    // DISPATCH ACTUAL REGISTER API WITH CORRECT PARAMETER ORDER
    dispatch(
      register(
        form.name, // 1. name
        form.email, // 2. email
        form.password, // 3. password
        form.confirmPassword, // 4. confirmPassword
        form.phoneno, // 5. mobile
        "", // 6. country (blank since it's not in the form)
        "",
        "", 
        form.role, 
        form.companyId, 
        navigate,
        returnPath
      ),
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      {/* HEADER SECTION */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border border-orange-100">
            <UserPlus size={14} />
            <span>Provision Profile</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Create New User
          </h1>
        </div>
      </div>

      {/* FORM CONTAINER */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="p-8 sm:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {/* LEFT COLUMN: Identity & Contact */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
                Identity & Contact
              </h3>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                    type="text"
                    placeholder="e.g. Jane Doe"
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                    type="email"
                    placeholder="jane@company.com"
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Phone Number{" "}
                  <span className="text-slate-400 font-normal normal-case">
                    (Optional)
                  </span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    name="phoneno"
                    value={form.phoneno}
                    onChange={handleChange}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Access & Security */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
                Access & Security
              </h3>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  System Role
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 cursor-pointer appearance-none"
                    required
                  >
                    <option value="" disabled>
                      -- Select Access Level --
                    </option>
                    <option value="staff">Staff</option>
                    <option value="company_admin">Company Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              {/* Conditional Company Select */}
              {form.role && form.role !== "super_admin" && (
                <div className="relative group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Company Allocation
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                    <select
                      name="companyId"
                      value={form.companyId}
                      onChange={handleChange}
                      className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 cursor-pointer appearance-none"
                    >
                      <option value="" disabled>
                        -- Select Organization --
                      </option>
                      {companies.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Temporary Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-12 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter secure password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Must be 12+ characters, with uppercase, lowercase, number &
                  symbol.
                </p>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-12 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* FORM FOOTER */}
          <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                navigate("/dashboard/super-admin/users-management")
              }
              className="px-6 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors w-full sm:w-auto text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 w-full sm:w-auto text-center flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              Provision User
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default UsersAddForm;
