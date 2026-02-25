import React, { useState, useEffect } from "react";
import axios from "axios";

// Backend base URL
const AUTH_BASE = process.env.REACT_APP_AUTH_URL || "http://localhost:4000/api";

const Profile = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    country: "",
    state: "",
    city: "",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  //Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          console.warn("No token found");
          setFetching(false);
          return;
        }

        const response = await axios.get(`${AUTH_BASE}/auth/getUserDetails`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("PROFILE RESPONSE:", response.data);

        // Handle different backend response formats
        const user =
          response.data?.user ||
          response.data?.data?.user ||
          response.data?.data ||
          response.data;

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
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, []);

  //-- Handle input change
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // --Update profile
  const handleUpdate = async () => {
    if (!formData.name || !formData.email) {
      setMessage({ type: "error", text: "Name and Email are required." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const token = localStorage.getItem("token");

      const response = await axios.put(
        `${AUTH_BASE}/auth/update-profile`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log("UPDATE RESPONSE:", response.data);

      if (response.data.success) {
        setMessage({ type: "success", text: response.data.message });

        const updatedUser =
          response.data.data || response.data.user || response.data;

        setFormData((prev) => ({
          ...prev,
          name: updatedUser.name || "",
          email: updatedUser.email || "",
          mobile: updatedUser.mobile || "",
          country: updatedUser.country || "",
          state: updatedUser.state || "",
          city: updatedUser.city || "",
        }));
      }
    } catch (error) {
      console.error("Update error:", error);
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Update failed",
      });
    } finally {
      setLoading(false);
    }
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
      {message.text && (
        <div
          className={`mb-6 p-3 rounded text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-600 border border-green-100"
              : "bg-red-50 text-red-600 border border-red-100"
          }`}
        >
          {message.text}
        </div>
      )}

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
                className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>
          ),
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
