import React from 'react';
import HomeHeader from '../components/Layout/HomeHeader.jsx';
import { MousePointer2, Zap, LayoutGrid, RotateCw, Settings } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <HomeHeader />

      {/* Hero Section */}
      <section className="flex flex-col items-center pt-20 px-4 text-center">
        <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
          Transformative AI Testing
        </h1>
        <p className="text-slate-500 text-lg mb-10">Revolutionize Your Testing</p>
        
        {/* Hero Illustration Placeholder */}
        <div className="w-full max-w-4xl bg-slate-50 rounded-3xl p-4 border border-slate-100 shadow-sm">
           <div className="aspect-video bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-slate-300">
             {/* i need to add image */}
           </div>
        </div>
      </section>

      {/* Features Grid: "Unlock the Power" */}
      <section className="max-w-7xl mx-auto px-16 py-24 text-center">
        <span className="text-sm font-semibold text-[#9fc7bd] uppercase tracking-wider">Features</span>
        <h2 className="text-4xl font-bold mt-2 mb-16">Unlock the Power</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard icon={<Settings />} title="Intelligent" desc="Effortless Integration" />
          <FeatureCard icon={<RotateCw />} title="Continuous" desc="Boost Collaboration" />
          <FeatureCard icon={<LayoutGrid />} title="Flexible" desc="Cloud or On-Premise" />
        </div>
      </section>
    </div>
  );
};

// Helper component for Feature Cards
const FeatureCard = ({ icon, title, desc }) => (
  <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center">
    <div className="p-3 bg-white rounded-xl shadow-sm mb-4 text-[#9fc7bd]">
      {React.cloneElement(icon, { size: 24 })}
    </div>
    <h3 className="text-xl font-bold mb-1">{title}</h3>
    <p className="text-slate-500">{desc}</p>
  </div>
);

export default Home;