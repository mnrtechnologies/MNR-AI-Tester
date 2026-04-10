import React from "react";
import { useSelector } from "react-redux";
import { Lock, AlertCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const SubscriptionGuard = ({ children, featureName = "this feature" }) => {
  const { user } = useSelector((state) => state.profile);

  // Safely grab the latest subscription
  const subscriptions = user?.subscription || [];
  const currentSub = subscriptions[subscriptions.length - 1];

  // 1. Check Expiration Status
  const isExpired = currentSub?.status === "expired";

  // 2. Check Usage Limits
  const testsUsed = currentSub?.planDetails?.testsUsed || 0;
  const maxTestsAllowed = currentSub?.planDetails?.maxTestsAllowed || 0;
  
  // If maxTestsAllowed is -1 (Enterprise), they never reach the limit
  const isLimitReached = maxTestsAllowed !== -1 && testsUsed >= maxTestsAllowed;

  // Determine if we need to show the lock screen
  const isLocked = isExpired || isLimitReached;

  // If everything is fine, render the normal page content
  if (!isLocked) {
    return <>{children}</>;
  }

  // Otherwise, render the blurred overlay
  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-gray-50/50">
      
      {/* The Blurred Background Content */}
      <div className="w-full h-full pointer-events-none filter blur-md opacity-40 select-none transition-all duration-300">
        {children}
      </div>

      {/* The Overlay Dialog */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full flex flex-col items-center text-center">
          
          {isLimitReached ? (
            <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
          ) : (
            <Lock className="w-12 h-12 text-orange-500 mb-4" />
          )}
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {isLimitReached ? "Usage Limit Reached" : "Subscription Expired"}
          </h2>
          
          <p className="text-gray-500 mb-8 leading-relaxed">
            {isLimitReached 
              ? `You have used all ${maxTestsAllowed} tests for your current plan. Upgrade to unlock more capacity for ${featureName}.`
              : `Your plan has ended. Choose a new plan to continue using ${featureName}.`}
          </p>

          <Link 
            to="/upgrade-plan" 
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            <Sparkles className="w-5 h-5" />
            View Upgrade Plans
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGuard;