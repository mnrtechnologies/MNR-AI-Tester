import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  editUser,
  deleteUser,
  getUserById,
  getCompanyAllStaff,
} from "../../../services/operations/authAPIs";
import { getCompanyById } from "../../../services/operations/companyAPI";
import { Search, Pencil, Trash2, ArrowLeft, Building } from "lucide-react";

// Updated styles to include a distinct color for company_admin [cite: 4]
const accessStyles = {
  admin: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  company_admin: "bg-indigo-100 text-indigo-700 border border-indigo-200", // Distinct color for company admin
  staff: "bg-slate-100 text-slate-700 border border-slate-200",
  manager: "bg-orange-100 text-orange-700 border border-orange-200",
};

export default function CompanyStaffManagement() {
  const { user } = useSelector((state) => state.profile);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userNames, setUserNames] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [editUserData, setEditUserData] = useState({
    _id: "",
    name: "",
    email: "",
    role: "",
    companyId: "",
    phoneno: "",
  });

  const getName = (userId) => {
    if (!userId) return "Loading...";
    if (userNames[userId]) return userNames[userId];
    getUserById(userId).then((res) => {
      if (res?.name) {
        setUserNames((prev) => ({ ...prev, [userId]: res.name }));
      } else {
        setUserNames((prev) => ({ ...prev, [userId]: "Unknown" }));
      }
    });
    return "Loading...";
  };

  const fetchUsers = async () => {
    const fetchedUsers = await dispatch(getCompanyAllStaff());
    setUsers(fetchedUsers || []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditUser = async (user) => {
    setEditUserData({
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneno: user.phoneno || "",
      role: user.role,
      companyId: user.companyId || "",
    });

    if (user.companyId) {
      try {
        const company = await getCompanyById(user.companyId);
        setCompanyName(company?.name || "");
      } catch (err) {
        setCompanyName("");
      }
    } else {
      setCompanyName("");
    }
    setIsEditModalOpen(true);
  };

  const handleDeleteUser = (userId) => {
    setSelectedUserId(userId);
    setIsDeleteModalOpen(true);
  };

  const handleSaveUser = () => {
    const payload = {
      name: editUserData.name,
      email: editUserData.email,
      phoneno: editUserData.phoneno,
      role: editUserData.role,
      companyId: editUserData.companyId,
    };
    dispatch(editUser(editUserData._id, payload, fetchUsers));
    setIsEditModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6">
      
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
              User <span className="text-orange-500">Management</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
               Manage your organization staff, update access roles, and monitor activity.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
           <div className="w-full sm:w-auto flex items-center justify-between gap-3 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm font-bold text-sm">
              Total Users 
              <span className="bg-orange-100 text-orange-600 px-2.5 py-0.5 rounded-full text-xs">
                {users.length}
              </span>
           </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by name, role, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-700 shadow-sm focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all"
            />
            <div className="absolute right-3 top-2.5 flex items-center justify-center">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-left text-slate-500 uppercase tracking-wider font-bold text-xs">
            <tr>
              <th className="p-4 sm:p-5">User Details</th>
              <th className="p-4 sm:p-5">Access/Role</th>
              <th className="p-4 sm:p-5">Last Active</th>
              <th className="p-4 sm:p-5">Date Added</th>
              <th className="p-4 sm:p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users
              .filter((u) => {
                const query = search.toLowerCase();
                return (
                  u.name.toLowerCase().includes(query) ||
                  u.role?.toLowerCase().includes(query) ||
                  u.email.toLowerCase().includes(query)
                );
              })
              .map((user) => (
                <tr key={user._id} className="hover:bg-orange-50/30 transition-colors group">
                  <td className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-orange-50 border border-orange-100 flex items-center justify-center shadow-sm shrink-0">
                      {user.image ? (
                        <img src={user.image} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-orange-600">{user.name[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 line-clamp-1">{user.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5">
                    {/* Role display logic updated to show "admin" for "company_admin" [cite: 34] */}
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap ${accessStyles[user.role] || "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                      {user.role === "company_admin" ? "admin" : user.role}
                    </span>
                  </td>
                  <td className="p-4 sm:p-5 text-slate-600 font-medium whitespace-nowrap">{new Date(user.lastActive).toLocaleDateString()}</td>
                  <td className="p-4 sm:p-5 text-slate-500 whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 sm:p-5 text-right">
                    <div className="flex items-center justify-end gap-2 sm:gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-colors text-slate-400 shrink-0"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user._id)}
                        className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors text-slate-400 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        
        {users.length === 0 && (
          <div className="p-10 text-center text-slate-500 font-medium">
              No users found matching your criteria.
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-100 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-0"></div>
            <h3 className="text-2xl font-black text-slate-900 mb-6 relative z-10 tracking-tight">Update <span className="text-orange-500">User</span></h3>
            
            <div className="space-y-4 sm:space-y-5 relative z-10">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Name</label>
                <input
                  type="text"
                  value={editUserData.name}
                  onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 sm:py-3 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 sm:py-3 text-sm focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Organization</label>
                <input 
                  type="text" 
                  value={companyName} 
                  disabled 
                  className="w-full border border-slate-100 rounded-xl px-4 py-2.5 sm:py-3 text-sm bg-slate-50 text-slate-400 cursor-not-allowed" 
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-8 relative z-10">
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="px-5 sm:px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveUser} 
                className="px-5 sm:px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm border border-slate-100 shadow-2xl text-center">
            
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Delete User?</h3>
            <p className="text-sm sm:text-base text-slate-500 mb-8 leading-relaxed">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="w-full py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  dispatch(deleteUser(selectedUserId, fetchUsers));
                  setIsDeleteModalOpen(false); 
                }} 
                className="w-full py-2.5 sm:py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}