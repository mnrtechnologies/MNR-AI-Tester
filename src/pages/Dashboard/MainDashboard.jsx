import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  Smartphone,
  Database,
  Activity,
  FolderGit2,
  ArrowRight,
  ShieldCheck,
  Code2,
  TerminalSquare
} from "lucide-react";

const MainDashboard = () => {
  const navigate = useNavigate();

  const testingModules = [
    {
      title: "Web Testing",
      desc: "Configure and run end-to-end automated tests for web applications across multiple browsers.",
      path: "/web-testing",
      color: "bg-blue-500",
      lightBg: "bg-blue-50",
      iconColor: "text-blue-500",
      icon: <Globe size={28} />,
    },
    {
      title: "API Testing",
      desc: "Validate REST and GraphQL endpoints, check status codes, and monitor response schemas.",
      path: "/api-testing",
      color: "bg-orange-500",
      lightBg: "bg-orange-50",
      iconColor: "text-orange-500",
      icon: <Activity size={28} />,
    },
    {
      title: "Mobile Testing",
      desc: "Execute automated UI and functional tests for iOS and Android applications.",
      path: "/mobile-testing",
      color: "bg-emerald-500",
      lightBg: "bg-emerald-50",
      iconColor: "text-emerald-500",
      icon: <Smartphone size={28} />,
    },
    {
      title: "DB Testing",
      desc: "Verify data integrity, schema consistency, and execute automated migration checks.",
      path: "/db-testing",
      color: "bg-purple-500",
      lightBg: "bg-purple-50",
      iconColor: "text-purple-500",
      icon: <Database size={28} />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* --- BANNER HERO SECTION --- */}
      <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-3xl p-8 border border-orange-100 shadow-sm flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
        <div className="z-10 max-w-xl mb-6 md:mb-0">
          <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-100 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck size={14} />
            <span>Autonomous QA Platform</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">
            Welcome to <span className="text-orange-500">MNR AT</span>
          </h2>
          <p className="text-base text-slate-500 leading-relaxed font-medium">
            Select a testing module below to configure your environments, write test scripts, and launch automated executions. Manage all your configurations in the Projects section.
          </p>
        </div>

        {/* Decorative Graphic */}
        <div className="w-32 h-32 bg-white rounded-3xl border border-orange-100 shadow-lg flex items-center justify-center p-4 relative z-10 shrink-0 transform rotate-3 hover:rotate-0 transition-transform">
          <div className="text-slate-800 font-black text-2xl tracking-tighter text-center leading-tight">
            MNR<br/><span className="text-orange-500 text-3xl">AT</span>
          </div>
        </div>
        
        {/* Decorative blur */}
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-400/10 blur-3xl rounded-full pointer-events-none"></div>
      </div>

      {/* --- YOUR PROJECTS SECTION --- */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
          <span className="text-orange-500">✦</span> Workspace
        </h3>
        
        <div 
          onClick={() => navigate("/projects")}
          className="bg-slate-900 rounded-2xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden group cursor-pointer border border-slate-800 transition-all hover:shadow-orange-500/10 hover:border-orange-500/30"
        >
          {/* Background Accents */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-500/20 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute -bottom-8 -right-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
            <FolderGit2 size={120} />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="p-4 bg-white/10 rounded-2xl text-orange-400 backdrop-blur-sm">
                <FolderGit2 size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-2">Your Projects</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  View and manage all your active test suites, environment variables, and saved automation scripts.
                </p>
              </div>
            </div>
            
            <button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors shrink-0 w-fit">
              Open Workspace <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* --- TESTING MODULES GRID --- */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4 mt-8">
          <span className="text-orange-500">✦</span> Testing Modules
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testingModules.map((module, i) => (
            <div
              key={i}
              onClick={() => navigate(module.path)}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col"
            >
              {/* Corner Accent */}
              <div className={`absolute top-0 right-0 w-24 h-24 ${module.lightBg} rounded-bl-full -z-0 group-hover:scale-125 transition-transform duration-500`}></div>
              
              <div className="relative z-10 flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-white border border-slate-100 shadow-sm ${module.iconColor}`}>
                  {module.icon}
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 group-hover:${module.color} group-hover:text-white transition-colors`}>
                  <ArrowRight size={16} />
                </div>
              </div>

              <div className="relative z-10 flex-grow">
                <h4 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-slate-900 transition-colors">
                  {module.title}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {module.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default MainDashboard;