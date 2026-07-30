import React, { useState, useEffect } from "react";
import DashboardCard from "../../../components/Dashboard/SuperAdmin/DashboardCard";
import { motion } from "framer-motion";
import {
  Building,
  Users,
  Briefcase,
  UserCheck,
  CreditCard,
  AlertCircle,
  Zap,
  Settings,
  ShieldCheck,
  Activity,
  Crown,
  ArrowLeft,
  Clock,
  DollarSign,
} from "lucide-react";

// IMPORTANT: Adjust this import path to point to where you exported getDashboardStats
import { getSuperAdminDashboardStats } from "../../../services/operations/DashboardAPI";
import { useNavigate } from "react-router-dom";

const SuperAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  // Fetch real data from your API
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const responseData = await getSuperAdminDashboardStats();
        if (responseData) {
          // If your API call returns the raw Axios response, unwrap the 'data' object here.
          // Fallback to responseData if getDashboardStats already unwraps it.
          setStats(responseData.data || responseData);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Map the API data to your UI layout (using exact keys from your JSON payload)
  const displayStats = [
    {
      label: "Total Companies",
      value: stats?.totalCompanies ?? "0",
      icon: <Building size={20} />,
    },
    {
      label: "Total Users",
      value: stats?.totalUsers ?? "0",
      icon: <Users size={20} />,
    },
    {
      label: "Total Staff",
      value: stats?.totalStaff ?? "0",
      icon: <UserCheck size={20} />,
    },
    {
      label: "Company Admins",
      value: stats?.totalCompanyAdmins ?? "0",
      icon: <Briefcase size={20} />,
    },
    {
      label: "Super Admins",
      value: stats?.totalSuperAdmins ?? "0",
      icon: <Crown size={20} />,
    },
    {
      label: "Active Subs",
      value: stats?.activeSubscriptions ?? "0",
      icon: <CreditCard size={20} />,
    },
    {
      label: "Expired Plans",
      value: stats?.expiredPlans ?? "0",
      icon: <AlertCircle size={20} />,
    },
    {
      label: "Credits Available",
      value: `${(stats?.totalCreditsAvailable ?? 0).toLocaleString()} / ${(stats?.totalCreditAllowance ?? 0).toLocaleString()}`,
      icon: <Zap size={20} />,
    },
    {
      label: "Credits Used Today",
      value: (stats?.creditsUsedToday ?? 0).toLocaleString(),
      icon: <Activity size={20} />,
    },
    {
      label: "Credits Reserved",
      value: (stats?.totalCreditsReserved ?? 0).toLocaleString(),
      icon: <Clock size={20} />,
    },
    {
      label: "MRR (USD)",
      value: `$${(stats?.mrrUsd ?? 0).toLocaleString()}`,
      icon: <DollarSign size={20} />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      {/* MINIMAL HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-1 mr-2 sm:mt-0 p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border border-orange-100">
            <ShieldCheck size={14} />
            <span>Root Access</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Super Admin Dashboard
          </h1>
        </div>
      </div>

      {/* STATS GRID */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
          <span className="text-orange-500">✦</span> Platform Overview
        </h3>

        {loading ? (
          // Changed to lg:grid-cols-3 to perfectly balance the 9 cards
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-slate-100 animate-pulse rounded-2xl border border-slate-50"
              ></div>
            ))}
          </div>
        ) : (
          // Changed to lg:grid-cols-3 to perfectly balance the 9 cards
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayStats.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-500"></div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-white border border-slate-100 text-orange-500 rounded-full flex items-center justify-center shadow-sm">
                    {item.icon}
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    {item.label}
                  </p>
                </div>

                <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                  {item.value}
                </h2>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* QUICK ACTIONS GRID */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
          <span className="text-orange-500">✦</span> Administrative Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DashboardCard
            title="Company Management"
            desc="Onboard new companies, manage active profiles, and configure global company settings."
            link="/dashboard/super-admin/companies-management"
            icon={<Building size={24} />}
          />
          <DashboardCard
            title="Subscription & Billing"
            desc="Activate licenses, process renewals, and monitor expired company plans."
            link="/dashboard/super-admin/subscriptions"
            icon={<CreditCard size={24} />}
          />
          <DashboardCard
            title="User Matrix"
            desc="View, audit, and modify access controls for all employees, managers, and clients."
            link="/dashboard/super-admin/users-management"
            icon={<Settings size={24} />}
          />
        </div>
      </div>
    </div>
  );
};

export default SuperAdmin;
