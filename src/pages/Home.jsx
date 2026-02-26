import React from "react";
import { motion } from "framer-motion";
import { Zap, Cpu, Layout, Globe, LineChart, Shield, Lock } from "lucide-react";
import HomeHeader from "../components/Layout/HomeHeader";
import heroImg from "../assets/homeImage.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7 } },
};

const Home = () => {
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
              Discover the future of software testing. MNR AT’s AI-driven platform
              automates functional, UI, API, and regression workflows with
              intelligent defect detection.
            </p>

            <div className="flex gap-4 flex-wrap">
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full shadow-lg shadow-orange-200 transition active:scale-95">
                Contact Us
              </button>

              <button className="border border-orange-200 text-orange-600 px-8 py-3 rounded-full hover:bg-orange-50 transition">
                Learn More
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
            >
            </motion.div>
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
            src={heroImg}
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

            <button className="bg-slate-900 text-white px-8 py-3 rounded-full font-semibold hover:bg-orange-600 transition">
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
            <h2 className="text-3xl md:text-5xl font-black">Unlock the Power</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
            <Card icon={<Cpu />} title="Discovery" />
            <Card icon={<Layout />} title="UI / UX" />
            <Card icon={<Globe />} title="Cloud Native" />
            <Card icon={<LineChart />} title="Load Testing" />
            <Card icon={<Shield />} title="Regression" />
            <Card icon={<Lock />} title="Enterprise Security" />
          </div>
        </div>
      </section>

      {/* ================= >>FOOTER <<================= */}
      <footer id="contact" className="bg-slate-900 text-white px-6 md:px-12 py-24">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-14">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              The Future of Software Quality with MNR AT
            </h2>
            <p className="text-slate-300 italic mb-8">
              MNR AT transforms quality assurance from manual and reactive into autonomous and predictive. Our AI-driven engine continuously discovers risks, prioritizes tests, and prevents production failures before they impact users.
            </p>

          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            className="hero-glass p-10 rounded-3xl"
          >
            <h3 className="text-xl font-bold mb-6">Request Demo</h3>

            <input
              placeholder="Work Email"
              className="w-full mb-4 p-3 rounded-xl bg-white/80 text-slate-900"
            />

            <textarea
              placeholder="Tell us about your project..."
              className="w-full mb-6 p-3 rounded-xl bg-white/80 text-slate-900"
            />

            <button className="w-full bg-orange-500 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">
              Submit
            </button>
          </motion.div>
        </div>
      </footer>
    </div>
  );
};

const Card = ({ icon, title }) => (
  <motion.div
    whileHover={{ y: -10 }}
    className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition"
  >
    <div className="text-orange-500 mb-4">{icon}</div>
    <h4 className="font-semibold">{title}</h4>
  </motion.div>
);

export default Home;