import React from "react";
import { useSelector } from "react-redux";
import { Lock, AlertCircle, Mail, AlertTriangle, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Gates a testing surface on the company's credit balance.
 *
 * Four states, deliberately not treated the same:
 *   no plan yet      -> blur + overlay. A super admin creates the company and
 *                       its admin account and NOTHING ELSE; buying the first
 *                       plan is the company admin's job. So this is the normal
 *                       state of a brand-new account, not a fault, and it must
 *                       never read as "expired".
 *   expired          -> blur + overlay (nothing can run)
 *   out of credits   -> blur + overlay (nothing can run)
 *   low balance      -> a banner ABOVE the children, never a blur. Blurring
 *                       someone who still has usable credits would be worse
 *                       than the old behaviour: they can still work, they just
 *                       need to know it is running out.
 *
 * The copy also branches on WHO is looking. A company admin can resolve every
 * one of these themselves at /upgrade-plan; telling them to "contact your
 * administrator" sends them to look for a person who is already them.
 *
 * Reads `user.creditAccount`, falling back to the legacy `activeSubscription`
 * shape for one release so a cached JS bundle meeting a new API (or the
 * reverse) still renders correctly during rollout.
 */

/** @deprecated remove with `activeSubscription` once every client sends creditAccount. */
function deriveFromLegacy(sub) {
  if (!sub) return null;
  const allowance = sub?.planDetails?.maxTestsAllowed ?? 0;
  const used = sub?.planDetails?.testsUsed ?? 0;
  const unlimited = allowance === -1;
  return {
    legacy: true,
    tierName: sub.plan || sub.legacyPlan || "your plan",
    balance: unlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, allowance - used),
    reserved: 0,
    monthlyAllowance: unlimited ? Number.MAX_SAFE_INTEGER : allowance,
    unlimited,
    overageEnabled: false,
    isActive: sub.isActive !== false,
    lowCreditThreshold: 0,
  };
}

const SubscriptionGuard = ({ children, featureName = "this feature", requiredCredits = 1 }) => {
  const { user } = useSelector((state) => state.profile);

  if (user?.role === "super_admin") {
    return <>{children}</>;
  }

  const account = user?.creditAccount || deriveFromLegacy(user?.activeSubscription);
  const canBuy = user?.role === "company_admin";

  // Never had a plan vs had one that ended. Same blur, very different message.
  const hasNoPlan = !account;
  const isExpired = !hasNoPlan && account.isActive === false;
  const blocked = hasNoPlan || isExpired;

  const balance = account?.balance ?? 0;
  const unlimited = !!account?.unlimited;

  // Every plan is quoted a capacity cost before a run, so the same requirement
  // applies to both. (Managed plans pay model usage on top of that, but usage
  // is charged after the fact and never blocks a run already under way.)
  const isOutOfCredits =
    !blocked && !unlimited && !account?.overageEnabled && balance < requiredCredits;

  const threshold = account?.lowCreditThreshold ?? 0;
  const isLow = !blocked && !isOutOfCredits && !unlimited && threshold > 0 && balance <= threshold;

  if (!blocked && !isOutOfCredits) {
    if (!isLow) return <>{children}</>;

    // Low balance: warn, but never take the feature away.
    return (
      <div className="w-full">
        <div className="mx-4 mt-4 mb-2 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900">
              {balance} credit{balance === 1 ? "" : "s"} remaining
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              You're close to your monthly allowance on {account.tierName}. Runs will
              be blocked once it reaches zero.
            </p>
          </div>
          <Link
            to="/upgrade-plan"
            className="text-xs font-bold text-amber-900 underline underline-offset-2 shrink-0 hover:text-amber-950"
          >
            View plans
          </Link>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-gray-50/50">
      <div className="w-full h-full pointer-events-none filter blur-md opacity-40 select-none transition-all duration-300">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full flex flex-col items-center text-center">
          {hasNoPlan ? (
            <Rocket className="w-12 h-12 text-orange-500 mb-4" />
          ) : isExpired ? (
            <Lock className="w-12 h-12 text-orange-500 mb-4" />
          ) : (
            <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
          )}

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {hasNoPlan
              ? canBuy
                ? "Choose your plan"
                : "No plan yet"
              : isExpired
                ? "Subscription Expired"
                : "Out of Credits"}
          </h2>

          <p className="text-gray-500 mb-6 leading-relaxed">
            {hasNoPlan
              ? canBuy
                ? `Your account is ready. Pick a plan to unlock ${featureName} — it activates the moment your payment goes through.`
                : `Your organisation hasn't chosen a plan yet. Ask your company admin to pick one to unlock ${featureName}.`
              : isExpired
                ? canBuy
                  ? `Your company's plan has ended. Renew it to continue using ${featureName}.`
                  : `Your company's plan has ended or is inactive. Contact your administrator to continue using ${featureName}.`
                : canBuy
                  ? `Your company has ${balance} credit${balance === 1 ? "" : "s"} left and ${featureName} needs at least ${requiredCredits}. Top up or move to a larger plan to carry on.`
                  : `Your company has ${balance} credit${balance === 1 ? "" : "s"} left and ${featureName} needs at least ${requiredCredits}. Contact your administrator to top up.`}
          </p>

          {!blocked && account?.reserved > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-6">
              {account.reserved} credit{account.reserved === 1 ? " is" : "s are"}{" "}
              currently reserved for a run in progress. They'll return automatically if
              that run doesn't complete.
            </p>
          )}

          <Link
            to="/upgrade-plan"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            {canBuy ? <Rocket className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
            {canBuy
              ? hasNoPlan
                ? "Choose a plan"
                : isExpired
                  ? "Renew your plan"
                  : "Add credits"
              : "View Plans & Contact Admin"}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGuard;
