import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  ShieldCheck,
  Mail,
  Building,
  ArrowLeft
} from "lucide-react";
import { motion } from "framer-motion";

// IMPORT YOUR ACTUAL APIs HERE (Adjust paths if necessary)
import {
  getAllUsers,
  editUser,
  deleteUser,
} from "../../../services/operations/authAPIs";
import { getCompanies } from "../../../services/operations/companyAPI";

// ✅ Updated to only match your 3 active roles
const accessStyles = {
  company_admin: "bg-emerald-100 text-emerald-700 border-emerald-200",
  staff: "bg-blue-100 text-blue-700 border-blue-200",
  super_admin: "bg-slate-200 text-slate-800 border-slate-300",
};

export default function UsersManagement() {
  const { user } = useSelector((state) => state.profile);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [editUserData, setEditUserData] = useState({
    _id: "",
    name: "",
    email: "",
    phoneno: "",
    role: "",
    companyId: "",
  });

  // --- ACTUAL API FETCHING ---
  const loadInitialData = async () => {
    try {
      // Fetch users via Redux thunk
      const fetchedUsers = await dispatch(getAllUsers());
      if (fetchedUsers) setUsers(fetchedUsers);

      // Fetch companies directly
      const fetchedCompanies = await getCompanies();

      // ✅ SAFELY EXTRACT THE ARRAY
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
        setCompanies([]); // Fallback to empty array to prevent .find() crashes
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  };

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCompanyName = (companyId) => {
    if (!companyId)
      return <span className="text-slate-400 italic">No Company</span>;
    const comp = companies.find((c) => c._id === companyId);
    return comp ? comp.name : "Unknown Company";
  };

  const handleEditUser = (u) => {
    setEditUserData({
      _id: u._id,
      name: u.name,
      email: u.email,
      phoneno: u.phoneno || "",
      role: u.role,
      companyId: u.companyId || "",
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteUser = (userId) => {
    setSelectedUserId(userId);
    setIsDeleteModalOpen(true);
  };

  // --- ACTUAL EDIT API CALL ---
  const handleSaveUser = () => {
    const payload = {
      name: editUserData.name,
      email: editUserData.email,
      phoneno: editUserData.phoneno,
      role: editUserData.role,
      companyId: editUserData.companyId,
    };

    dispatch(
      editUser(editUserData._id, payload, () => {
        setIsEditModalOpen(false);
        loadInitialData(); // Refresh the table automatically
      }),
    );
  };

  // --- ACTUAL DELETE API CALL ---
  const confirmDelete = () => {
    dispatch(
      deleteUser(selectedUserId, () => {
        setIsDeleteModalOpen(false);
        loadInitialData(); // Refresh the table automatically
      }),
    );
  };

  // Filter logic
  const filteredUsers = users.filter((u) => {
    const query = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
                  <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-1 mr-2 sm:mt-0 p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-100">
            <ShieldCheck size={14} />
            <span>User Matrix</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Directory & Access
          </h1>
          <p className="text-slate-500 text-sm mt-2 max-w-xl leading-relaxed">
            Audit, modify, and control access levels for all platform personnel
            across all registered companies.
          </p>
        </div>
      </div>

      {/* SEARCH AND ACTION ROW */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="font-semibold text-slate-700 flex items-center gap-2 px-2">
          Total Records:
          <span className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-md text-sm border border-slate-200">
            {users.length}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80 group">
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-10 py-2.5 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
          </div>

          <button
            onClick={() =>
              navigate("/dashboard/super-admin/users-management/add-users")
            }
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* --- ✅ Mobile Card View --- */}
      <div className="block lg:hidden space-y-4">
        {filteredUsers.map((u, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={u._id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-slate-100 bg-orange-50 text-orange-500 flex items-center justify-center font-bold text-lg shadow-sm">
                  {u.image ? (
                    <img
                      src={u.image}
                      alt="User"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    u.name[0].toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-base font-bold text-slate-800">{u.name}</p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border mt-1 ${accessStyles[u.role] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                  >
                    {u.role.replace("_", " ")}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEditUser(u)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteUser(u._id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-500 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                {u.email}
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" />
                {getCompanyName(u.companyId)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* --- ✅ Desktop Table View --- */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold tracking-wider">
            <tr>
              <th className="p-4 w-12 text-center">
                <input
                  type="checkbox"
                  className="rounded text-orange-500 focus:ring-orange-500"
                />
              </th>
              <th className="p-4">User Identity</th>
              <th className="p-4">Company</th>
              <th className="p-4">Access Role</th>
              <th className="p-4">Last Active</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((u) => (
              <tr
                key={u._id}
                className="hover:bg-slate-50/80 transition-colors group"
              >
                <td className="p-4 text-center">
                  <input
                    type="checkbox"
                    className="rounded text-orange-500 focus:ring-orange-500 border-slate-300"
                  />
                </td>
                <td className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full border border-slate-100 bg-orange-50 text-orange-500 flex items-center justify-center font-bold shadow-sm">
                    {u.image ? (
                      <img
                        src={u.image}
                        alt="User"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      u.name[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      {u.email}
                    </p>
                  </div>
                </td>
                <td className="p-4 font-medium text-slate-700">
                  {getCompanyName(u.companyId)}
                </td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${accessStyles[u.role] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                  >
                    {u.role.replace("_", " ")}
                  </span>
                </td>
                <td className="p-4 text-slate-500">
                  {u.lastActive
                    ? new Date(u.lastActive).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </td>
                <td className="p-4">
                  <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditUser(u)}
                      className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg transition-all shadow-sm"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u._id)}
                      className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-500">
                  No users found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* === ✅ Edit User Modal === */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            // Changed max-w-md to max-w-sm and p-8 to p-6 to make the box small
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                <Pencil size={18} />
              </div>
              <h3 className="text-xl font-black text-slate-800">
                Edit User Profile
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editUserData.name}
                  onChange={(e) =>
                    setEditUserData({ ...editUserData, name: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editUserData.email}
                  onChange={(e) =>
                    setEditUserData({ ...editUserData, email: e.target.value })
                  }
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editUserData.phoneno}
                  onChange={(e) =>
                    setEditUserData({
                      ...editUserData,
                      phoneno: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
              </div>

              {editUserData.role !== "super_admin" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Assigned Company
                  </label>
                  <select
                    value={editUserData.companyId}
                    onChange={(e) =>
                      setEditUserData({
                        ...editUserData,
                        companyId: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all cursor-pointer"
                  >
                    <option value="" disabled>
                      -- Select Company --
                    </option>
                    {companies.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ✅ Corrected Dropdown matching the 3 active roles */}
              {user?.role === "super_admin" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    System Role
                  </label>
                  <select
                    value={editUserData.role}
                    onChange={(e) =>
                      setEditUserData({ ...editUserData, role: e.target.value })
                    }
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all cursor-pointer"
                  >
                    <option value="staff">Staff</option>
                    <option value="company_admin">Company Admin</option>
                    {/* ✅ Hide Super Admin option if the user has an assigned company */}
                    {!editUserData.companyId && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* === ✅ Delete Confirmation Modal === */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-slate-100 text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 size={28} />
            </div>

            <h3 className="text-xl font-black text-slate-800 mb-2">
              Delete Record?
            </h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              This action cannot be undone. Are you sure you want to permanently
              remove this user from the system?
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors w-full"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95 w-full"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
