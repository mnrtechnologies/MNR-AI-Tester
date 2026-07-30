import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import toast from "react-hot-toast";
import {
  PhoneCall,
  X,
  Copy,
  TrendingDown,
  Info,
  Wallet,
  ShieldCheck,
  Loader2,
  Plus,
  Minus,
  Rocket,
} from "lucide-react";
import PricingTierCard from "../UI/PricingTierCard";
import {
  listTiers,
  listPlanTypes,
  leadPlanTypeKey,
  PRICING,
  FX_INR_PER_USD,
  usdToInr,
} from "../../config/pricing/creditMath";
import { quotePlan, quoteCredits, formatCharge } from "../../config/pricing/purchaseQuote";
import { purchase } from "../../services/operations/paymentAPIs";

/**
 * In-app pricing / upgrade page (route: /upgrade-plan).
 *
 * Shares PricingTierCard with the public marketing section so the two grids
 * cannot drift, and reads every figure from pricing.data.json.
 *
 * SELF-SERVE PURCHASE
 * -------------------
 * A company_admin can buy a plan or top up credits here through Razorpay.
 * Everyone else still gets the contact-sales modal — credits are company-scoped
 * and only an admin may commit company spend, which the server enforces with
 * isCompanyAdmin regardless of what this component renders.
 *
 * The amounts shown come from purchaseQuote, the SAME module the server prices
 * the order with, so the figure a user confirms is the figure they are charged.
 * The currency toggle is display-only: the charge is always in USD.
 */

const PRESET_TOPUPS = [25, 50, 100, 250];

