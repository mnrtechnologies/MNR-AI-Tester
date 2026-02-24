import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiConnector } from "../../services/apiConnector"; 

const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
  });

  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));


    if (name === "email") {
      if (value && !value.endsWith("@mnrtechnologies.com")) {
        setEmailError("Only @mnrtechnologies.com emails are allowed");
      } else {
        setEmailError("");
      }
    }
  };

  const onSignupSubmit = async (e) => {
    e.preventDefault();

    if (emailError) return;

    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.confirmPassword ||
      !form.mobile
    ) {
      alert("Please fill all fields");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await apiConnector(
        "POST",
        "/auth/register",
        form
      );

      if (response.data.success) {
        alert("Account created successfully!");
        navigate("/login");
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Signup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md border border-orange-100">
        <div className="text-center mb-10">
          <div className="font-bold text-3xl mb-2 text-slate-800">
            MNR <span className="text-orange-500">AT</span>
          </div>
          <p className="text-gray-500">Create your account</p>
        </div>

        <form className="space-y-4" onSubmit={onSignupSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              onChange={handleChange}
              className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40"
              placeholder="John Doe"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 
              ${emailError 
                ? "border-red-300 focus:ring-red-400 bg-red-50" 
                : "border-orange-100 focus:ring-orange-400 bg-orange-50/40"}`}
              placeholder="name@mnrtechnologies.com"
            />

            {emailError && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile
            </label>
            <input
              type="text"
              name="mobile"
              onChange={handleChange}
              className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40"
              placeholder="9876543210"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              onChange={handleChange}
              className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              onChange={handleChange}
              className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || emailError}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md mt-4 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-orange-500 font-bold hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;