import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Ensure this URL matches your backend port
const AUTH_BASE = process.env.REACT_APP_AUTH_URL || "http://localhost:4000/api/auth"; 

const Profile = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    country: '',
    state: '',
    city: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 1. Fetch initial data on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        // NOTE: Ensure your backend has a GET route for /get-profile
        const response = await axios.get(`${AUTH_BASE}/get-profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setFormData(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 2. Submit data to updateBasicInfo API
  const handleUpdate = async () => {
    if (!formData.name || !formData.email) {
      setMessage({ type: 'error', text: 'Name and Email are required.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${AUTH_BASE}/update-profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        setFormData(response.data.data); 
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Update failed' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 max-w-5xl mx-auto mt-4">
      {/* Success/Error Message Display */}
      {message.text && (
        <div className={`mb-6 p-3 rounded text-sm font-bold ${
          message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">


        {/* Right Side: Form Fields */}
        <div className="flex-1">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</label>
                <input 
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" 
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                <input 
                  name="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" 
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile</label>
                <input 
                  name="mobile"
                  value={formData.mobile || ''}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" 
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Country</label>
                <input 
                  name="country"
                  value={formData.country || ''}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" 
                  placeholder="Country"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">State</label>
                <input 
                  name="state"
                  value={formData.state || ''}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" 
                  placeholder="State"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                <input 
                  name="city"
                  value={formData.city || ''}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 outline-none" 
                  placeholder="City"
                />
              </div>
           </div>

           <button 
             onClick={handleUpdate}
             disabled={loading}
             className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold px-8 py-3 rounded-lg mt-8 transition-all disabled:opacity-50"
           >
             {loading ? 'Updating...' : 'Save Changes'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;