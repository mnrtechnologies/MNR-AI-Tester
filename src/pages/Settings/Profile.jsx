import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getUserDetails, updateBasicInfo } from "../../services/operations/authAPIs";
import { toast } from "react-hot-toast";
import { CreditCard, Calendar, Activity, Zap } from "lucide-react";

// Helper function to format dates nicely
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

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

  // --- Extract Subscription Details safely from Redux ---
  const subscriptions = user?.subscription || [];
  const currentSub = subscriptions[subscriptions.length - 1]; // Get the latest plan
  
  const planName = currentSub?.plan || "No Active Plan";
  const status = currentSub?.status || "N/A";
  const remainingDays = currentSub?.remainingDays || 0;
  
  const maxTests = currentSub?.planDetails?.maxTestsAllowed || 0;
  const testsUsed = currentSub?.planDetails?.testsUsed || 0;
  
  // Extract Dates (checking multiple possible schema keys just to be safe)
  const startDate = currentSub?.startDate || currentSub?.planActivatedDate || currentSub?.createdAt;
  const endDate = currentSub?.endDate || currentSub?.planExpireDate || currentSub?.trialEndDate;

  // Calculate percentage for the progress bar
  const isUnlimited = maxTests === -1;
  const usagePercentage = isUnlimited ? 0 : Math.min((testsUsed / maxTests) * 100, 100);

  return (
    <div className="max-w-5xl mx-auto mt-4 space-y-6">
      
      {/* ------------------------------------------- */}
      {/* SECTION 1: SUBSCRIPTION & USAGE DASHBOARD   */}
      {/* ------------------------------------------- */}
      {currentSub && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <CreditCard className="text-orange-500" size={20} />
            Current Plan & Usage
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Plan Info */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Active Plan</p>
              <p className="text-xl font-black text-slate-800 capitalize flex items-center gap-2">
                <Zap className="text-yellow-500" size={18} fill="currentColor" />
                {planName}
              </p>
              <p className={`text-sm font-medium mt-1 ${status === 'expired' ? 'text-rose-500' : 'text-emerald-500'}`}>
                Status: <span className="capitalize">{status}</span>
              </p>
            </div>

            {/* Time Remaining & Dates */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Time Remaining</p>
                <p className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="text-orange-400" size={18} />
                  {remainingDays} Days
                </p>
              </div>
              
              {/* NEW: Start and Expire Dates */}
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex justify-between text-xs text-slate-500 font-medium mb-1">
                  <span>Started:</span>
                  <span className="text-slate-700">{formatDate(startDate)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>Expires:</span>
                  <span className="text-slate-700">{formatDate(endDate)}</span>
                </div>
              </div>
            </div>

            {/* Tests Used (Numbers) */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">AI Test Executions</p>
              <p className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Activity className="text-blue-500" size={18} />
                {testsUsed} <span className="text-slate-400 text-sm font-semibold">/ {isUnlimited ? '∞' : maxTests}</span>
              </p>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                Tests consumed
              </p>
            </div>
          </div>

          {/* Progress Bar for Usage */}
          {!isUnlimited && (
            <div className="mt-2">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                <span>Usage Limit</span>
                <span>{Math.round(usagePercentage)}% Used</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    usagePercentage > 90 ? 'bg-rose-500' : usagePercentage > 75 ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${usagePercentage}%` }}
                ></div>
              </div>
              {usagePercentage >= 100 && (
                <p className="text-xs text-rose-500 font-semibold mt-2">
                  You have reached your testing limit. Please upgrade to continue.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* SECTION 2: PERSONAL INFORMATION FORM        */}
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
      
    </div>
  );
};

export default Profile;