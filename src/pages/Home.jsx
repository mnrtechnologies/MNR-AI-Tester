import React from "react";
import HomeHeader from "../components/Layout/HomeHeader.jsx";
import { MousePointer2, Zap, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <HomeHeader />

      {/* HERO */}
      <section className="flex flex-col items-center pt-20 px-4 text-center">
        <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
          Autonomous Quality Assurance Powered by AI
        </h1>

        <p className="text-slate-500 text-lg mb-10 max-w-2xl">
          <span className="font-semibold">
            <span className="text-blue-950 text-md ">MNR</span>{" "}
            <span className="text-orange-600 text-xl ">AT</span>
          </span>{" "}
          is an intelligent testing platform that autonomously performs
          functional, API, UI/UX, database, regression, load and stress testing
          - detecting defects before users do.
        </p>

        {/* CTA */}
        <div className="flex gap-4 mb-12">
          <button
            onClick={() => navigate("/login")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition"
          >
            Start Testing
          </button>
        </div>

        {/* Hero Image */}
        {/* <div className="w-full max-w-4xl bg-orange-50 rounded-3xl p-4 border border-orange-100 shadow-sm">
          <div className="aspect-video bg-white rounded-2xl border border-orange-200 flex items-center justify-center text-orange-300">
            Product Preview
          </div>
        </div> */}
      </section>

      {/* KEYWORDS */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h3 className="text-2xl font-bold mb-6 text-blue-950">
          Autonomous AI Testing Across the Entire Stack
        </h3>

        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {[
            "Unit Testing",
            "Functional Testing",
            "UI / UX Testing",
            "API Testing",
            "Database Testing",
            "Regression",
            "Smoke Testing",
            "Load & Stress Testing",
            "Bug Detection",
            "Self Healing",
            "Intelligent Test Generation",
            "Test Case Prioritization",
            "Exploratory Discovery",
            "Defect Scoring",
            "Visualization",
          ].map((item) => (
            <span
              key={item}
              className="px-4 py-2 bg-orange-50 text-orange-500 rounded-full font-medium"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-16 py-24 text-center">
        <span className="text-sm font-semibold text-orange-400 uppercase tracking-wider">
          Features
        </span>
        <h2 className="text-4xl font-bold mt-2 mb-16">
          Why Choose <span className="text-blue-900 text-3xl">MNR</span>{" "}
          <span className="text-orange-600">AT</span>?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Zap />}
            title="Autonomous Intelligence"
            desc="AI agents generate, execute and heal tests without human intervention."
          />

          <FeatureCard
            icon={<MousePointer2 />}
            title="Full Stack Coverage"
            desc="From UI to APIs, databases and performance, everything tested automatically."
          />

          <FeatureCard
            icon={<LayoutGrid />}
            title="Continuous Quality"
            desc="Seamlessly integrate into CI/CD pipelines for continuous feedback."
          />
        </div>
      </section>

      {/* FUTURE */}
      <section className="text-center py-20 bg-orange-50">
        <h2 className="text-3xl font-bold mb-4">
          The Future of Software Quality with{" "}
          <span className="font-bold text-slate-900 text-2xl tracking-wide">
            MNR
          </span>{" "}
          <span className="font-black text-orange-500 text-3xl italic">AT</span>
        </h2>
        <p className="text-slate-500 max-w-3xl mx-auto">
          MNR AT transforms quality assurance from manual and reactive into
          autonomous and predictive. Our AI-driven engine continuously discovers
          risks, prioritizes tests, and prevents production failures before they
          impact users.
        </p>
      </section>
    </div>
  );
};

/* Feature card */
const FeatureCard = ({ icon, title, desc }) => (
  <div className="p-8 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col items-center">
    <div className="p-3 bg-white rounded-xl shadow-sm mb-4 text-orange-500">
      {React.cloneElement(icon, { size: 24 })}
    </div>
    <h3 className="text-xl font-bold mb-1">{title}</h3>
    <p className="text-slate-500">{desc}</p>
  </div>
);

export default Home;
