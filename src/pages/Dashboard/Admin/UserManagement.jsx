import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  getAllUsers,
  editUser,
  deleteUser,
} from "../../../services/operations/authAPIs";
import { UserPlus, Search, Pencil, Trash2 } from "lucide-react";

const accessStyles = {
  Admin: "bg-green-100 text-green-600",
  "Data Export": "bg-blue-100 text-blue-600",
  "Data Import": "bg-purple-100 text-purple-600",
};

export default function UserManagement() {
  const { user } = useSelector((state) => state.profile);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState({
    _id: "",
    name: "",
    email: "",
    role: "",
  });
  const [selectedUserId, setSelectedUserId] = useState(null);

  const fetchUsers = async () => {
    const fetchedUsers = await dispatch(getAllUsers());
    setUsers(fetchedUsers);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditUser = (user) => {
    setEditUserData({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteUser = (userId) => {
    setSelectedUserId(userId);
    setIsDeleteModalOpen(true);
  };

  // Handel edit save
  const handleSaveUser = () => {
    const payload = {
      name: editUserData.name,
      email: editUserData.email,
      role: editUserData.role,
    };
    //console.log("data",editUserData)
    dispatch(editUser(editUserData._id, payload, fetchUsers));
    setIsEditModalOpen(false);
  };

  return (
    <div className="px-4 sm:px-6 pt-4 pb-6">
      <h2 className="text-lg sm:text-xl font-bold text-blue-900">
        User Management
      </h2>
      <p className="text-sm sm:text-md text-slate-500 mb-6">
        Manage your team members and their account permissions here.
      </p>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3 sm:gap-0">
        <div className="font-semibold text-sm sm:text-base">
          All Users <span className="text-slate-500">{users.length}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search Here…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 pr-10 text-sm shadow-sm"
            />
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <button
            onClick={() =>
              navigate("/admin/user-management/add-user")
            }
            className="bg-[#00254D] text-white px-4 py-2 rounded-md text-sm flex flex-row sm:flex-row items-center justify-center gap-3 sm:gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* --- ✅ Mobile Card View --- */}
      <div className="block md:hidden space-y-4 mt-4">
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
            <div
              key={user._id}
              className="border rounded-lg p-4 shadow-sm space-y-2"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-gray-700">
                        {user.name[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-base font-semibold">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Pencil
                    className="w-4 h-4 text-gray-500 hover:text-blue-600 cursor-pointer"
                    onClick={() => handleEditUser(user)}
                  />
                  <Trash2
                    className="w-4 h-4 text-red-500 hover:text-red-700 cursor-pointer"
                    onClick={() => handleDeleteUser(user._id)}
                  />
                </div>
              </div>
              <div className="text-sm">
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    accessStyles[user.role] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                <p>
                  Last Active: {new Date(user.lastActive).toLocaleDateString()}
                </p>
                <p>
                  Date Added: {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
      </div>

      {/* --- ✅ Desktop Table View --- */}
      <div className="hidden md:block border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="p-3">
                <input type="checkbox" />
              </th>
              <th className="p-3">User Name</th>
              <th className="p-3">Access</th>
              <th className="p-3">Last Active ↓</th>
              <th className="p-3">Date Added</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
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
                <tr key={user._id} className="border-t text-md">
                  <td className="p-3">
                    <input type="checkbox" />
                  </td>
                  <td className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt="User"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-medium text-gray-700">
                          {user.name[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        accessStyles[user.role] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    {new Date(user.lastActive).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 flex gap-2">
                    <Pencil
                      className="w-4 h-4 text-gray-500 hover:text-blue-600 cursor-pointer"
                      onClick={() => handleEditUser(user)}
                    />
                    <Trash2
                      className="w-4 h-4 text-red-500 hover:text-red-700 cursor-pointer"
                      onClick={() => handleDeleteUser(user._id)}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* === ✅ Edit User Modal === */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-blue-900">
              Update User Details
            </h3>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editUserData.name}
                  onChange={(e) =>
                    setEditUserData({ ...editUserData, name: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editUserData.email}
                  onChange={(e) =>
                    setEditUserData({ ...editUserData, email: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            {user?.role === "Admin" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editUserData.role}
                  onChange={(e) =>
                    setEditUserData({ ...editUserData, role: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-gray-200 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 bg-[#00254D] text-white rounded-md text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === ✅ Delete Confirmation Modal === */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-[#00254D]">
              Delete User
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this user? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-gray-200 rounded-md text-sm "
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  dispatch(deleteUser(selectedUserId, fetchUsers));
                  setIsDeleteModalOpen(false);
                }}
                className="px-4 py-2 bg-[#00254D] hover:bg-red-600 text-white rounded-md text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
