import React from "react";
import { CheckCircle2, Zap, Crown, Rocket, PhoneCall, Server, Loader2 } from "lucide-react";
import { usdToInr, semiAnnualUsd } from "../../config/pricing/creditMath";

/**
 * One pricing tier, rendered identically on the marketing page and the in-app
 * upgrade page so the two can't drift.
 *
 * `variant` picks the surface treatment only — never the numbers:
 *   "dark"  — the slate marketing section on the home page
 *   "light" — the white in-app dashboard
 *
 * Prices come from pricing.data.json via creditMath. USD is canonical and INR
 * is always derived, so there is no INR literal anywhere to go stale.
 */

const TIER_ICONS = {
  starter: <Zap size={20} />,
  growth: <Crown size={20} />,
  scale: <Rocket size={20} />,
  self_hosted: <Server size={20} />,
  managed_starter: <Zap size={20} />,
  managed_growth: <Crown size={20} />,
  managed_pro: <Rocket size={20} />,
  enterprise: <PhoneCall size={20} />,
};

const PricingTierCard = ({
  tier,
  currency = "USD",
  billing = "monthly",
  variant = "light",
  isCurrent = false,
  onSelect,
  ctaLabel,
  // Set while a checkout is in flight. `busy` marks THIS card as the one being
  // bought; `disabled` greys the rest so a second order cannot be started.
  busy = false,
  disabled = false,
}) => {
  const dark = variant === "dark";
  const isCustom = !!tier.custom;
  const unavailable = tier.available === false;

  const symbol = currency === "INR" ? "₹" : "$";
  const locale = currency === "INR" ? "en-IN" : "en-US";

  const monthlyUsd = tier.priceUsdMonthly;
  const semiUsd = semiAnnualUsd(monthlyUsd);

  const fmt = (usd) => {
    if (usd === null || usd === undefined) return "Custom";
    const v = currency === "INR" ? usdToInr(usd) : usd;
    return `${symbol}${v.toLocaleString(locale)}`;
  };

  const showSemi = billing === "semiAnnual" && !isCustom;
  const headlinePrice = isCustom ? "Custom" : showSemi ? fmt(semiUsd) : fmt(monthlyUsd);
  const headlineSuffix = isCustom ? "" : showSemi ? "/ 6 mo" : "/ month";

  const creditLine = isCustom
    ? "Custom credit allowance"
    : `${tier.credits.toLocaleString(locale)} credits / month`;

  return (
    <div
      className={[
        "group relative rounded-3xl p-6 flex flex-col transition-all duration-300 border",
        dark
          ? "bg-slate-800 border-slate-700 shadow-lg hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/20"
          : "bg-white shadow-sm hover:shadow-md",
        !dark && tier.highlighted
          ? "border-2 border-orange-500 shadow-xl shadow-orange-500/10 lg:scale-105 z-10"
          : !dark
            ? "border-slate-200 hover:border-orange-200"
            : "",
        unavailable ? "opacity-60" : "",
      ].join(" ")}
    >
      {tier.highlighted && !unavailable && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-b-lg text-[10px] font-black uppercase tracking-wide shadow-sm">
          Most Popular
        </div>
      )}

      {isCurrent && (
        <div className="absolute top-4 right-4 bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">
          Current
        </div>
      )}

      {/* Title */}
      <div className="flex items-center gap-4 mb-4 mt-2">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
            dark
              ? "bg-slate-700 text-orange-400 group-hover:bg-orange-500 group-hover:text-white"
              : tier.highlighted
                ? "bg-orange-500 text-white border border-orange-600"
                : "bg-white text-orange-500 border border-slate-100 shadow-sm"
          }`}
        >
          {TIER_ICONS[tier.key] || <Zap size={20} />}
        </div>
        <div className="min-w-0">
          <h3
            className={`text-xl font-bold leading-none mb-1.5 ${dark ? "text-white" : "text-slate-900"}`}
          >
            {tier.name}
          </h3>
          {tier.engineLabel && (
            <div className={`text-[11px] font-semibold ${dark ? "text-orange-400" : "text-orange-600"}`}>
              {tier.engineLabel}
            </div>
          )}
        </div>
      </div>

      {/* Price */}
      <div
        className={`my-4 rounded-2xl p-4 border min-h-[104px] flex flex-col justify-center ${
          dark
            ? "bg-slate-900/50 border-slate-700/50 group-hover:border-orange-500/30"
            : "bg-slate-50 border-slate-100"
        }`}
      >
        <p
          className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${dark ? "text-slate-500" : "text-slate-400"}`}
        >
          {isCustom ? "Pricing" : showSemi ? "6-Month Billing" : "Monthly Billing"}
        </p>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={`text-3xl font-black tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
            {headlinePrice}
          </span>
          {headlineSuffix && (
            <span className={`text-xs font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>
              {headlineSuffix}
            </span>
          )}
        </div>

        {!isCustom && (
          <p className={`text-xs font-bold mt-2 ${dark ? "text-orange-400" : "text-orange-600"}`}>
            {creditLine}
          </p>
        )}
        {currency === "INR" && !isCustom && (
          <p className={`text-[10px] mt-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Indicative — billed in USD
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mt-2 mb-6 flex-1">
        {tier.features.map((feature, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 text-sm font-medium leading-snug ${
              dark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            <CheckCircle2
              size={16}
              className={`shrink-0 mt-0.5 ${dark ? "text-orange-500" : "text-emerald-500"}`}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {unavailable && (
        <p
          className={`text-[11px] font-semibold mb-3 ${dark ? "text-amber-400" : "text-amber-600"}`}
        >
          Coming soon — contact sales for early access.
        </p>
      )}

      {onSelect && (
        <button
          onClick={() => onSelect(tier)}
          disabled={busy || disabled}
          className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
            tier.highlighted && !unavailable
              ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
              : dark
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200"
          }`}
        >
          {busy && (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          )}
          {busy ? "Opening checkout…" : ctaLabel || (isCustom ? "Contact Sales" : `Get ${tier.name}`)}
        </button>
      )}
    </div>
  );
};

export default PricingTierCard;
