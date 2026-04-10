import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Rocket,
  Zap,
  Crown,
  PhoneCall,
  ArrowRight,
  TrendingDown,
  X,
  Copy,
} from "lucide-react";

const makeDirectPayment = async (amount, plan, days, currency, navigate) => {
  try {
    const { data } = await axios.post(
      `${process.env.REACT_APP_AUTH_URL}/payment/user/order`,
      { amount, currency },
    );

    if (!data.success) {
      toast.error("Failed to create Razorpay order");
      return;
    }

    const {
      id: order_id,
      amount: order_amount,
      currency: order_currency,
    } = data.data;

    const options = {
      key: process.env.REACT_APP_RAZORPAY_KEY_ID,
      amount: order_amount,
      currency: order_currency,
      name: "MNR Technologies",
      description: `${plan.name} Plan Subscription`,
      order_id: order_id,
      handler: async function (response) {
        const token = JSON.parse(localStorage.getItem("token"));
        const verifyRes = await axios.post(
          `${process.env.REACT_APP_AUTH_URL}/payment/user/verify`,
          {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan: plan.name?.toLowerCase(),
            days: days,
            amount: amount,
            currency: currency,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (verifyRes.data.success) {
          toast.success("Payment verified successfully!");
          navigate("/dashboard");
        } else {
          toast.error("Payment verification failed!");
          navigate("/dashboard");
        }
      },
      theme: {
        color: "#f97316",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error(error);
    toast.error("Something went wrong while processing payment.");
  }
};

const UpgradePlan = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("sales@mnrtechnologies.com");
    toast.success("Email copied to clipboard!");
  };

  const plans = [
    {
      name: "Platform Demo",
      icon: <Rocket size={24} />,
      desc: "Schedule a live walkthrough to see our automation capabilities in action.",
      isDemo: true, // Special flag for demo
      features: [
        "Live Platform Walkthrough",
        "Custom Architecture Review",
        "ROI & Scaling Consultation",
        "Dedicated Q&A Session",
      ],
      buttonText: "Book Demo",
      highlighted: false,
    },
    {
      name: "Basic",
      icon: <Zap size={24} />,
      monthlyPrice: { INR: 2499, USD: 25 },
      semiAnnualPrice: { INR: 13499, USD: 135 },
      duration: "/ month",
      desc: "For small teams starting their automation journey.",
      features: [
        "10 Web Testing / month",
        "Email Support",
        "CI/CD Pipeline Integrations",
      ],
      buttonText: "Get Basic",
      highlighted: false,
    },
    {
      name: "Premium",
      icon: <Crown size={24} />,
      monthlyPrice: { INR: 7999, USD: 85 },
      semiAnnualPrice: { INR: 43199, USD: 459 },
      duration: "/ month",
      desc: "Advanced features for growing QA and engineering teams.",
      features: [
        "100 Web Testing / month",
        "Email Support",
        "CI/CD Pipeline Integrations",
      ],
      buttonText: "Upgrade to Premium",
      highlighted: true,
    },
    {
      name: "Custom",
      icon: <PhoneCall size={24} />,
      monthlyPrice: { INR: "Custom", USD: "Custom" },
      semiAnnualPrice: { INR: "Custom", USD: "Custom" },
      duration: "",
      desc: "Tailored infrastructure for massive scale and security.",
      features: [
        "On-Premise Deployment",
        "Custom Tool Integrations",
        "Dedicated Infrastructure",
        "Dedicated Account Manager",
      ],
      buttonText: "Contact Sales",
      highlighted: false,
      isCustom: true,
    },
  ];

  const handleAction = (plan) => {
    // 1. Trigger Modal for Demo or Custom Plans
    if (plan.isDemo || plan.isCustom) {
      setShowModal(true);
      return;
    }

    const currentPrice = isAnnual
      ? plan.semiAnnualPrice[currency]
      : plan.monthlyPrice[currency];

    // 2. Handle Free Trial fallback (If you ever add a $0 plan back)
    if (currentPrice === 0) {
      toast.success("Trial started successfully!");
      navigate("/dashboard");
      return;
    }

    // 3. Determine Subscription Duration (Days)
    const days = isAnnual ? 180 : 30;

    // 4. Trigger Razorpay Flow
    makeDirectPayment(currentPrice, plan, days, currency, navigate);
  };

  return (
    <div className="max-w-[90rem] mx-auto space-y-12 pb-16 pt-8 px-4 sm:px-6 relative">
      {/* HEADER SECTION */}
      <div className="text-center max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
          Supercharge Your{" "}
          <span className="text-orange-500">Testing Matrix</span>
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          Start with a personalized demo, or choose a plan that perfectly fits your engineering scale.
        </p>

        {/* TOGGLES SECTION */}
        <div className="flex flex-col items-center justify-center gap-5 mt-8">
          {/* Currency Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setCurrency("INR")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                currency === "INR"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              INR (₹)
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                currency === "USD"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-sm font-bold ${!isAnnual ? "text-slate-900" : "text-slate-400"}`}
            >
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-14 h-7 bg-slate-200 rounded-full p-1 relative transition-colors duration-200"
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isAnnual ? "translate-x-7" : "translate-x-0"}`}
              ></div>
            </button>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-bold ${isAnnual ? "text-slate-900" : "text-slate-400"}`}
              >
                6 Months
              </span>
              <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Save ~10%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING CARDS GRID - Adjusted to lg:grid-cols-4 for perfect centering */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {plans.map((plan, idx) => {
          
          let displayPrice = "";
          let durationText = "";
          const currencySymbol = currency === "INR" ? "₹" : "$";

          if (plan.isDemo) {
            displayPrice = "Free";
          } else if (plan.isCustom) {
            displayPrice = "Custom";
          } else {
            const currentPrice = isAnnual ? plan.semiAnnualPrice[currency] : plan.monthlyPrice[currency];
            displayPrice = `${currencySymbol}${currentPrice.toLocaleString()}`;
            durationText = isAnnual ? "/ 6 mo" : plan.duration;
          }

          return (
            <div
              key={idx}
              className={`relative flex flex-col bg-white rounded-3xl p-6 transition-all duration-300 group overflow-hidden
                ${
                  plan.highlighted
                    ? "border-2 border-orange-500 shadow-xl shadow-orange-500/10 scale-100 lg:scale-105 z-10"
                    : "border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-200"
                }
              `}
            >
              <div
                className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-150
                ${plan.highlighted ? "bg-orange-100/50" : "bg-slate-50"}
              `}
              ></div>

              {plan.highlighted && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-b-lg text-xs font-bold uppercase tracking-wide shadow-sm">
                  Most Popular
                </div>
              )}

              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 shadow-sm border
                ${plan.highlighted ? "bg-orange-500 text-white border-orange-600 mt-2" : "bg-white text-orange-500 border-slate-100"}
              `}
              >
                {plan.icon}
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {plan.name}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed min-h-[40px] mb-6">
                {plan.desc}
              </p>

              <div className="mb-6 min-h-[50px] flex flex-col justify-center">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">
                    {displayPrice}
                  </span>
                  {durationText && (
                    <span className="text-slate-500 text-xs font-medium">
                      {durationText}
                    </span>
                  )}
                </div>
                {isAnnual && !plan.isCustom && !plan.isDemo && plan.monthlyPrice[currency] > 0 && (
                  <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                    <TrendingDown size={12} />
                    Total {currencySymbol}
                    {plan.semiAnnualPrice[currency].toLocaleString()} billed half-yearly
                  </div>
                )}
              </div>

              <hr className="border-slate-100 mb-6" />

              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, fIdx) => (
                  <li
                    key={fIdx}
                    className="flex items-start gap-3 text-sm text-slate-700 font-medium leading-tight"
                  >
                    <CheckCircle2
                      size={16}
                      className="text-emerald-500 shrink-0 mt-0.5"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.buttonText && (
                <button
                  onClick={() => handleAction(plan)}
                  className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200
                  ${
                    plan.highlighted
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200"
                  }
                `}
                >
                  {plan.buttonText}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER SECTION */}
      <p className="text-center text-sm text-gray-500 mt-8">
        Need a more specific testing arrangement?{" "}
        <button
          onClick={() => setShowModal(true)}
          className="text-orange-500 font-bold cursor-pointer hover:underline"
        >
          Contact our Solution Architects.
        </button>
      </p>

      {/* CONTACT/DEMO MODAL OVERLAY */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center relative shadow-2xl">
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors"
              onClick={() => setShowModal(false)}
            >
              <X size={20} />
            </button>

            {/* Modal Icon */}
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500 border border-orange-200">
              <PhoneCall size={32} />
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
              Get in Touch
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              To schedule your personalized platform walkthrough or discuss a custom plan, please reach out to our sales team directly at the email address below. We typically respond within a few hours.
            </p>

            {/* Email Copy Box */}
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