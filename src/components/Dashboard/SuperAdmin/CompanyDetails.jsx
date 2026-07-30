import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { 
  ArrowLeft, Building, Mail, MapPin, CreditCard, Users, Zap, Clock, ShieldAlert, Briefcase 
} from "lucide-react";
import { motion } from "framer-motion";

// --- REAL API IMPORTS ---
import { getCompanyById } from "../../../services/operations/companyAPI";
import { getSubscriptionById } from "../../../services/operations/subsAPIs"; 
import { getUserById } from "../../../services/operations/authAPIs";
import { getTier } from "../../../config/pricing/creditMath";

const CompanyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  
  const [userNames, setUserNames] = useState({ 
    companyAdmins: [], 
    employees: [] 
  });
  
  const [showAll, setShowAll] = useState({ 
    companyAdmins: false, 
    employees: false 
  });

  // --- FETCH REAL DATA ---
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        const compData = await getCompanyById(id);
        if (!compData) return;
        setCompany(compData);

        let subData = null;
        const subIdOrObject = compData.activeSubscriptionId || compData.subscription;
        
        if (subIdOrObject) {
          if (typeof subIdOrObject === "string") {
            subData = await getSubscriptionById(subIdOrObject);
          } else {
            subData = subIdOrObject; 
          }
        }
        setSubscription(subData);

        const fetchNames = async (usersOrIds = []) => {
          const results = await Promise.all(usersOrIds.map(async (item) => {
            if (typeof item === 'object' && item !== null) {
               return item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email;
            }
            const u = await dispatch(getUserById(item));
            return u ? (u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || "Unknown User") : "Unknown User";
          }));
          return results.filter(Boolean);
        };

        const [adminNames, staffNames] = await Promise.all([
          fetchNames(compData.admins),
          fetchNames(compData.staff)
        ]);

        setUserNames({
          companyAdmins: adminNames,
          employees: staffNames, 
        });

      } catch (error) {
        console.error("Error loading company details:", error);
      }
    };

    if (id) {
      loadCompanyData();
    }
  }, [id, dispatch]);

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Loading profile...</p>
      </div>
    );
  }

  // Redesigned User List Render with Scrollbar
  const renderUserList = (list, type, emptyMsg) => {
    // Increased limit to 10 since the container is now full-width
    const limit = 10; 
    const show = showAll[type];
    const displayed = show ? list : list.slice(0, limit);

    return (
      <div className="mt-3">
        {displayed.length ? (
          <div 
            className={`flex flex-wrap gap-2.5 ${
              show ? "max-h-[250px] overflow-y-auto pr-2 pb-2 custom-scrollbar" : ""
            }`}
          >
            {displayed.map((name, idx) => (
              <span 
                key={idx} 
                className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 italic text-sm">
            {emptyMsg}
          </div>
        )}
        
        {list.length > limit && (
          <button
            className="mt-4 px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg text-xs font-bold transition-colors w-full sm:w-auto"
            onClick={() => setShowAll({ ...showAll, [type]: !show })}
          >
            {show ? "Collapse List" : `View All ${list.length} Members`}
          </button>
        )}
      </div>
    );
  };

  // Credit figures, falling back to the legacy test quota for subscriptions
  // that predate the migration. (The old `apiCallsToday`/`apiLimitPerDay`
  // fallbacks were removed — no model has ever had those fields.)
  const creditAllowance =
    subscription?.credits?.monthlyAllowance ??
    subscription?.planDetails?.maxTestsAllowed ??
    0;
  const creditBalance =
    subscription?.credits?.balance ??
    Math.max(
      0,
      (subscription?.planDetails?.maxTestsAllowed || 0) -
        (subscription?.planDetails?.testsUsed || 0)
    );
  const creditReserved = subscription?.credits?.reserved || 0;
  const creditsUsed = Math.max(0, creditAllowance - creditBalance - creditReserved);
  const usagePercent = creditAllowance
    ? Math.min((creditsUsed / creditAllowance) * 100, 100)
    : 0;
  const reservedPercent = creditAllowance
    ? Math.min((creditReserved / creditAllowance) * 100, 100 - usagePercent)
    : 0;
  const tierName =
    getTier(subscription?.planType, subscription?.tierKey)?.name ||
    subscription?.legacyPlan ||
    "Legacy plan";

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:shadow-sm rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{company.name}</h1>
        </div>
      </div>

      {/* TOP ROW: Company Info & Subscription Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Overview Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 flex flex-col h-full">
          <h3 className="text-lg font-bold text-slate-800 pb-4 mb-5 border-b border-slate-100 flex items-center gap-2">
            <div className="p-2 bg-orange-50 text-orange-500 rounded-lg"><Building size={18} /></div>
            Corporate Overview
          </h3>
          <div className="space-y-5 text-sm text-slate-600 flex-grow">
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Mail className="text-slate-400" size={18} shrink-0 />
              <span className="font-medium text-slate-700 break-all">{company.email}</span>
            </div>
            <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <MapPin className="text-slate-400 mt-0.5" size={18} shrink-0 />
              <span className="font-medium text-slate-700 leading-relaxed">{company.address || "No address provided"}</span>
            </div>
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Clock className="text-slate-400" size={18} shrink-0 />
              <span className="font-medium text-slate-700">Registered: {new Date(company.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Subscription Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900 rounded-3xl shadow-xl p-6 lg:p-8 text-white relative overflow-hidden flex flex-col h-full">
          {/* Background design accent */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-orange-500/20 to-transparent rounded-bl-full pointer-events-none"></div>
          
          <h3 className="text-lg font-bold text-white pb-4 mb-5 border-b border-white/10 flex items-center gap-2 relative z-10">
            <div className="p-2 bg-white/10 text-orange-400 rounded-lg"><CreditCard size={18} /></div>
            License & Billing
          </h3>

          {subscription ? (
            <div className="space-y-5 text-sm text-slate-300 flex-grow flex flex-col justify-center relative z-10">
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                <span className="font-medium">Active Plan</span>
                <span className="font-bold text-white bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-md tracking-wide">
                  {tierName}
                </span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span>Status</span>
                <span className={`flex items-center gap-1.5 ${subscription.isActive ? "text-emerald-400" : "text-red-400"} font-bold uppercase tracking-wider text-xs`}>
                  <span className={`w-2 h-2 rounded-full ${subscription.isActive ? "bg-emerald-400" : "bg-red-400"}`}></span>
                  {subscription.isActive ? "Active" : "Expired"}
                </span>
              </div>
              
              {subscription.startDate && subscription.endDate && (
                <div className="flex justify-between items-center px-2">
                  <span>Current Cycle</span>
                  <span className="font-medium text-white">{new Date(subscription.startDate).toLocaleDateString()} - {new Date(subscription.endDate).toLocaleDateString()}</span>
                </div>
              )}
              
              <div className="pt-5 mt-2 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="flex items-center gap-2 font-medium text-white">
                    <Zap size={16} className="text-orange-400"/> Credits Available
                  </span>
                  <span className="font-mono text-white bg-white/10 px-2 py-0.5 rounded text-xs">
                    {creditBalance.toLocaleString()} / {creditAllowance.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700 flex">
                  <div
                    className={`h-2 transition-all duration-1000 ${usagePercent > 80 ? 'bg-red-500' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`}
                    style={{ width: `${usagePercent}%` }}
                  ></div>
                  {reservedPercent > 0 && (
                    <div
                      className="h-2 bg-amber-300 transition-all duration-1000"
                      style={{ width: `${reservedPercent}%` }}
                      title={`${creditReserved} credits reserved for a run in progress`}
                    ></div>
                  )}
                </div>
                <div className="flex justify-between text-xs text-slate-400 px-1">
                  <span>{creditsUsed.toLocaleString()} used this period</span>
                  {creditReserved > 0 && (
                    <span className="text-amber-300 font-semibold">
                      {creditReserved} reserved
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-white/5 rounded-xl border border-white/10 border-dashed flex-grow flex items-center justify-center relative z-10">
              <p className="text-slate-400 text-sm font-medium">No active billing profile detected.</p>
            </div>
          )}
        </motion.div>

      </div>

      {/* BOTTOM ROW: Users Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 w-full">
        <div className="flex justify-between items-center border-b border-slate-100 pb-5 mb-8">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Users size={20} /></div>
            Personnel Directory
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Total Members</span>
            <span className="bg-slate-900 text-white font-bold px-3 py-1 rounded-lg text-sm shadow-sm">
              {userNames.companyAdmins.length + userNames.employees.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Admins Section */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert size={18} className="text-emerald-500" />
                System Administrators
              </h4>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                {userNames.companyAdmins.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium">Users with full access to billing, settings, and organization controls.</p>
            <div className="flex-grow">
              {renderUserList(userNames.companyAdmins, "companyAdmins", "No administrators assigned to this organization.")}
            </div>
          </div>

          {/* Employees Section */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Briefcase size={18} className="text-blue-500" />
                Registered Employees
              </h4>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                {userNames.employees.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium">Standard staff members with access to assigned tests and dashboards.</p>
            <div className="flex-grow">
              {renderUserList(userNames.employees, "employees", "No employees currently registered.")}
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
};

export default CompanyDetails;