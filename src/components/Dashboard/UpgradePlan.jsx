import React, { useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { PhoneCall, X, Copy, TrendingDown, Info, Wallet } from "lucide-react";
import PricingTierCard from "../UI/PricingTierCard";
import {
  listTiers,
  listPlanTypes,
  leadPlanTypeKey,
  PRICING,
  FX_INR_PER_USD,
} from "../../config/pricing/creditMath";

/**
 * In-app pricing / upgrade page (route: /upgrade-plan).
 *
 * Shares PricingTierCard with the public marketing section so the two grids
 * cannot drift, and reads every figure from pricing.data.json.
 *
 * Self-serve purchase is deliberately out of scope — all CTAs open the
 * contact-sales modal, as before. (`razorpay` is already a dependency if that
 * ever changes.)
 */

const UpgradePlan = () => {
  const { user } = useSelector((state) => state.profile);
  const account = user?.creditAccount;

  const [billing, setBilling] = useState("monthly");
  const [currency, setCurrency] = useState("INR");
  const [planType, setPlanType] = useState(
    account && account.planType && account.planType !== "legacy"
      ? account.planType
      : leadPlanTypeKey()
  );
  const [showModal, setShowModal] = useState(false);

  const planTypes = listPlanTypes();
  const tiers = listTiers(planType);
  const activePlan = PRICING.planTypes[planType];

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("sales@mnrtechnologies.com");
    toast.success("Email copied to clipboard!");
  };

  const isCurrentTier = (tier) =>
    !!account && account.planType === planType && account.tierKey === tier.key;

  return (
    <div className="max-w-[90rem] mx-auto space-y-10 pb-16 pt-8 px-4 sm:px-6 relative">
      {/* Current plan banner */}
      {account && (
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Your current plan
              </p>
              <p className="font-black text-slate-900 truncate">
                {account.tierName}
                {account.legacy && (
                  <span className="ml-2 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Legacy
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Available
              </p>
              <p className="font-black text-slate-900">
                {account.unlimited ? "Unlimited" : account.balance.toLocaleString()}
                {!account.unlimited && (
                  <span className="text-slate-400 font-medium">
                    {" "}
                    / {account.monthlyAllowance.toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            {account.reserved > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Reserved
                </p>
                <p className="font-black text-amber-600">{account.reserved}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-5">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
          Scale Your <span className="text-orange-500">Testing Capacity</span>
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          One credit tests one page with up to two scenarios. You approve the exact
          cost before anything expensive runs.
        </p>

        {/* Toggles */}
        <div className="flex flex-col items-center justify-center gap-4 pt-2">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            {planTypes.map((pt) => (
              <button
                key={pt.key}
                onClick={() => setPlanType(pt.key)}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  planType === pt.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {pt.label}
                {pt.lead && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600">
                    Best value
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {["INR", "USD"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-5 py-1.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                    currency === c
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {c === "INR" ? "INR (₹)" : "USD ($)"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-bold ${billing === "monthly" ? "text-slate-900" : "text-slate-400"}`}
              >
                Monthly
              </span>
              <button
                onClick={() =>
                  setBilling(billing === "monthly" ? "semiAnnual" : "monthly")
                }
                className="w-14 h-7 bg-slate-200 rounded-full p-1 relative transition-colors duration-200"
                aria-label="Toggle billing period"
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    billing === "semiAnnual" ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${billing === "semiAnnual" ? "text-slate-900" : "text-slate-400"}`}
                >
                  6 Months
                </span>
                <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1">
                  <TrendingDown size={11} />
                  Save {PRICING.semiAnnualDiscountPct}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {activePlan?.blurb && (
          <p className="text-sm text-slate-500 max-w-xl mx-auto">{activePlan.blurb}</p>
        )}
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {tiers.map((tier) => (
          <PricingTierCard
            key={tier.key}
            tier={tier}
            currency={currency}
            billing={billing}
            variant="light"
            isCurrent={isCurrentTier(tier)}
            onSelect={() => setShowModal(true)}
            ctaLabel={isCurrentTier(tier) ? "Your plan" : undefined}
          />
        ))}
      </div>

      {/* How credits work */}
      <div className="max-w-3xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-orange-500 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
            <p className="font-bold text-slate-900">How credits are counted</p>
            <p>
              Testing a page runs an exploration pass plus one execution pass per
              scenario it finds. A page with 1–3 scenarios costs 1 credit, 4–5 costs 2,
              and around 20 scenarios costs 7. You see the exact number for every page
              on the review screen and approve it before the expensive phase starts.
            </p>
            <p>
              Any page producing more than {PRICING.formula.MAX_STORIES_PER_URL}{" "}
              scenarios always pauses for explicit confirmation, so a run can never
              quietly become expensive.
            </p>
            {currency === "INR" && (
              <p className="text-xs text-slate-400 pt-1">
                INR figures are indicative at $1 = ₹{FX_INR_PER_USD}. Contracts are
                billed in USD.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500">
        Need a different arrangement?{" "}
        <button
          onClick={() => setShowModal(true)}
          className="text-orange-500 font-bold cursor-pointer hover:underline"
        >
          Contact our Solution Architects.
        </button>
      </p>

      {/* Contact modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center relative shadow-2xl">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors"
              onClick={() => setShowModal(false)}
            >
              <X size={20} />
            </button>

            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500 border border-orange-200">
              <PhoneCall size={32} />
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
              Get in Touch
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              To change your plan, add credits, or discuss a custom arrangement, please
              reach out to our sales team at the address below. We typically respond
              within a few hours.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between mt-2">
              <div className="pl-4 pr-2 py-2 overflow-hidden">
                <span className="text-slate-700 font-bold text-sm md:text-base truncate block">
                  sales@mnrtechnologies.com
                </span>
              </div>
              <button
                onClick={handleCopyEmail}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shrink-0 shadow-md"
              >
                <Copy size={16} />
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradePlan;
