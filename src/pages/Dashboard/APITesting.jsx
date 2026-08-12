import React, { useState } from "react";
import {
  Globe,
  ShieldCheck,
  Send,
  Loader2,
  Server,
  Key,
  Mail,
  Lock,
  Smartphone,
} from "lucide-react";
import SubscriptionGuard from "../../components/UI/SubscriptionGuard";

const API = process.env.REACT_APP_AI_API_TESTER_BACKEND_URL;

const APITesting = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    target_url: "",
    api_base_url: "",
    login_email: "",
    login_password: "",
    notify_email: "",
    otp_code: "",
    openai_key: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleTestUsage = async (e) => {
    e.preventDefault();
    setIsTesting(true);
    setResponse(null);
    setError(null);
    
    try {
      const res = await fetch(`${API}/api/runs/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          safe_mode: true, // Hardcoded to true, hidden from user
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to start the API test.");
      }

      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  // Helper to reset the form state
  const resetForm = () => {
    setResponse(null);
    setError(null);
  };

  return (
    <SubscriptionGuard>
      <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-6 px-4">
        {/* HERO SECTION */}
        <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-3xl p-8 md:p-10 border border-orange-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
              <ShieldCheck size={14} />
              <span>AI Security Tester</span>
            </div>

            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
              API <span className="text-orange-500">Guardian</span> Test Runner
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed mb-0">
              Configure your target environment below to initiate an automated,
              AI-driven security analysis of your API endpoints.
            </p>
          </div>

          {/* Graphical Placeholder */}
          <div className="w-56 h-56 relative z-10 flex items-center justify-center hidden md:flex">
            <div className="absolute inset-0 border-2 border-dashed border-orange-200 rounded-full animate-[spin_10s_linear_infinite]"></div>
            <div className="absolute inset-4 bg-white border border-orange-100 rounded-full shadow-lg flex items-center justify-center">
              <Globe className="text-orange-300" size={64} strokeWidth={1} />
            </div>
            <div className="absolute -top-2 right-4 bg-white px-3 py-2 rounded-lg shadow-md border border-slate-100 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-slate-700">200 OK</span>
            </div>
          </div>
        </div>

        {/* CONDITIONAL RENDER AREA (Form vs Loading vs Success vs Error) */}
        {isTesting ? (
          /* LOADING STATE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center animate-in fade-in">
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" />
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Initializing Security Scan...</h3>
            <p className="text-slate-500 text-center max-w-md">
              Please wait while our AI Guardian safely connects to your endpoints and prepares the analysis.
            </p>
          </div>
        ) : response ? (
          /* SUCCESS STATE */
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-emerald-600" size={28} />
              </div>
              <div className="flex-1">
                <h4 className="text-emerald-900 font-bold text-xl mb-2">
                  Scan Queued Successfully
                </h4>
                <p className="text-emerald-700 leading-relaxed mb-4 text-lg">
                  {response.message}
                </p>
                <div className="flex gap-4 text-sm font-mono text-emerald-800 bg-emerald-100/50 px-4 py-2 rounded-lg inline-flex mb-6">
                  <span>Run ID: {response.run_id}</span>
                  <span>•</span>
                  <span className="uppercase tracking-wider">
                    Status: {response.status}
                  </span>
                </div>
                
                <div className="border-t border-emerald-200 pt-6">
                  <button
                    onClick={resetForm}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    Run Another Scan
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          /* ERROR STATE */
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-600 font-bold text-2xl">!</span>
              </div>
              <div className="flex-1">
                <h4 className="text-red-900 font-bold text-xl mb-2">
                  Failed to Start Scan
                </h4>
                <p className="text-red-700 leading-relaxed text-lg mb-6">{error}</p>
                
                <div className="border-t border-red-200 pt-6">
                  <button
                    onClick={resetForm}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    Modify Form & Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* INPUT FORM STATE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Server className="text-orange-500" size={24} />
                Test Configuration
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Provide the necessary credentials and endpoints to start the scan.
              </p>
            </div>

            <form onSubmit={handleTestUsage} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Target URL */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    Target URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    name="target_url"
                    required
                    value={formData.target_url}
                    onChange={handleChange}
                    placeholder="https://app.yourdomain.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* API Base URL */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    API Base URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    name="api_base_url"
                    required
                    value={formData.api_base_url}
                    onChange={handleChange}
                    placeholder="https://api.yourdomain.com/v1"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* Login Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Mail size={16} className="text-slate-400" /> Login Email{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="login_email"
                    required
                    value={formData.login_email}
                    onChange={handleChange}
                    placeholder="testuser@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* Login Password */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Lock size={16} className="text-slate-400" /> Login Password{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="login_password"
                    required
                    value={formData.login_password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* Notify Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Mail size={16} className="text-slate-400" /> Notify Email
                    (For Results) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="notify_email"
                    required
                    value={formData.notify_email}
                    onChange={handleChange}
                    placeholder="admin@yourdomain.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* OTP Code */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Smartphone size={16} className="text-slate-400" /> OTP Code
                    (Optional)
                  </label>
                  <input
                    type="text"
                    name="otp_code"
                    value={formData.otp_code}
                    onChange={handleChange}
                    placeholder="123456"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700"
                  />
                </div>

                {/* OpenAI Key */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Key size={16} className="text-slate-400" /> OpenAI API Key{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="openai_key"
                    required
                    value={formData.openai_key}
                    onChange={handleChange}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-700 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Safe mode is strictly enforced. No destructive mutations will be
                  executed.
                </p>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-sm bg-orange-500 hover:bg-orange-600 active:scale-95"
                >
                  <Send className="w-5 h-5" />
                  Start Security Scan
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </SubscriptionGuard>
  );
};

export default APITesting;
