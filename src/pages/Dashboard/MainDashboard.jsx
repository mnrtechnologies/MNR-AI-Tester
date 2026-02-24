import React, { useState } from 'react';
import Calendar from 'react-calendar'; 

import 'react-calendar/dist/Calendar.css'; 
import { 
  Users, CheckCircle2, LayoutGrid, Network, 
  BarChart3, PieChart, History, Key, UserPlus, 
  Trash2, Edit3, ArrowRight 
} from 'lucide-react';

const MainDashboard = () => {
  const [date, setDate] = useState(new Date());

  const topStats = [
    { label: "On Boarded Users", value: "5", color: "bg-teal-500", icon: <Users size={16} /> },
    { label: "Mapped Users", value: "2", color: "bg-teal-400", icon: <CheckCircle2 size={16} /> },
    { label: "Projects", value: "3", color: "bg-teal-300", icon: <LayoutGrid size={16} /> },
    { label: "Organizations", value: "2", color: "bg-teal-200", icon: <Network size={16} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* --- TOP METRIC CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {topStats.map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            </div>
            <div className={`p-2 rounded-lg text-white ${stat.color}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* --- BANNER HERO SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-8 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="z-10 max-w-md">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Built by Advent Global Solutions Inc</p>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">SensuQ Dashboard</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Crafted with precision and innovation, this solution is brought to you by Advent Global Solutions Inc.
            </p>
          </div>
          <div className="w-32 h-32 bg-teal-50 rounded-2xl flex items-center justify-center p-4">
            <div className="text-teal-600 font-black text-2xl italic tracking-tighter">sensu<span className="text-orange-400">Q</span></div>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden group shadow-lg">
          <img 
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" 
            alt="Autopilot" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
            <h3 className="text-xl font-bold text-white mb-2">SensuQ Autopilot</h3>
            <button className="flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-white/30 transition-all w-fit">
              Explore Auto Pilot <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

{/* --- CHARTS SECTION --- */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Monthly Bar Chart */}
  <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl p-6 text-white shadow-xl">
    <h3 className="flex items-center gap-2 font-medium mb-12 text-sm">
      <BarChart3 size={18} className="text-teal-400" />
      Monthly wise Registered Users Vs Mapped Users
    </h3>
    
    {/* Explicit height and flex alignment to make bars visible */}
    <div className="h-48 flex items-end justify-between gap-3 px-2">
      {[40, 65, 30, 85, 45, 90, 50, 75].map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-2 w-full group">
          <div className="flex gap-1.5 w-full justify-center items-end h-full">
            {/* Registered Users Bar */}
            <div className="w-2.5 bg-teal-600 rounded-t-sm transition-all duration-500 hover:opacity-80" 
                 style={{ height: `${h}%`, minHeight: '4px' }}></div>
            {/* Approved Users Bar */}
            <div className="w-2.5 bg-teal-400 rounded-t-sm transition-all duration-500 hover:opacity-80" 
                 style={{ height: `${h * 0.7}%`, minHeight: '4px' }}></div>
            {/* Mapped Users Bar */}
            <div className="w-2.5 bg-slate-400 rounded-t-sm transition-all duration-500 hover:opacity-80" 
                 style={{ height: `${h * 0.4}%`, minHeight: '4px' }}></div>
          </div>
          <span className="text-[10px] text-slate-500 font-bold mt-2">
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG'][i]}
          </span>
        </div>
      ))}
    </div>
  </div>

  {/* Traffic Sources Donut Chart */}
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center">
    <div className="w-full mb-8 flex items-center gap-2">
      <PieChart size={18} className="text-teal-500" />
      <h3 className="font-semibold text-slate-700 text-sm">Traffic Sources</h3>
    </div>
    
    <div className="relative w-44 h-44">
      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
        {/* Background Circle */}
        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-50" strokeWidth="3.8"></circle>
        
        {/* Organizations Segment (Teal) */}
        <circle cx="18" cy="18" r="16" fill="none" className="stroke-teal-600" strokeWidth="4" 
                strokeDasharray="45 100" strokeDashoffset="0"></circle>
        
        {/* Projects Segment (Teal-400) */}
        <circle cx="18" cy="18" r="16" fill="none" className="stroke-teal-400" strokeWidth="4" 
                strokeDasharray="30 100" strokeDashoffset="-45"></circle>
                
        {/* Users Segment (Teal-100) */}
        <circle cx="18" cy="18" r="16" fill="none" className="stroke-teal-100" strokeWidth="4" 
                strokeDasharray="7 100" strokeDashoffset="-75"></circle>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-slate-800">82%</div>
    </div>

    <div className="mt-8 w-full grid grid-cols-2 gap-y-3 px-2">
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
        <div className="w-2.5 h-2.5 rounded-full bg-teal-600"></div> Organizations
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
        <div className="w-2.5 h-2.5 rounded-full bg-teal-400"></div> Projects
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
        <div className="w-2.5 h-2.5 rounded-full bg-teal-100"></div> Users
      </div>
    </div>
  </div>
</div>

      {/* --- CALENDAR & LOGS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CALENDAR */}
        <div className="bg-[#5eead4] rounded-2xl p-4 text-white shadow-lg custom-calendar-container">
          <Calendar 
            onChange={setDate} 
            value={date} 
            className="border-none bg-transparent text-white w-full"
            next2Label={null}
            prev2Label={null}
          />
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-medium text-slate-700 mb-6 border-b pb-4">📚 Activity Log</h3>
          <div className="space-y-6">
             <ActivityItem bg="bg-green-500" icon={<Key size={14}/>} title="Super Admin logged in" time="03:30 PM" />
             <ActivityItem bg="bg-blue-400" icon={<Edit3 size={14}/>} title="Updated user permissions" time="08:00 PM" />
             <ActivityItem bg="bg-red-500" icon={<Trash2 size={14}/>} title="Deleted account" time="02:45 PM" />
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityItem = ({ icon, bg, title, time }) => (
  <div className="flex items-start gap-4">
    <div className={`p-2 rounded-full ${bg} text-white shrink-0 flex items-center justify-center`}>
      {icon}
    </div>
    <div className="flex-1">
      <h4 className="text-sm font-medium text-slate-800">{title}</h4>
      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><History size={10}/> {time}</p>
    </div>
  </div>
);

export default MainDashboard;