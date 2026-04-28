import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Building, Plus, MapPin, Mail, X } from "lucide-react";


// --- REAL API IMPORTS ---
import {
  getCompanies,
  deleteCompany,
  editCompany,
} from "../../../services/operations/companyAPI";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const CompanyManagement = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // EDIT MODAL
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    companyId: "",
    name: "",
    email: "",
    address: "",
  });

  // DELETE MODAL
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");

  // LOAD DATA FROM API
  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await getCompanies();
      // Safely handle different standard backend JSON structures
      if (data?.companies && Array.isArray(data.companies)) {
        setCompanies(data.companies);
      } else if (data?.data && Array.isArray(data.data)) {
        setCompanies(data.data);
      } else if (Array.isArray(data)) {
        setCompanies(data);
      } else {
        setCompanies([]);
      }
    } catch (error) {
      console.error("Error loading companies:", error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const openEdit = (e, company) => {
    e.stopPropagation(); // Prevent row click
    setEditForm({
      companyId: company._id,
      name: company.name,
      email: company.email,
      address: company.address,
    });
    setIsEditOpen(true);
  };

  const openDelete = (e, id) => {
    e.stopPropagation(); // Prevent row click
    setDeleteId(id);
    setIsDeleteOpen(true);
  };

  // EDIT SUBMIT WITH API
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const success = await editCompany(editForm);
    
    if (success) {
      setIsEditOpen(false);
      await loadCompanies(); // Refresh the table
    }
  };

  // DELETE SUBMIT WITH API
  const confirmDelete = async () => {
    const success = await deleteCompany(deleteId);
    
    if (success) {
      setIsDeleteOpen(false);
      await loadCompanies(); // Refresh the table
    }
  };

  const getStatusBadge = (status) => {
    if (status === "active")
      return (
        <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
          Active
        </span>
      );
    if (status === "expired")
      return (
        <span className="bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
          Expired
        </span>
      );
    return (
      <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
        No Plan
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-100">
            <Building size={14} />
            <span>Organization Directory</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Company Management
          </h1>
          <p className="text-slate-500 text-sm mt-2 max-w-xl leading-relaxed">
            View, edit, and manage all registered companies and their structural
            profiles.
          </p>
        </div>
        <button
          onClick={() =>
            navigate("/dashboard/super-admin/companies-management/add-company")
          }
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-95"
        >
          <Plus size={18} />
          Add Company
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">Loading companies...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Building size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">No companies found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="p-5">Organization</th>
                  <th className="p-5">Contact & Location</th>
                  <th className="p-5">Subscription</th>
                  <th className="p-5 hidden md:table-cell">Last Updated</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((comp, i) => (
                  <motion.tr
                    key={comp._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() =>
                      navigate(
                        `/dashboard/super-admin/companies-management/${comp._id}`
                      )
                    }
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="p-5">
                      <p className="font-bold text-slate-800">{comp.name}</p>
                    </td>
                    <td className="p-5 space-y-1">
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <Mail size={12} /> {comp.email}
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <MapPin size={12} /> {comp.address}
                      </div>
                    </td>
                    <td className="p-5">
                      {getStatusBadge(comp.subscriptionStatus)}
                    </td>
                    <td className="p-5 text-slate-500 text-xs hidden md:table-cell">
                      {formatDate(comp.updatedAt)}
                    </td>
                    <td className="p-5">
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => openEdit(e, comp)}
                          className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg transition-all shadow-sm"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={(e) => openDelete(e, comp._id)}
                          className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {isEditOpen && (
          <EditModal
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleEditSubmit}
            onClose={() => setIsEditOpen(false)}
          />
        )}
        {isDeleteOpen && (
          <DeleteModal
            onConfirm={confirmDelete}
            onClose={() => setIsDeleteOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- EDIT MODAL ---
const EditModal = ({ form, setForm, onSubmit, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 relative"
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
      >
        <X size={20} />
      </button>
      <h2 className="text-xl font-black text-slate-800 tracking-tight mb-6 flex items-center gap-2">
        <Pencil className="text-orange-500" /> Edit Profile
      </h2>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Company Name
          </label>
          <input
            className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Address
          </label>
          <textarea
            rows={3}
            className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold w-full"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md w-full"
          >
            Save Changes
          </button>
        </div>
      </form>
    </motion.div>
  </div>
);

// --- DELETE MODAL ---
const DeleteModal = ({ onConfirm, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 text-center"
    >
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
        <Trash2 size={28} />
      </div>
      <h2 className="text-xl font-black text-slate-800 mb-2">
        Delete Company?
      </h2>
      <p className="text-slate-500 text-sm mb-8 leading-relaxed">
        This action cannot be undone. All data associated with this company will
        be lost.
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold w-full"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold shadow-md w-full"
        >
          Delete
        </button>
      </div>
    </motion.div>
  </div>
);

export default CompanyManagement;