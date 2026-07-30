import React, { useState } from "react";
import { Rocket, Mail, Copy, X, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import PricingTierCard from "./PricingTierCard";
import { listTiers, listPlanTypes, leadPlanTypeKey, PRICING } from "../../config/pricing/creditMath";

/**
 * Public pricing section on the home page.
 *
 * Every number here comes from src/config/pricing/pricing.data.json — there
 * are no hard-coded prices in this file. It previously advertised
 * "10 Web Testing / month" flat plans, which bore no relation to what a run
 * actually costs: a Contact form and an Inventory dashboard differ by more
 * than 20x in AI spend. Credits price the actual work.
 */

const PricingCTA = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [planType, setPlanType] = useState(leadPlanTypeKey());

  const planTypes = listPlanTypes();
  const tiers = listTiers(planType);
  const activePlan = PRICING.planTypes[planType];

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("sales@mnrtechnologies.com");
    toast.success("Email copied to clipboard!");
  };

  return (
    <section className="bg-slate-900 py-20 px-4 sm:px-6 border-b border-slate-800 relative">
      <div className="max-w-[90rem] mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
            Pay for <span className="text-orange-500">Work Done</span>, Not Pages Visited
          </h2>
          <p className="text-slate-400 text-lg">
            One credit tests one page with up to two test scenarios. Heavy pages cost
            more, simple pages cost less, and you always see the price before we run
            anything.
          </p>
        </div>

        {/* Plan type toggle — BYOK leads */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex bg-slate-800 border border-slate-700 p-1 rounded-xl">
            {planTypes.map((pt) => (
              <button
                key={pt.key}
                onClick={() => setPlanType(pt.key)}
                className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  planType === pt.key
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {pt.label}
                {pt.lead && (
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                      planType === pt.key ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    Best value
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activePlan?.blurb && (
          <p className="text-center text-sm text-slate-400 max-w-2xl mx-auto mb-12">
            {activePlan.blurb}
          </p>
        )}

        {/* Tier grid + the demo card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {tiers.map((tier) => (
            <PricingTierCard key={tier.key} tier={tier} currency="USD" variant="dark" />
          ))}
        </div>

        {/* Demo CTA */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 py-3 px-6 bg-orange-500/10 text-orange-400 font-bold text-sm rounded-xl border border-orange-500/20 hover:bg-orange-500 hover:text-white transition-colors"
          >
            <Mail size={16} />
            Book a Live Demo
          </button>

          <div className="flex items-start gap-2 text-xs text-slate-500 max-w-2xl text-center">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>
              A credit covers one page and up to two scenarios (about 162 AI model
              calls). A page that generates more scenarios costs proportionally more —
              you approve the exact number before any of it runs. Any page producing
              more than {PRICING.formula.MAX_STORIES_PER_URL} scenarios always pauses
              for your confirmation first.
            </p>
          </div>
        </div>
      </div>

      {/* Contact modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-slate-700/50 hover:bg-slate-700 rounded-full p-1"
            >
              <X size={20} />
            </button>

            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 mb-4 border border-orange-500/30">
                  <Rocket size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Book Your Demo</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  To schedule your personalized platform walkthrough, please reach out
                  to our sales team directly at the email address below. We typically
                  respond within a few hours to arrange a time that works best for you.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between mt-2">
                <div className="pl-4 pr-2 py-2 overflow-hidden">
                  <span className="text-slate-200 font-medium text-sm md:text-base truncate block">
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
        </div>
      )}
    </section>
  );
};

export default PricingCTA;
