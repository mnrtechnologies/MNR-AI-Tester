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
  const [message, setMessage] = useState({ type: "", text: "" });
  const [fetching, setFetching] = useState(true); // for initial load

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          console.warn("No token found");
          setFetching(false);
          return;
        }

        const response = await axios.get(`${AUTH_BASE}/getUserDetails`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("PROFILE RESPONSE:", response.data);

        if (response.data.success) {
          const user = response.data.user;

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

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

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
        `${AUTH_BASE}/update-profile`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setMessage({ type: "success", text: response.data.message });

        const updated = response.data.data;

        setFormData({
          name: updated.name || "",
          email: updated.email || "",
          mobile: updated.mobile || "",
          country: updated.country || "",
          state: updated.state || "",
          city: updated.city || "",
        });
      }
    } catch (error) {
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
      {/* Message */}
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

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {["name", "email", "mobile", "country", "state", "city"].map(
              (field) => (
                <div className="space-y-1" key={field}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    {field}
                  </label>

                  <input
                    name={field}
                    type={field === "email" ? "email" : "text"}
                    value={formData[field]}
                    onChange={handleChange}
                    className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>
              )
            )}
          </div>

          <button
            onClick={handleUpdate}
            disabled={loading}
            className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold px-8 py-3 rounded-lg mt-8 transition-all disabled:opacity-50"
          >
            {loading ? "Updating..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;