const UpgradePlan = () => {
  const { user } = useSelector((state) => state.profile);
  const dispatch = useDispatch();
  const account = user?.creditAccount;
  const canBuy = user?.role === "company_admin";

  const [billing, setBilling] = useState("monthly");
  const [currency, setCurrency] = useState("INR");
  const [planType, setPlanType] = useState(
    account && account.planType && account.planType !== "legacy"
      ? account.planType
      : leadPlanTypeKey()
  );
  const [showModal, setShowModal] = useState(false);
  // "sales" (default) or "admin-only" — same modal, different copy.
  const [modalReason, setModalReason] = useState("sales");
  const [confirm, setConfirm] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [topUpQty, setTopUpQty] = useState(50);

  const planTypes = listPlanTypes();
  const tiers = listTiers(planType);
  const activePlan = PRICING.planTypes[planType];

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("sales@mnrtechnologies.com");
    toast.success("Email copied to clipboard!");
  };

  const openSalesModal = (reason = "sales") => {
    setModalReason(reason);
    setShowModal(true);
  };

  const isCurrentTier = (tier) =>
    !!account && account.planType === planType && account.tierKey === tier.key;

  /** Buying the tier you are already on extends the period rather than switching. */
  const isExtension = (tier) => isCurrentTier(tier) && !!account?.isActive;

  const handleSelect = (tier) => {
    // Unchanged behaviour for anything not sold self-serve.
    if (tier.custom || tier.available === false) return openSalesModal("sales");
    if (!canBuy) return openSalesModal("admin-only");

    const quote = quotePlan({ planType, tierKey: tier.key, period: billing, currency });
    if (!quote.ok) return openSalesModal("sales");

    setConfirm({ kind: "plan_purchase", tier, quote });
  };

  const handleTopUp = () => {
    if (!canBuy) return openSalesModal("admin-only");

    const quote = quoteCredits({
      planType: account.planType,
      tierKey: account.tierKey,
      quantity: topUpQty,
      currency,
      extraCreditUsdOverride: account.overageRateUsd,
    });
    if (!quote.ok) return toast.error(quote.message);

    setConfirm({ kind: "credit_topup", quote });
  };

  /** Run the confirmed purchase. The server re-quotes; this is display only. */
  const runPurchase = async () => {
    if (!confirm) return;
    const key = confirm.kind === "credit_topup" ? "topup" : confirm.tier.key;
    setBusyKey(key);

    const result = await dispatch(
      confirm.kind === "credit_topup"
        ? purchase({ kind: "credit_topup", credits: confirm.quote.quantity, currency })
        : purchase({
            kind: "plan_purchase",
            planType,
            tierKey: confirm.tier.key,
            period: billing,
            currency,
          })
    );

    setBusyKey(null);

    // A dismissed checkout leaves the dialog open so the user can simply try
    // again; anything else is resolved one way or the other.
    if (result.code !== "CHECKOUT_DISMISSED") setConfirm(null);

    // The server refuses tiers that are not sold self-serve — fall back to the
    // same contact-sales modal rather than showing a raw error.
    if (result.code === "TIER_UNAVAILABLE" || result.code === "TIER_CUSTOM") {
      openSalesModal("sales");
    }
  };

  /** "UPI, netbanking, cards or wallets" / "card". */
  const methodLabels = (methods = {}) => {
    const names = [
      methods.upi && "UPI",
      methods.netbanking && "netbanking",
      methods.card && "cards",
      methods.wallet && "wallets",
    ].filter(Boolean);
    if (names.length === 0) return "card";
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  };

  return (
    <div className="max-w-[90rem] mx-auto space-y-10 pb-16 pt-8 px-4 sm:px-6 relative">
      {/* No plan yet — the normal state of a brand-new company. A super admin
          creates the account and stops there; buying the first plan is the
          company admin's job, so say so plainly rather than showing a bare grid. */}
      {!account && (
        <div className="max-w-3xl mx-auto bg-orange-50 border border-orange-200 rounded-2xl p-5 flex flex-wrap items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-white text-orange-500 flex items-center justify-center shrink-0 border border-orange-200">
            <Rocket size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-slate-900">
              {canBuy ? "You don't have a plan yet" : "Your organisation has no plan yet"}
            </p>
            <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
              {canBuy
                ? "Pick one below and pay securely — your credits are available the moment the payment clears."
                : "Only a company admin can purchase. Ask yours to choose a plan below."}
            </p>
          </div>
        </div>
      )}

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
            {/* This is not a display preference — it selects the currency the
                order is created in, and therefore which payment methods exist.
                UPI and netbanking are INR-settled and cannot appear on a USD
                order, so the labels say so up front rather than surprising
                someone at the checkout screen. */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[
                ["INR", "INR (₹)", "UPI, netbanking & cards"],
                ["USD", "USD ($)", "Cards only"],
              ].map(([c, label, hint]) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  title={hint}
                  className={`px-5 py-1.5 rounded-lg transition-all duration-200 flex flex-col items-center leading-tight ${
                    currency === c
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-sm font-bold">{label}</span>
                  <span
                    className={`text-[9px] font-semibold uppercase tracking-wide ${
                      currency === c ? "text-orange-500" : "text-slate-400"
                    }`}
                  >
                    {hint}
                  </span>
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
            onSelect={() => handleSelect(tier)}
            busy={busyKey === tier.key}
            disabled={!!busyKey && busyKey !== tier.key}
            ctaLabel={
              tier.custom || tier.available === false
                ? undefined
                : !canBuy && isCurrentTier(tier)
                  ? "Your plan"
                  : isExtension(tier)
                    ? billing === "semiAnnual"
                      ? "Extend 6 months"
                      : "Extend 1 month"
                    : undefined
            }
          />
        ))}
      </div>

      {/* Buy extra credits — only meaningful on a live, non-custom plan that
          publishes an extra-credit rate. */}
      {account && !account.legacy && account.overageRateUsd != null && (
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-lg">Need credits sooner?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-md">
                Top up without changing your plan, at{" "}
                {formatCharge(
                  currency === "INR" ? usdToInr(account.overageRateUsd) : account.overageRateUsd,
                  currency
                )}{" "}
                per credit. They land immediately and are kept at your monthly reset — only
                unused <em>plan</em> credits expire.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTopUpQty((q) => Math.max(1, q - 25))}
                  disabled={!!busyKey}
                  className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center disabled:opacity-50"
                  aria-label="Fewer credits"
                >
                  <Minus size={15} />
                </button>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={topUpQty}
                  onChange={(e) =>
                    setTopUpQty(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))
                  }
                  className="w-24 text-center font-black text-slate-900 border border-slate-200 rounded-lg py-2"
                />
                <button
                  onClick={() => setTopUpQty((q) => Math.min(10000, q + 25))}
                  disabled={!!busyKey}
                  className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center disabled:opacity-50"
                  aria-label="More credits"
                >
                  <Plus size={15} />
                </button>
              </div>

              <div className="flex gap-1.5">
                {PRESET_TOPUPS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setTopUpQty(n)}
                    className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${
                      topUpQty === n
                        ? "bg-orange-500 text-white"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <button
                onClick={handleTopUp}
                disabled={!!busyKey}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busyKey === "topup" && <Loader2 size={15} className="animate-spin" />}
                {busyKey === "topup"
                  ? "Opening checkout…"
                  : `Buy ${topUpQty} credits — ${
                      formatCharge(
                        currency === "INR"
                          ? usdToInr(account.overageRateUsd) * topUpQty
                          : account.overageRateUsd * topUpQty,
                        currency
                      )
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

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
                Prices are set in USD and charged in INR at $1 = ₹{FX_INR_PER_USD}. Pay by
                UPI, netbanking, card or wallet.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500">
        Need a different arrangement?{" "}
        <button
          onClick={() => openSalesModal("sales")}
          className="text-orange-500 font-bold cursor-pointer hover:underline"
        >
          Contact our Solution Architects.
        </button>
      </p>

      {/* Confirmation — the last screen before money moves. */}
      {confirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md relative shadow-2xl">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors disabled:opacity-40"
              onClick={() => setConfirm(null)}
              disabled={!!busyKey}
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">
              Confirm your purchase
            </h3>
            <p className="text-sm text-slate-500 mb-6">{confirm.quote.description}</p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-500 font-medium">Total due today</span>
                <span className="text-2xl font-black text-slate-900">
                  {confirm.quote.amountFormatted}
                </span>
              </div>

              {confirm.kind === "plan_purchase" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Credits</span>
                    <span className="font-bold text-slate-900">
                      {confirm.quote.credits.toLocaleString()} / month
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Billing period</span>
                    <span className="font-bold text-slate-900">
                      {confirm.quote.months} month{confirm.quote.months === 1 ? "" : "s"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Credits added now</span>
                  <span className="font-bold text-slate-900">
                    {confirm.quote.quantity.toLocaleString()}
                  </span>
                </div>
              )}

              {/* The amount above is exactly what will be charged, in the
                  currency shown. On an INR purchase the USD catalog price is a
                  reference only — never the headline. */}
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                {confirm.quote.currency === "INR" ? (
                  <p className="text-xs text-slate-400">
                    Catalog price ${confirm.quote.amountUsd.toLocaleString("en-US")}, converted
                    at $1 = ₹{FX_INR_PER_USD}.
                  </p>
                ) : null}
                <p className="text-xs text-slate-500 font-medium">
                  Pay with {methodLabels(confirm.quote.methods)}
                </p>
              </div>
            </div>

            {/* Plan changes have consequences the customer must see BEFORE paying.
                The 6-month note is NOT gated on an existing account: a
                first-time buyer is the person most likely to expect six
                allowances up front. */}
            {confirm.kind === "plan_purchase" && (
              <div className="mt-4 text-xs leading-relaxed text-slate-500 space-y-2">
                {account && isExtension(confirm.tier) ? (
                  <p>
                    This extends your current plan by {confirm.quote.months} month
                    {confirm.quote.months === 1 ? "" : "s"}. Your balance and monthly reset date
                    are unchanged.
                  </p>
                ) : account ? (
                  <>
                    <p>
                      This starts a new billing period today on{" "}
                      <span className="font-bold text-slate-700">{confirm.quote.tierName}</span>.
                    </p>
                    {account.balance > 0 && account.rolloverPolicy !== "carry" && (
                      <p className="text-amber-600 font-medium">
                        Your {account.balance.toLocaleString()} unused plan credits will not carry
                        over. Credits you purchased separately are always kept.
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    Your plan activates as soon as the payment clears, and{" "}
                    {confirm.quote.credits.toLocaleString()} credits become available
                    straight away.
                  </p>
                )}
                {confirm.quote.months > 1 && (
                  <p>
                    Your {confirm.quote.credits.toLocaleString()} credits arrive monthly across
                    the {confirm.quote.months} months — not all at once.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirm(null)}
                disabled={!!busyKey}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={runPurchase}
                disabled={!!busyKey}
                className="flex-[2] py-3 rounded-xl font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busyKey ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Opening checkout…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Pay {confirm.quote.amountFormatted}
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-4">
              Payments are processed securely by Razorpay. We never see your card details.
            </p>
          </div>
        </div>
      )}

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
              {modalReason === "admin-only" ? "Ask your admin" : "Get in Touch"}
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              {modalReason === "admin-only" ? (
                <>
                  Plans and credits are shared across your whole organisation, so only a
                  company admin can purchase them. Ask yours to visit this page — or reach
                  out to us directly at the address below.
                </>
              ) : (
                <>
                  To discuss a custom arrangement, an on-premise deployment, or a tier that
                  is not yet self-serve, please reach out to our sales team at the address
                  below. We typically respond within a few hours.
                </>
              )}
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
