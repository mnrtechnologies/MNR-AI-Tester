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
      if (!user) {
        await dispatch(getUserDetails());
      }
      setFetching(false);
    };
    console.log("user",user)

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
    <div className="max-w-5xl mx-auto mt-4 space-y-6">
      
      {/* ------------------------------------------- */}
      {/* SECTION 1: PERSONAL INFORMATION FORM        */}
      {/* ------------------------------------------- */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-6">Personal Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {["name", "email", "mobile", "country", "state", "city"].map(
            (field) => (
              <div key={field}>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                  {field}
                </label>
                <input
                  name={field}
                  type={field === "email" ? "email" : "text"}
                  value={formData[field]}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all bg-slate-50 focus:bg-white"
                />
              </div>
            )
          )}
        </div>

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-8 py-3 rounded-lg mt-8 transition-all disabled:opacity-50"
        >
          {loading ? "Updating..." : "Save Changes"}
        </button>
      </div>

      {/* ------------------------------------------- */}
      {/* SECTION 2: SUPPORT                          */}
      {/* ------------------------------------------- */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Need Support?</h2>
        <p className="text-sm text-slate-600 mb-4">
          If you have any questions or are facing issues, feel free to reach out to our support team.
        </p>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-slate-700">Email:</span>
          <a 
            href="mailto:support@mnrtechnologies.com" 
            className="text-sm font-bold text-orange-500 hover:text-orange-600 hover:underline transition-all"
          >
            support@mnrtechnologies.com
          </a>
        </div>
      </div>
      
    </div>
  );
};

export default Profile;
