import React, { useEffect, useState } from "react"; 
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { Building, CreditCard, ShieldCheck, Mail, MapPin, Users, Zap, Clock, ArrowLeft, History } from "lucide-react";

// IMPORTANT: Adjust these import paths to match your project's folder structure
import { getCompanyById } from "../../../services/operations/companyAPI";
import { getSubscriptionById } from "../../../services/operations/subsAPIs";
import { getCompanyAllStaff } from "../../../services/operations/authAPIs";
import { getCreditLedger } from "../../../services/operations/creditAPIs";
import { getTier, formatPrice } from "../../../config/pricing/creditMath";

/** How each ledger movement should read to a customer. */
const LEDGER_LABELS = {
  grant: { label: "Credits added", tone: "text-emerald-600" },
  hold: { label: "Reserved for a run", tone: "text-amber-600" },
  commit: { label: "Used by a test run", tone: "text-slate-700" },
  release: { label: "Returned unused", tone: "text-emerald-600" },
  overage: { label: "Extra credits", tone: "text-orange-600" },
  adjust: { label: "Manual adjustment", tone: "text-slate-700" },
  reset: { label: "Monthly reset", tone: "text-emerald-600" },
  migration: { label: "Converted from previous plan", tone: "text-slate-500" },
  expire: { label: "Subscription expired", tone: "text-rose-600" },
};

