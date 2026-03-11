import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getUserDetails, updateBasicInfo } from "../../services/operations/authAPIs";
import { toast } from "react-hot-toast";

const Profile = () => {
  const dispatch = useDispatch();
  
  // Grab user and loading state from Redux
  const { user } = useSelector((state) => state.profile);
  const { loading } = useSelector((state) => state.auth);

  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    country: "",
    state: "",
    city: "",
  });

  // Fetch profile on mount if not already in Redux store
  useEffect(() => {
    const fetchProfile = async () => {
      setFetching(true);
      // If user isn't in Redux yet, fetch it
      if (!user) {
        await dispatch(getUserDetails());
      }
      setFetching(false);
    };

    fetchProfile();
  }, [dispatch, user]);

  // Sync Redux user state with local form data
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        mobile: user.mobile || "",
        country: user.country || "",
        state: user.state || "",
        city: user.city || "",
      });
    }
  }, [user]);

  // Handle input change
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Update profile
  const handleUpdate = () => {
    if (!formData.name || !formData.email) {
      toast.error("Name and Email are required.");
      return;
    }

    // Dispatch the Redux action
    // It automatically handles the API call, Redux state update, and Toasts
    dispatch(updateBasicInfo(formData));
  };

  if (fetching) {
    return (
      <div className="max-w-5xl mx-auto mt-10 text-center text-slate-400">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 max-w-5xl mx-auto mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {["name", "email", "mobile", "country", "state", "city"].map(
          (field) => (
            <div key={field}>
              <label className="text-xs font-bold text-slate-400 uppercase">
                {field}
              </label>

              <input
                name={field}
                type={field === "email" ? "email" : "text"}
                value={formData[field]}
                onChange={handleChange}
                className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
          )
        )}
      </div>

      <button
        onClick={handleUpdate}
        disabled={loading}
        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-8 py-3 rounded-lg mt-8 transition-all disabled:opacity-50"
      >
        {loading ? "Updating..." : "Save Changes"}
      </button>
    </div>
  );
};

export default Profile;