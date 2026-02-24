import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/dashboard'); 
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border">
        <div className="text-center mb-10">
          <div className="font-bold text-3xl mb-2 text-slate-800">sensu<span className="text-orange-500">Q</span></div>
          <p className="text-gray-500">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input type="email" required className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition" placeholder="you@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input type="password" required className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition" placeholder="••••••••" />
          </div>
          <button type="submit" className="w-full bg-teal-500 text-white py-3 rounded-xl font-bold hover:bg-teal-600 transition shadow-md">
            Sign In
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          New here? <Link to="/signup" className="text-teal-600 font-bold hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;