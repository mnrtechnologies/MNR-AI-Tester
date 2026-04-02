import React from "react";
import {
  Database,
  Server,
  Timer,
  AlertTriangle,
  Construction,
  Bell,
  ArrowRight
} from "lucide-react";

const DBTesting = () => {
  const plannedFeatures = [
    {
      title: "Schema Validation",
      desc: "Automated checks against your latest DB migrations.",
      icon: <Database size={20} />,
    },
    {
      title: "Query Performance",
      desc: "Live monitoring of Read/Write IOPS and slow query detection.",
      icon: <Timer size={20} />,
    },
    {
      title: "Integrity Alerts",
      desc: "Instant notifications for deadlocks and data anomalies.",
      icon: <AlertTriangle size={20} />,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-6">
      {/* HERO SECTION */}
      <div className="bg-white rounded-3xl p-10 border border-orange-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Decorative Background Blob */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-50 rounded-full blur-3xl opacity-60"></div>

        <div className="z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <Construction size={14} />
            <span>Coming Soon</span>
          </div>
          
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            Database <span className="text-orange-500">Validation</span> Matrix
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed mb-8">
            We are building a robust testing suite to monitor query execution, validate schema migrations, and ensure uninterrupted data flow across all your databases.
          </p>

        </div>

        <div className="w-48 h-48 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center relative z-10 shadow-inner">
          <Database className="text-slate-300" size={80} strokeWidth={1} />
          <div className="absolute bottom-4 right-4 bg-orange-500 w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-md animate-bounce">
            <Server className="text-white" size={20} />
          </div>
        </div>
      </div>

      {/* SNEAK PEEK SECTION */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-orange-500">✦</span> Sneak Peek: What to expect
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plannedFeatures.map((feature, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 transition-colors group">
              <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
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

export default DBTesting;