const CompanySubscription = () => {
  const { user } = useSelector((state) => state.profile);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  
  const [userNames, setUserNames] = useState({ admins: [], employees: [] });
  const [showAll, setShowAll] = useState({ admins: false, employees: false });
  const [isLoading, setIsLoading] = useState(true);

  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLedgerLoading(true);
      const result = await getCreditLedger({ limit: 25 });
      if (cancelled) return;
      setLedger(result.ok ? result.data.rows : []);
      setLedgerLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user?.companyId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // 1. Fetch Company Data
        const companyData = await getCompanyById(user.companyId);
        setCompany(companyData);

        // 2. Fetch Subscription Data
        const targetSubId = companyData?.activeSubscriptionId; 
        if (targetSubId) {
          const subData = await getSubscriptionById(targetSubId);
          setSubscription(subData);
        }

        // 3. Fetch Personnel Roster
        const staffList = await dispatch(getCompanyAllStaff());
        
        if (staffList && Array.isArray(staffList)) {
          const groupedUsers = { admins: [], employees: [] };
          
          staffList.forEach((staff) => {
            const role = staff.role?.toLowerCase() || "employee";
            
            if (role.includes("admin")) {
              groupedUsers.admins.push(staff.name);
            } else {
              groupedUsers.employees.push(staff.name);
            }
          });

          setUserNames(groupedUsers);
        }

      } catch (error) {
        console.error("Error fetching organization profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizationData();
  }, [user, dispatch]);

  if (isLoading || !company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Loading organization profile...</p>
      </div>
    );
  }

  const renderUserList = (list, type) => {
    const limit = 6; // Increased limit slightly since we have a scrollable container now
    const show = showAll[type];
    const displayed = show ? list : list.slice(0, limit);

    return (
      <div className="mt-2 text-sm text-slate-600">
        {displayed.length ? (
          <div className="flex flex-wrap gap-2">
            {displayed.map((name, idx) => (
              <span key={idx} className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">{name}</span>
            ))}
          </div>
        ) : (
          <span className="italic text-slate-400">None assigned</span>
        )}
        
        {list.length > limit && (
          <button
            className="mt-3 text-xs font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors"
            onClick={() => setShowAll({ ...showAll, [type]: !show })}
          >
            {show ? "View Less" : `View All (${list.length})`}
          </button>
        )}
      </div>
    );
  };

  // Credit figures. Falls back to the legacy test quota so an unmigrated
  // company still sees real numbers rather than zeroes.
  const credits = subscription?.credits;
  const allowance =
    credits?.monthlyAllowance ?? subscription?.planDetails?.maxTestsAllowed ?? 0;
  const balance =
    credits?.balance ??
    Math.max(
      0,
      (subscription?.planDetails?.maxTestsAllowed || 0) -
        (subscription?.planDetails?.testsUsed || 0)
    );
  const reserved = credits?.reserved || 0;
  const creditsUsed = Math.max(0, allowance - balance - reserved);

  const usagePercentage = allowance ? Math.min((creditsUsed / allowance) * 100, 100) : 0;
  const reservedPercentage = allowance
    ? Math.min((reserved / allowance) * 100, 100 - usagePercentage)
    : 0;
  const isNearingLimit = usagePercentage > 90;

  const tier = getTier(subscription?.planType, subscription?.tierKey);
  const tierName = tier?.name || subscription?.legacyPlan || "Legacy plan";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* HEADER WITH BACK BUTTON */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border border-orange-100">
            <ShieldCheck size={14} />
            <span>Organization Settings</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Organization Profile</h1>
        </div>
      </div>

      {/* TOP ROW: Company Details (Left) & Subscription (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Company Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
            <Building className="text-orange-500" size={18} /> {company.name}
          </h3>
          <div className="space-y-4 text-sm text-slate-600 flex-grow">
            <div className="flex items-start gap-3">
              <Mail className="text-slate-400 mt-0.5" size={16} shrink-0 />
              <span className="break-all">{company.email}</span>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="text-slate-400 mt-0.5" size={16} shrink-0 />
              <span>{company.address || "Address not provided"}</span>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="text-slate-400 mt-0.5" size={16} shrink-0 />
              <span>Registered: {new Date(company.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Subscription Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-slate-800 shadow-md p-6 text-white relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none"></div>
          
          <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 mb-4 flex items-center gap-2">
             <CreditCard className="text-orange-400" size={18} /> Active License
          </h3>

          {subscription ?
          (
            <div className="space-y-4 text-sm text-slate-300 flex-grow flex flex-col justify-center">
              <div className="flex justify-between items-center">
                <span>Plan</span>
                <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">{tierName}</span>
              </div>
              {subscription.engine && (
                <div className="flex justify-between items-center">
                  <span>AI Engine</span>
                  <span className="text-white">{tier?.engineLabel || subscription.engine}</span>
                </div>
              )}
              {subscription.concurrentSites > 0 && (
                <div className="flex justify-between items-center">
                  <span>Concurrent Sites</span>
                  <span className="text-white">{subscription.concurrentSites}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span>Billing Status</span>
                <span className={subscription.isActive ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                  {subscription.isActive ? "Active" : "Expired"}
                </span>
              </div>
              
              {subscription.startDate && subscription.endDate && (
                <div className="flex justify-between items-center">
                  <span>Validity</span>
                  <span>{new Date(subscription.startDate).toLocaleDateString()} - {new Date(subscription.endDate).toLocaleDateString()}</span>
                </div>
              )}
              
              {allowance > 0 ? (
                <div className="pt-4 mt-2 border-t border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Zap size={14} className="text-orange-400" /> Credits Available
                    </span>
                    <span className="font-mono text-white">
                      {balance.toLocaleString()} / {allowance.toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden flex">
                    <div
                      className={`h-1.5 transition-all duration-500 ${isNearingLimit ? "bg-red-500" : "bg-orange-500"}`}
                      style={{ width: `${usagePercentage}%` }}
                    ></div>
                    {/* Held for a run in progress — spent from the customer's
                        point of view only once it settles. */}
                    {reservedPercentage > 0 && (
                      <div
                        className="h-1.5 bg-amber-300 transition-all duration-500"
                        style={{ width: `${reservedPercentage}%` }}
                        title={`${reserved} credits reserved for a run in progress`}
                      ></div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{creditsUsed.toLocaleString()} used this period</span>
                    {reserved > 0 && (
                      <span className="text-amber-300 font-semibold">
                        {reserved} reserved
                      </span>
                    )}
                  </div>

                  {credits?.nextResetAt && (
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Resets</span>
                      <span>{new Date(credits.nextResetAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {credits?.overageRateUsd != null && (
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Extra credits</span>
                      <span>{formatPrice(credits.overageRateUsd, "USD")} each</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic flex-grow flex items-center">No active billing profile detected.</p>
          )}
        </motion.div>
      </div>

      {/* CREDIT HISTORY */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 w-full"
      >
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
          <History className="text-orange-500" size={18} /> Credit History
        </h3>

        {ledgerLoading ? (
          <p className="text-sm text-slate-400 italic py-4">Loading credit history…</p>
        ) : ledger.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4">
            No credit activity yet. Movements appear here as soon as you run a test.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">Activity</th>
                  <th className="text-left py-2 pr-4">Run</th>
                  <th className="text-right py-2 pr-4">Credits</th>
                  <th className="text-right py-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => {
                  const meta = LEDGER_LABELS[row.type] || {
                    label: row.type,
                    tone: "text-slate-700",
                  };
                  return (
                    <tr key={row._id} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
                      <td className={`py-3 pr-4 font-medium ${meta.tone}`}>
                        {meta.label}
                        {row.note && (
                          <span className="block text-xs text-slate-400 font-normal">
                            {row.note}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-400 font-mono">
                        {row.parentSession || "—"}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-bold whitespace-nowrap ${
                          row.credits > 0
                            ? "text-emerald-600"
                            : row.credits < 0
                              ? "text-slate-800"
                              : "text-slate-400"
                        }`}
                      >
                        {row.credits > 0 ? "+" : ""}
                        {row.credits}
                      </td>
                      <td className="py-3 text-right text-slate-500 whitespace-nowrap">
                        {row.balanceAfter != null ? row.balanceAfter : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* BOTTOM SECTION: Users Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 w-full">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-orange-500" size={18} /> Personnel Roster
          </h3>
          <span className="bg-orange-50 text-orange-600 font-bold px-3 py-1 rounded-full text-xs border border-orange-100">
            Total Personnel: {userNames.admins.length + userNames.employees.length}
          </span>
        </div>

        {/* Scrollable Container for User Lists */}
        <div className="max-h-[400px] overflow-y-auto pr-2 pb-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-1 sticky top-0 bg-white py-1 z-10">Organization Admins ({userNames.admins.length})</h4>
              {renderUserList(userNames.admins, "admins")}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-1 sticky top-0 bg-white py-1 z-10">Employees ({userNames.employees.length})</h4>
              {renderUserList(userNames.employees, "employees")}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CompanySubscription;