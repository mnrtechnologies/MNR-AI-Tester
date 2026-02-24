import React from 'react';
import { Link } from 'react-router-dom';

const Signup = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border">
        <div className="text-center mb-10">
          <div className="font-bold text-3xl mb-2 text-slate-800">
            sensu<span className="text-orange-500">Q</span>
          </div>
          <p className="text-gray-500">Create your account</p>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500" placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500" placeholder="john@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" name="password" className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500" placeholder="••••••••" />
          </div>
          <button className="w-full bg-teal-500 text-white py-3 rounded-xl font-bold hover:bg-teal-600 transition shadow-md mt-4">
            Sign Up
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account? <Link to="/login" className="text-teal-600 font-bold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
};

// CRITICAL: Ensure this line exists!
export default Signup;