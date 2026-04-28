import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { ArrowLeft, Building, Mail, MapPin, Plus } from "lucide-react";

// --- ACTUAL API IMPORT ---
import { createCompany } from "../../../services/operations/companyAPI";

const AddCompanyPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.email) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);

    // Call the actual backend API
    const success = await createCompany(form, navigate); 
    
    setLoading(false);
    
    // Reset form on successful creation
    // (Note: The API helper handles the success toast and navigation)
    if (success) {
      setForm({ name: "", email: "", address: "" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      
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
            <Plus size={14} />
            <span>Registration</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Add New Company
          </h1>
        </div>
      </div>

      {/* FORM CONTAINER */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-5">
          <p className="text-slate-500 text-sm font-medium">Create and register a new company profile in the platform.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div className="relative group">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Organization Name
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                type="text"
                placeholder="e.g. Acme Corp"
                required
              />
            </div>
          </div>

          <div className="relative group">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Contact Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                type="email"
                placeholder="admin@acmecorp.com"
                required
              />
            </div>
          </div>

          <div className="relative group">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Physical Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-4 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={3}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                placeholder="Enter full corporate address"
              />
            </div>
          </div>

          {/* FORM FOOTER */}
          <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard/super-admin/companies-management")}
              className="px-6 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 w-full sm:w-auto disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Plus size={18} />
                  Register Company
                </>
              )}
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
};

export default AddCompanyPage;