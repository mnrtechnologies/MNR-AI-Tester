import React from "react";
import { useSelector } from "react-redux";
import { Lock, AlertCircle, Mail } from "lucide-react"; // Swapped Sparkles for Mail
import { Link } from "react-router-dom";

const SubscriptionGuard = ({ children, featureName = "this feature" }) => {
  const { user } = useSelector((state) => state.profile);

  const isSuperAdmin = user?.role === 'super_admin';

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  const currentSub = user?.activeSubscription;

  // 1. FIRST check if the plan is expired or doesn't exist
  const isExpired = !currentSub || currentSub.isActive === false;

  // 2. THEN grab the usage limits
  const testsUsed = currentSub?.planDetails?.testsUsed || 0;
  const maxTestsAllowed = currentSub?.planDetails?.maxTestsAllowed || 0;

  // 3. ONLY flag limit reached if the plan is actually active
  const isLimitReached =
    !isExpired && maxTestsAllowed !== -1 && testsUsed >= maxTestsAllowed;

  const isLocked = isExpired || isLimitReached;

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-gray-50/50">
      <div className="w-full h-full pointer-events-none filter blur-md opacity-40 select-none transition-all duration-300">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full flex flex-col items-center text-center">
          {isExpired ? (
            <Lock className="w-12 h-12 text-orange-500 mb-4" />
          ) : (
            <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
          )}

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {isExpired ? "Subscription Expired" : "Usage Limit Reached"}
          </h2>

          <p className="text-gray-500 mb-8 leading-relaxed">
            {isExpired
              ? `Your company's plan has ended or is inactive. Contact your administrator to continue using ${featureName}.`
              : `Your company has used all ${maxTestsAllowed} tests for the current plan. Contact your administrator to unlock more capacity for ${featureName}.`}
          </p>

          <Link className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white font-medium rounded-xl transition-colors shadow-sm cursor-default">
            <Mail className="w-5 h-5" />
            Contact Your Admin
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGuard;
