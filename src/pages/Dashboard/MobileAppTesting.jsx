import React from "react";
import {
  Smartphone,
  Tablet,
  Bug,
  Construction,
  MonitorPlay,
  Mail
} from "lucide-react";

const MobileAppTesting = () => {
  const plannedFeatures = [
    {
      title: "Real Device Farm",
      desc: "Execute tests simultaneously across iOS and Android real devices.",
      icon: <Smartphone size={20} />,
    },
    {
      title: "AI Bug Locator",
      desc: "Automatically detect UI glitches and alignment issues across screen sizes.",
      icon: <Bug size={20} />,
    },
    {
      title: "Automated Scripts",
      desc: "Record and playback user journeys with zero-code integrations.",
      icon: <MonitorPlay size={20} />,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-6">
      {/* HERO SECTION */}
      <div className="bg-[#1e293b] rounded-3xl p-10 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-orange-500/30">
            <Construction size={14} />
            <span>In Development</span>
          </div>
          
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">
            Cross-Platform <span className="text-orange-400">Mobile Lab</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            The ultimate testing environment for your mobile applications is under construction. Get ready to test natively without maintaining your own devices.
          </p>


        </div>

        {/* Abstract Mobile UI Illustration */}
        <div className="relative w-48 h-64 z-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-[2rem] border-4 border-slate-600 shadow-2xl overflow-hidden">
             <div className="w-1/2 h-1 bg-slate-500 mx-auto mt-3 rounded-full opacity-50"></div>
             <div className="mt-8 space-y-3 px-4">
               <div className="w-full h-8 bg-slate-600/50 rounded-lg animate-pulse"></div>
               <div className="w-3/4 h-4 bg-slate-600/50 rounded-lg animate-pulse"></div>
               <div className="w-5/6 h-4 bg-slate-600/50 rounded-lg animate-pulse delay-75"></div>
             </div>
          </div>
          <div className="absolute -bottom-4 -left-4 bg-orange-500 text-white p-3 rounded-xl shadow-lg rotate-12">
            <Tablet size={24} />
          </div>
        </div>
      </div>

      {/* SNEAK PEEK SECTION */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-orange-500">✦</span> Key Capabilities Landing Soon
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plannedFeatures.map((feature, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center mb-4">
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

export default MobileAppTesting;