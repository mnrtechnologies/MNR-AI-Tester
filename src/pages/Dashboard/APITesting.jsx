import React, { useState } from "react";
import { useDispatch } from "react-redux";
import {
  Globe,
  Activity,
  ShieldCheck,
  Construction,
  Clock,
  Send,
  Loader2 // Added for a loading spinner
} from "lucide-react";

// TODO: Update this import path to point to your actual file
import { incrementTestUsage } from "../../services/operations/subsAPIs";

const APITesting = () => {
  const dispatch = useDispatch();
  const [isTesting, setIsTesting] = useState(false);

  const handleTestUsage = async () => {
    setIsTesting(true);
    
    // Dispatch the thunk action and wait for the true/false response
    const success = await dispatch(incrementTestUsage());
    
    if (success) {
      console.log("Usage successfully incremented in Redux!");
      // The toast.error is already handled inside the Redux action on failure,
      // but you could add a toast.success here if desired.
    }
    
    setIsTesting(false);
  };

  const plannedFeatures = [
    {
      title: "Endpoint Monitoring",
      desc: "Track status codes, uptime, and global latency in real-time.",
      icon: <Activity size={20} />,
    },
    {
      title: "Contract Testing",
      desc: "Ensure your API responses strictly adhere to predefined schemas.",
      icon: <ShieldCheck size={20} />,
    },
    {
      title: "Automated Load Testing",
      desc: "Simulate thousands of concurrent requests to test server limits.",
      icon: <Clock size={20} />,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-6">
      {/* HERO SECTION */}
      <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-3xl p-10 border border-orange-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        
        <div className="z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <Construction size={14} />
            <span>Coming Soon</span>
          </div>
          
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            API <span className="text-orange-500">Guardian</span> & Load Matrix
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed mb-8">
            Automate REST and GraphQL endpoint testing. We're finalizing the tools you need to secure and monitor your backend infrastructure.
          </p>

          {/* ACTION BUTTON */}
          <button 
           // onClick={handleTestUsage}
            disabled={isTesting}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-sm
              ${isTesting 
                ? 'bg-orange-400 cursor-not-allowed' 
                : 'bg-orange-500 hover:bg-orange-600 active:scale-95'}`}
          >
            {isTesting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {isTesting ? "Executing Test..." : "Run Manual API Test"}
          </button>
        </div>

        {/* Graphical Placeholder */}
        <div className="w-56 h-56 relative z-10 flex items-center justify-center hidden md:flex">
          {/* Dashed outer circle */}
          <div className="absolute inset-0 border-2 border-dashed border-orange-200 rounded-full animate-[spin_10s_linear_infinite]"></div>
          {/* Inner circle */}
          <div className="absolute inset-4 bg-white border border-orange-100 rounded-full shadow-lg flex items-center justify-center">
            <Globe className="text-orange-300" size={64} strokeWidth={1} />
          </div>
          {/* Floating badge */}
          <div className="absolute -top-2 right-4 bg-white px-3 py-2 rounded-lg shadow-md border border-slate-100 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-slate-700">200 OK</span>
          </div>
        </div>
      </div>

      {/* SNEAK PEEK SECTION */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-orange-500">✦</span> What's on the roadmap
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plannedFeatures.map((feature, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="w-10 h-10 bg-white border border-slate-100 text-orange-500 rounded-full flex items-center justify-center mb-4 shadow-sm">
                {feature.icon}
              </div>
              <h4 className="font-bold text-slate-800 mb-2">{feature.title}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default APITesting;