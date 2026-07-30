import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Building,
  CreditCard,
  ShieldCheck,
  Zap,
  RefreshCw,
  PowerOff,
  Calendar,
  Activity,
  AlertTriangle,
  X,
  ArrowLeft,
} from "lucide-react";

// --- ACTUAL API IMPORTS ---
import {
  activateSubscription,
  renewSubscription,
  expireSubscription,
} from "../../../services/operations/subsAPIs";
import { getCompanies } from "../../../services/operations/companyAPI";
import { adjustCredits } from "../../../services/operations/creditAPIs";
import {
  listPlanTypes,
  listTiers,
  getTier,
  leadPlanTypeKey,
  formatPrice,
} from "../../../config/pricing/creditMath";

const selectClass =
  "w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 cursor-pointer appearance-none";

/* ---------------- Manage Modal ---------------- */
const ManageModal = ({ selectedCompany, form, setForm, onSubmit, onClose }) => {
  const isRenewal = selectedCompany?.activeSubscriptionId?.isActive;
  const tiers = listTiers(form.planType);
  const tier = getTier(form.planType, form.tierKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
            {isRenewal ? <RefreshCw size={24} /> : <Zap size={24} />}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {isRenewal ? "Renew Subscription" : "Activate License"}
            </h2>
            <p className="text-sm font-medium text-slate-500">
              {selectedCompany?.name}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Plan Type
            </label>
            <select
              className={selectClass}
              value={form.planType}
              onChange={(e) => {
                const planType = e.target.value;
                // Tier keys are namespaced per plan type, so switching type
                // must reset the tier or we'd submit an invalid pair.
                const first = listTiers(planType)[0];
                setForm({ ...form, planType, tierKey: first ? first.key : "" });
              }}
            >
              {listPlanTypes().map((pt) => (
                <option key={pt.key} value={pt.key}>
                  {pt.label}
                  {pt.lead ? " (recommended)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tier
            </label>
            <select
              className={selectClass}
              value={form.tierKey}
              onChange={(e) => setForm({ ...form, tierKey: e.target.value })}
            >
              {tiers.map((t) => (
                <option key={t.key} value={t.key} disabled={t.available === false}>
                  {t.name}
                  {t.available === false ? " — not available yet" : ""}
                </option>
              ))}
            </select>

            {tier && (
              <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">
                {tier.custom ? (
                  <>Custom deal — set the credit allowance below.</>
                ) : (
                  <>
                    <span className="font-bold text-slate-700">
                      {formatPrice(tier.priceUsdMonthly, "USD")}/mo
                    </span>{" "}
                    · {tier.credits.toLocaleString()} credits ·{" "}
                    {tier.concurrentSites} concurrent ·{" "}
                    {formatPrice(tier.extraCreditUsd, "USD")}/extra credit
                    {tier.engineLabel ? ` · ${tier.engineLabel}` : ""}
                  </>
                )}
                {tier.available === false && (
                  <div className="mt-1 text-amber-600 font-semibold">
                    {tier.unavailableReason}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Expiration Date
            </label>
            <input
              type="date"
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              value={form.expireDate}
              onChange={(e) => setForm({ ...form, expireDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Monthly Credits{" "}
              {tier && !tier.custom && (
                <span className="text-slate-400 normal-case font-medium">
                  (optional override)
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              placeholder={
                tier && !tier.custom ? String(tier.credits) : "e.g. 5000"
              }
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              value={form.customCredits}
              onChange={(e) => setForm({ ...form, customCredits: e.target.value })}
            />
            {tier?.custom && (
              <p className="mt-1 text-[11px] text-slate-400">
                Required for custom tiers — they carry no published allowance.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Unused Credits
            </label>
            <select
              className={selectClass}
              value={form.rolloverPolicy}
              onChange={(e) =>
                setForm({ ...form, rolloverPolicy: e.target.value })
              }
            >
              <option value="none">Expire at the end of each month</option>
              <option value="carry">Roll over to the next month</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors w-full"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 w-full flex items-center justify-center gap-2"
          >
            {isRenewal ? "Process Renewal" : "Activate Now"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* --------------- Adjust Credits Modal --------------- */
const AdjustCreditsModal = ({ company, form, setForm, onSubmit, onClose, loading }) => {
  const current = company?.activeSubscriptionId?.credits?.balance ?? 0;
  const delta = Number(form.delta);
  const preview = Number.isFinite(delta) ? current + delta : current;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              Adjust Credits
            </h2>
            <p className="text-sm font-medium text-slate-500">{company?.name}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Credits to add or remove
            </label>
            <input
              type="number"
              placeholder="e.g. 100 to grant, -50 to deduct"
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              value={form.delta}
              onChange={(e) => setForm({ ...form, delta: e.target.value })}
            />
            <p className="mt-2 text-xs text-slate-500">
              Balance: <span className="font-bold">{current.toLocaleString()}</span> →{" "}
              <span
                className={`font-bold ${preview < 0 ? "text-rose-600" : "text-emerald-600"}`}
              >
                {preview.toLocaleString()}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Reason (required)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Goodwill refund for run 20260728_1130 — 12 stories timed out"
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-500/10 resize-none"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Recorded permanently in the credit ledger.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors w-full disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 w-full disabled:opacity-50"
          >
            {loading ? "Applying…" : "Apply Adjustment"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* --------------- Expire Confirmation Modal --------------- */
const ExpireConfirmationModal = ({
  companyName,
  onConfirm,
  onClose,
  loading,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 text-center relative"
      >
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
          <AlertTriangle size={28} />
        </div>

        <h2 className="text-xl font-black text-slate-800 mb-2">
          Force Expiration?
        </h2>

        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Are you sure you want to immediately revoke access and expire the
          subscription for{" "}
          <span className="font-bold text-slate-800">{companyName}</span>?
        </p>

        <div className="flex justify-center gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors w-full disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">Processing...</span>
            ) : (
              <>
                <PowerOff size={16} />
                Expire
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ------------------ Main Component ------------------ */
const SubscriptionManagement = () => {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const [companyToExpire, setCompanyToExpire] = useState(null);

  const [selectedCompany, setSelectedCompany] = useState(null);
  const [form, setForm] = useState({
    planType: leadPlanTypeKey(),
    tierKey: listTiers(leadPlanTypeKey())[0]?.key || "",
    expireDate: "",
    customCredits: "",
    rolloverPolicy: "none",
  });

  // Credit adjustment (grant / deduct) for a single company.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ delta: "", note: "" });
  const [adjusting, setAdjusting] = useState(false);

  /* ---------------- Fetch Real Data ---------------- */
  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await getCompanies();
      if (data?.companies && Array.isArray(data.companies)) {
        setSubscriptions(data.companies);
      } else if (Array.isArray(data)) {
        setSubscriptions(data);
      } else {
        setSubscriptions([]);
      }
    } catch (error) {
      console.error("Error fetching organizations", error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  /* ---------------- Open Manage Modal ---------------- */
  const openModal = (company) => {
    setSelectedCompany(company);
    const sub = company.activeSubscriptionId;

    // An unmigrated subscription has no planType/tierKey, so fall back to the
    // lead plan rather than submitting an empty pair.
    const planType =
      sub?.planType && sub.planType !== "legacy" ? sub.planType : leadPlanTypeKey();
    const tierKey =
      getTier(planType, sub?.tierKey)?.key || listTiers(planType)[0]?.key || "";

    setForm({
      planType,
      tierKey,
      expireDate: sub?.endDate
        ? new Date(sub.endDate).toISOString().split("T")[0]
        : "",
      customCredits: sub?.credits?.monthlyAllowance || "",
      rolloverPolicy: sub?.credits?.rolloverPolicy || "none",
    });
    setModalOpen(true);
  };

  /* ---------------- Submit Activate / Renew ---------------- */
  const handleSubmit = async () => {
    if (!form.expireDate)
      return toast.error("Please select an expiration date");
    if (!form.tierKey) return toast.error("Please choose a tier");

    const tier = getTier(form.planType, form.tierKey);
    if (tier?.custom && !form.customCredits) {
      return toast.error("Custom tiers need an explicit credit allowance");
    }

    const isRenewal = selectedCompany?.activeSubscriptionId?.isActive;
    const customCredits =
      form.customCredits === "" ? undefined : Number(form.customCredits);

    let result = null;

    try {
      if (isRenewal) {
        result = await renewSubscription({
          companyId: selectedCompany._id,
          newEndDate: form.expireDate,
          planType: form.planType,
          tierKey: form.tierKey,
          customCredits,
          rolloverPolicy: form.rolloverPolicy,
        });
      } else {
        result = await activateSubscription({
          companyId: selectedCompany._id,
          planType: form.planType,
          tierKey: form.tierKey,
          startDate: new Date().toISOString(),
          endDate: form.expireDate,
          customCredits,
          rolloverPolicy: form.rolloverPolicy,
        });
      }

      if (result) {
        setModalOpen(false);
        await loadSubscriptions();
      }
    } catch (err) {
      console.error("Manage submit error:", err);
    }
  };

  /* ---------------- Adjust Credits ---------------- */
  const handleAdjustSubmit = async () => {
    const delta = Number(adjustForm.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return toast.error("Enter a non-zero number of credits");
    }
    if (!adjustForm.note.trim()) {
      // Required server-side too — the ledger is only useful if every manual
      // movement says why it happened.
      return toast.error("A reason is required so the ledger stays auditable");
    }

    setAdjusting(true);
    const result = await adjustCredits({
      companyId: adjustTarget._id,
      delta,
      note: adjustForm.note.trim(),
    });
    setAdjusting(false);

    if (result.ok) {
      setAdjustOpen(false);
      setAdjustTarget(null);
      setAdjustForm({ delta: "", note: "" });
      await loadSubscriptions();
    }
  };

  /* ---------------- Expire Subscription ---------------- */
  const handleOpenExpireConfirm = (company) => {
    setCompanyToExpire(company);
    setConfirmOpen(true);
  };

  /* ---------------- Expire Subscription ---------------- */
  const handleExpireConfirm = async () => {
    if (!companyToExpire) return;
    setExpiring(true);

    try {
      // Make the API call without requiring a returned 'result' variable
      await expireSubscription(companyToExpire._id);

      // 1. Close the modal and reset state immediately
      setConfirmOpen(false);
      setCompanyToExpire(null);

      // 2. Fetch the updated list of companies dynamically instead of a hard refresh
      await loadSubscriptions();
    } catch (err) {
      console.error("Expire confirmation error:", err);
      toast.error("Failed to revoke subscription");
    } finally {
      // Ensure loading state resets even if it fails
      setExpiring(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status, isActive) => {
    if (isActive)
      return (
        <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
          Active
        </span>
      );
    if (status === "expired")
      return (
        <span className="bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
          Expired
        </span>
      );
    return (
      <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
        No Plan
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-1 mr-2 sm:mt-0 p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-100">
            <ShieldCheck size={14} />
            <span>Billing Command</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Subscription Management
          </h1>
          <p className="text-slate-500 text-sm mt-2 max-w-xl leading-relaxed">
            Monitor test usage, manage billing cycles, and control access
            licenses for all enterprise clients.
          </p>
        </div>
      </div>

      {/* DATA VIEW */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">
              Loading subscription data...
            </p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Building size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">No companies found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="p-5">Organization</th>
                  <th className="p-5">Plan Status</th>
                  <th className="p-5">Billing Cycle</th>
                  <th className="p-5">Credits</th>
                  <th className="p-5 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((item, i) => (
                  <motion.tr
                    key={item._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Organization Column */}
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                          <Building size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">
                            {item.name || "Unnamed Company"}
                          </p>
                          <p className="text-xs text-slate-500">{item.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Plan Status Column */}
                    <td className="p-5">
                      <div className="flex flex-col items-start gap-1.5">
                        {getStatusBadge(
                          item.subscriptionStatus,
                          item.activeSubscriptionId?.isActive,
                        )}
                        {item.activeSubscriptionId && (
                          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 mt-1">
                            <CreditCard size={12} className="text-slate-400" />
                            {getTier(
                              item.activeSubscriptionId.planType,
                              item.activeSubscriptionId.tierKey,
                            )?.name ||
                              item.activeSubscriptionId.legacyPlan ||
                              "Legacy plan"}
                          </span>
                        )}
                        {item.activeSubscriptionId &&
                          !item.activeSubscriptionId.pricingVersion && (
                            <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              Not migrated
                            </span>
                          )}
                        {item.activeSubscriptionId?.credits?.needsManualReview && (
                          <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            Needs review
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Billing Cycle Column */}
                    <td className="p-5 text-xs text-slate-600 space-y-1.5">
                      {item.activeSubscriptionId ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-emerald-500" />
                            <span>
                              Start:{" "}
                              {new Date(
                                item.activeSubscriptionId.startDate,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar
                              size={14}
                              className={
                                item.activeSubscriptionId.isActive
                                  ? "text-orange-500"
                                  : "text-red-500"
                              }
                            />
                            <span
                              className={
                                !item.activeSubscriptionId.isActive
                                  ? "line-through text-slate-400"
                                  : ""
                              }
                            >
                              End:{" "}
                              {new Date(
                                item.activeSubscriptionId.endDate,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400 italic">
                          No active cycle
                        </span>
                      )}
                    </td>

                    {/* Credits Column */}
                    <td className="p-5">
                      {item.activeSubscriptionId ? (
                        (() => {
                          const c = item.activeSubscriptionId.credits || {};
                          const allowance = c.monthlyAllowance || 0;
                          const balance = c.balance || 0;
                          const reserved = c.reserved || 0;
                          const used = Math.max(0, allowance - balance - reserved);
                          const usedPct = allowance
                            ? Math.min((used / allowance) * 100, 100)
                            : 0;
                          const reservedPct = allowance
                            ? Math.min((reserved / allowance) * 100, 100 - usedPct)
                            : 0;

                          return (
                            <div className="space-y-2 max-w-[170px]">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-slate-500">Credits</span>
                                <span className="text-slate-800 font-bold">
                                  {balance.toLocaleString()} /{" "}
                                  {allowance.toLocaleString()}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                <div
                                  className={`h-1.5 ${usedPct > 80 ? "bg-red-400" : "bg-blue-400"}`}
                                  style={{ width: `${usedPct}%` }}
                                />
                                {/* Held credits are neither spent nor available.
                                    Folding them into either bar generates
                                    support tickets, so show them separately. */}
                                {reservedPct > 0 && (
                                  <div
                                    className="h-1.5 bg-amber-300"
                                    style={{ width: `${reservedPct}%` }}
                                    title={`${reserved} reserved for a run in progress`}
                                  />
                                )}
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>{used.toLocaleString()} used</span>
                                {reserved > 0 && (
                                  <span className="text-amber-600 font-semibold">
                                    {reserved} held
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setAdjustTarget(item);
                                  setAdjustForm({ delta: "", note: "" });
                                  setAdjustOpen(true);
                                }}
                                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline"
                              >
                                Adjust credits
                              </button>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Activity size={14} /> Unallocated
                        </span>
                      )}
                    </td>

                    {/* Actions Column */}
                    <td className="p-5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal(item)}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          {item.activeSubscriptionId?.isActive ? (
                            <>
                              <RefreshCw size={14} /> Renew
                            </>
                          ) : (
                            <>
                              <Zap size={14} /> Activate
                            </>
                          )}
                        </button>

                        {item.activeSubscriptionId?.isActive && (
                          <button
                            onClick={() => handleOpenExpireConfirm(item)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <PowerOff size={14} /> Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalOpen && (
          <ManageModal
            selectedCompany={selectedCompany}
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            onClose={() => setModalOpen(false)}
          />
        )}

        {adjustOpen && (
          <AdjustCreditsModal
            company={adjustTarget}
            form={adjustForm}
            setForm={setAdjustForm}
            onSubmit={handleAdjustSubmit}
            onClose={() => setAdjustOpen(false)}
            loading={adjusting}
          />
        )}

        {confirmOpen && (
          <ExpireConfirmationModal
            companyName={companyToExpire?.name || "this organization"}
            onConfirm={handleExpireConfirm}
            onClose={() => setConfirmOpen(false)}
            loading={expiring}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionManagement;
