import React from "react";

/**
 * StatCard — one dashboard metric tile.
 *
 * This file existed but was empty, and three dashboards had each hand-rolled
 * their own tile markup. They now share this one.
 *
 * Props
 *   label     required, the metric name
 *   value     required, the big number
 *   sublabel  optional caption under the value
 *   icon      optional lucide element
 *   tone      "default" | "brand" | "positive" | "warning" | "danger"
 *   trend     { value: number, label?: string } — signed, coloured by sign
 *   progress  { value, max, reserved?, caption? } — renders a meter.
 *             `reserved` draws a second, lighter segment for credits that are
 *             held but not yet spent; omitting it makes a run in progress look
 *             free right up until it settles.
 */

const TONES = {
  default: { ring: "border-gray-100", icon: "bg-gray-50 text-gray-500", bar: "bg-gray-800" },
  brand: { ring: "border-orange-100", icon: "bg-orange-50 text-orange-500", bar: "bg-orange-500" },
  positive: { ring: "border-emerald-100", icon: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" },
  warning: { ring: "border-amber-100", icon: "bg-amber-50 text-amber-600", bar: "bg-amber-500" },
  danger: { ring: "border-rose-100", icon: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
};

const StatCard = ({
  label,
  value,
  sublabel,
  icon,
  tone = "default",
  trend,
  progress,
  className = "",
}) => {
  const t = TONES[tone] || TONES.default;

  let usedPct = 0;
  let reservedPct = 0;
  if (progress && progress.max > 0) {
    usedPct = Math.min(100, Math.max(0, (progress.value / progress.max) * 100));
    if (progress.reserved) {
      reservedPct = Math.min(100 - usedPct, (progress.reserved / progress.max) * 100);
    }
  }

  return (
    <div
      className={`bg-white rounded-2xl border ${t.ring} shadow-sm p-5 flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 truncate">
            {label}
          </p>
          <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight break-words">
            {value}
          </p>
        </div>

        {icon && (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}
          >
            {icon}
          </div>
        )}
      </div>

      {progress && progress.max > 0 && (
        <div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
            <div
              className={`h-full ${t.bar} transition-all duration-500`}
              style={{ width: `${usedPct}%` }}
            />
            {reservedPct > 0 && (
              // Held but not yet spent — a distinct colour so it reads as
              // "pending", not "gone".
              <div
                className="h-full bg-amber-300 transition-all duration-500"
                style={{ width: `${reservedPct}%` }}
                title="Reserved for a run in progress"
              />
            )}
          </div>
          {progress.caption && (
            <p className="text-[11px] text-gray-400 mt-1.5">{progress.caption}</p>
          )}
        </div>
      )}

      {(sublabel || trend) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {sublabel && <span className="text-gray-500 truncate">{sublabel}</span>}
          {trend && typeof trend.value === "number" && (
            <span
              className={`font-bold shrink-0 ${
                trend.value > 0
                  ? "text-emerald-600"
                  : trend.value < 0
                    ? "text-rose-600"
                    : "text-gray-400"
              }`}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}
              {trend.label ? ` ${trend.label}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
