import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardCard from "../../../components/Dashboard/SuperAdmin/DashboardCard";
import { useNavigate } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  Megaphone,
  CreditCard,
  Building2,
  UserCheck,
  Briefcase,
  ArrowLeft,
  Zap,
  Activity,
  Award,
  PlusCircle,
  Clock,
} from "lucide-react";

// IMPORTANT: Adjust this import path to match where you saved the API function
import { getCompanyAdminDashboardStats } from "../../../services/operations/DashboardAPI";

const CompanyAdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  // Fetch real data from the API
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await getCompanyAdminDashboardStats();
        if (data) {
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching org stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Map the API data to your UI layout
  const displayStats = [
    { label: "Total Users", value: stats?.totalUsers ?? "0", icon: <Users size={20} /> },
    { label: "Total Staff", value: stats?.totalStaff ?? "0", icon: <Briefcase size={20} /> },
    { label: "Organization Admins", value: stats?.totalCompanyAdmins ?? "0", icon: <UserCheck size={20} /> },
    {
      label: "License Status",
      value: stats?.credits?.status
        ? stats.credits.status.charAt(0).toUpperCase() + stats.credits.status.slice(1)
        : "None",
      icon: <CreditCard size={20} />
    },
    {
      label: "Active Plan",
      value: stats?.credits?.tierName || "N/A",
      icon: <Award size={20} />
    },
    {
      label: "Credits Remaining",
      value: `${(stats?.credits?.balance ?? 0).toLocaleString()} / ${(stats?.credits?.monthlyAllowance ?? 0).toLocaleString()}`,
      icon: <Zap size={20} />
    },
    {
      // Held for a run in progress — neither spent nor available. Shown
      // separately so a run in flight doesn't look like a vanished balance.
      label: "Credits Reserved",
      value: (stats?.credits?.reserved ?? 0).toLocaleString(),
      icon: <Clock size={20} />
    },
    {
      label: "Credits Used Today",
      value: (stats?.credits?.creditsUsedToday ?? 0).toLocaleString(),
      icon: <Activity size={20} />
    },
    { 
      label: "Activate/Renew Sub..", 
      value: "Manage", 
      icon: <PlusCircle size={20} />, 
      isAction: true 
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* MINIMAL HEADER WITH BACK BUTTON */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border border-orange-100">
              <Building2 size={14} />
              <span>Organization Admin</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {stats?.companyName ? `${stats.companyName} Dashboard` : "Command Center"}
            </h1>
          </div>
        </div>
      </div>

      {/* STATS GRID */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
          <span className="text-orange-500">✦</span> Organization Overview
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-slate-100 animate-pulse rounded-2xl border border-slate-50"
              ></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayStats.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={item.isAction ? () => navigate("/upgrade-plan") : undefined}
                className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group ${item.isAction ? "cursor-pointer hover:border-orange-300" : ""}`}
              >
                <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-150 ${item.isAction ? "bg-orange-100" : "bg-orange-50"}`}></div>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-white border border-slate-100 text-orange-500 rounded-full flex items-center justify-center shadow-sm">
                    {item.icon}
                  </div>
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                </div>
                
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">{item.value}</h2>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ADMINISTRATIVE MODULES GRID */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
          <span className="text-orange-500">✦</span> Administrative Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard
            title="Staff Management"
            desc="Manage employee profiles and organizational structure."
            link="/organization-admin-dashboard/staff-management"
            icon={<Users size={24} />}
          />
          <DashboardCard
            title="Onboard Staff"
            desc="Update corporate governance and distribute policies."
            link="/organization-admin-dashboard/staff-management/add-staff"
            icon={<ShieldCheck size={24} />}
          />
          <DashboardCard
            title="Organization Profile"
            desc="Broadcast Organization-wide announcements and alerts."
            link="/organization-admin-dashboard/organization-profile"
            icon={<Megaphone size={24} />}
          />
        </div>
      </div>


    </div>
  );
};

export default CompanyAdminDashboard;