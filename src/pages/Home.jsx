import React from "react";
import { motion } from "framer-motion";
import { Zap, Cpu, Layout, Globe, LineChart, Shield, Lock } from "lucide-react";
import HomeHeader from "../components/Layout/HomeHeader";
import heroImg from "../assets/homeImage.jpg";
import aiImg from "../assets/Intell_automation_image.jpg";
import ContactPage from "../components/UI/ContactPage";
import { useNavigate } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7 } },
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
              onClick={() => navigate("/signup")}
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

      {/* ================= >>FOOTER <<================= */}
      {/* ================= CONTACT ================= */}
      <section id="contact">
        <ContactPage />
      </section>
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
