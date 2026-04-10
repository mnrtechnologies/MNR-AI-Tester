import React, {useState} from "react";
import { motion } from "framer-motion";
import { Zap, Cpu, Layout, Globe, LineChart, Shield, Lock } from "lucide-react";
import { 
  Rocket, 
 
  Crown, 
  PhoneCall, 
  CheckCircle2,
  Mail,
  Copy,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";

import HomeHeader from "../components/Layout/HomeHeader";
import heroImg from "../assets/homeImage.jpg";
import aiImg from "../assets/Intell_automation_image.jpg";
import ContactPage from "../components/UI/ContactPage";
import { useNavigate } from "react-router-dom";
//import Footer from "../components/UI/Footer";
// import PricingCTA from "../components/UI/Pricing";

const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7 } },
};



const PricingCTA = () => {
  // State to control the visibility of the Demo Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to copy email and show toast
  const handleCopyEmail = () => {
    navigator.clipboard.writeText("sales@mnrtechnologies.com");
    toast.success("Email copied to clipboard!");
  };

  const ctaPlans = [
    {
      name: "Platform Demo",
      icon: <Rocket size={20} />,
      desc: "Schedule a live walkthrough to see our automation capabilities in action.",
      isDemo: true, 
      pricing: null,
      features: [
        "Live Platform Walkthrough",
        "Custom Architecture Review",
        "ROI & Scaling Consultation",
        "Dedicated Q&A Session",
      ],
    },
    {
      name: "Basic",
      icon: <Zap size={20} />,
      desc: "For small teams starting their automation journey.",
      pricing: {
        monthly: { inr: "₹2,499", usd: "$25" },
        semiAnnual: { inr: "₹13,499", usd: "$135" }
      },
      features: [
        "10 Web Testing / month",
        "Email Support",
        "CI/CD Pipeline Integrations",
      ],
    },
    {
      name: "Premium",
      icon: <Crown size={20} />,
      desc: "Advanced features for growing QA and engineering teams.",
      pricing: {
        monthly: { inr: "₹7,999", usd: "$85" },
        semiAnnual: { inr: "₹43,199", usd: "$459" }
      },
      features: [
        "100 Web Testing / month",
        "Email Support",
        "CI/CD Pipeline Integrations",
      ],
    },
    {
      name: "Custom",
      icon: <PhoneCall size={20} />,
      desc: "Tailored infrastructure for massive scale and security.",
      isCustom: true,
      pricing: {
        monthly: { inr: "Custom", usd: "Custom" },
        semiAnnual: { inr: "Custom", usd: "Custom" }
      },
      features: [
        "On-Premise Deployment",
        "Custom Tool Integrations",
        "Dedicated Infrastructure",
        "Dedicated Account Manager",
      ],
    },
  ];

  return (
    <section className="bg-slate-900 py-20 px-4 sm:px-6 border-b border-slate-800 relative">
      <div className="max-w-[90rem] mx-auto">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
            Supercharge Your <span className="text-orange-500">Testing Matrix</span>
          </h2>
          <p className="text-slate-400 text-lg">
            Start with a personalized demo, or choose a plan that perfectly fits your engineering scale.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {ctaPlans.map((plan, idx) => {
            return (
              <div 
                key={idx}
                className="group relative bg-slate-800 rounded-3xl p-6 flex flex-col transition-all duration-300 border border-slate-700 shadow-lg hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/20 hover:z-10 xl:hover:scale-105 cursor-default"
              >
                {/* Plan Title & Icon */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 bg-slate-700 text-orange-400 group-hover:bg-orange-500 group-hover:text-white">
                    {plan.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white leading-none mb-1.5">{plan.name}</h3>
                    <div className="text-slate-400 text-xs leading-relaxed line-clamp-2 min-h-[32px]">{plan.desc}</div>
                  </div>
                </div>

                {/* Pricing Display Box */}
                <div className="my-6 flex-shrink-0 bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50 group-hover:border-orange-500/30 transition-colors duration-300 min-h-[110px] flex flex-col justify-center">
                  
                  {plan.isDemo ? (
                    // Special UI just for the Demo plan
                    <div className="text-center space-y-1">
                      <span className="block text-lg font-black text-white mb-2">Book a Live Demo</span>
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-orange-500/10 text-orange-400 font-semibold text-sm rounded-lg border border-orange-500/20 hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        <Mail size={16} />
                        Book Demo
                      </button>
                    </div>
                  ) : (
                    // Standard Pricing UI for Basic, Premium, Custom
                    <div className="space-y-3">
                      {/* Top Row */}
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                          {plan.isCustom ? "Pricing" : "Monthly Billing"}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-white">{plan.pricing.monthly.inr}</span>
                          {!plan.isCustom && (
                            <span className="text-slate-400 font-medium text-sm">| {plan.pricing.monthly.usd}</span>
                          )}
                        </div>
                      </div>

                      {!plan.isCustom && (
                        <>
                          <div className="h-px w-full bg-slate-700/50 my-2"></div>
                          {/* Bottom Row */}
                          <div>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">
                              6-Month Billing
                            </p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-black text-white">{plan.pricing.semiAnnual.inr}</span>
                              <span className="text-slate-400 font-medium text-sm">| {plan.pricing.semiAnnual.usd}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                </div>

                {/* Features List */}
                <ul className="space-y-3 mt-2 flex-1">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3 text-sm text-slate-300 font-medium leading-snug">
                      <CheckCircle2 size={16} className="text-orange-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

              </div>
            );
          })}
        </div>
      </div>

      {/* --- CONTACT MODAL OVERLAY --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-slate-700/50 hover:bg-slate-700 rounded-full p-1"
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 mb-4 border border-orange-500/30">
                  <Rocket size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Book Your Demo</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  To schedule your personalized platform walkthrough, please reach out to our sales team directly at the email address below. We typically respond within a few hours to arrange a time that works best for you.
                </p>
              </div>

              {/* Email Copy Box */}
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

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-hidden">
      <HomeHeader />

      {/* ================= HERO ================= */}
      <section id="home" className="hero-bg relative pt-36 pb-28">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12 items-center">
          {/* LEFT GLASS */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="lg:col-span-5 hero-glass p-10 md:p-14"
          >
            <p className="text-xs uppercase tracking-widest text-orange-600 font-semibold mb-6">
              Autonomous AI Testing for Faster, Smarter Releases
            </p>

            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Elevate Your <br />
              <span className="text-orange-500">QA</span>
            </h1>

            <div className="hero-curve w-[70%] mb-6" />

            <p className="text-slate-600 leading-relaxed mb-8">
              Discover the future of software testing.{" "}
              <span className="text-blue-800 font-semibold">MNR</span>{" "}
              <span className="text-orange-500 font-bold text-lg">AT</span>
              ’s AI-driven platform automates functional, UI, API, and
              regression workflows with intelligent defect detection.
            </p>

            <div className="flex gap-4 flex-wrap">
              <button
                onClick={() =>
                  document
                    .getElementById("contact")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full shadow-lg shadow-orange-200 transition active:scale-95"
              >
                Contact Us
              </button>
            </div>
          </motion.div>

          {/* RIGHT IMAGE */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="lg:col-span-7 flex justify-center lg:justify-end relative"
          >
            <img
              src={heroImg}
              alt="AI"
              className="rounded-[36px] shadow-xl border border-white max-w-[650px] w-full"
            />

            {/* FLOATING BADGE */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="hero-badge absolute -bottom-6 left-10 flex items-center gap-3 p-4"
            ></motion.div>
          </motion.div>
        </div>
      </section>

      {/* =================>> FEATURES<< ================= */}
      <section id="features" className="max-w-7xl mx-auto px-6 md:px-12 py-24">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-black mb-4">
            Transformative AI Testing
          </h2>
          <p className="text-orange-500 uppercase tracking-widest text-xs font-bold">
            Revolutionize Your Workflow
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-14 items-center">
          <motion.img
            src={aiImg}
            alt="features"
            className="rounded-3xl shadow-lg border border-white"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
          />

          <motion.div variants={fadeUp} initial="hidden" whileInView="show">
            <h3 className="text-3xl md:text-4xl font-bold mb-6">
              Intelligent <span className="text-orange-500">Automation</span>
            </h3>

            <p className="text-slate-600 mb-8">
              AI powered prioritization, test generation, and self-healing
              workflows accelerate your release cycle.
            </p>

            <button
              onClick={() => navigate("/login")}
              className="bg-slate-900 text-white px-8 py-3 rounded-full font-semibold hover:bg-orange-600 transition"
            >
              Start your journey
            </button>
          </motion.div>
        </div>
      </section>

      {/* =================> CAPABILITIES <<================= */}
      <section id="about" className="bg-orange-50/40 py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            className="text-center mb-16"
          >
            <p className="text-orange-500 uppercase tracking-widest text-xs font-bold mb-3">
              Capabilities
            </p>
            <h2 className="text-3xl md:text-5xl font-black">
              Unlock the Power of{" "}
              <span className="text-orange-500">Automation Testing</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
            <Card
              icon={<Cpu />}
              title="Intelligent Discovery"
              description="AI-driven requirement analysis, risk prioritization, and smart test coverage planning."
            />

            <Card
              icon={<Layout />}
              title="Experience Validation"
              description="Autonomous UI, UX, accessibility, and visual regression testing across devices."
            />

            <Card
              icon={<Globe />}
              title="Cloud & DevOps Ready"
              description="Seamless automation for cloud-native, microservices, and CI/CD pipelines."
            />

            <Card
              icon={<LineChart />}
              title="Performance Intelligence"
              description="AI-powered load, stress, and scalability testing with predictive insights."
            />

            <Card
              icon={<Shield />}
              title="Self-Healing Automation"
              description="Adaptive tests that evolve with application changes, reducing maintenance overhead."
            />

            <Card
              icon={<Lock />}
              title="Enterprise-Grade Security"
              description="Secure, compliant, and scalable testing for mission-critical applications."
            />
          </div>
        </div>
      </section>

      {/* ================= Plan Pricing  ================= */}
      <section id="pricing">
        <PricingCTA />
      </section>

      {/* ================= CONTACT ================= */}
      <section id="contact">
        <ContactPage />
      </section>

      {/* ================= >>FOOTER <<================= */}
      {/* <Footer /> */}
    </div>
  );
};

const Card = ({ icon, title, description }) => (
  <motion.div
    whileHover={{ y: -10 }}
    className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition h-full"
  >
    <div className="text-orange-500 mb-4">{icon}</div>

    <h4 className="font-semibold mb-2">{title}</h4>

    <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

export default Home;
