import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Layers, ChevronRight } from 'lucide-react';

const TestHome = () => {
  const navigate = useNavigate();

  const testingModules = [
    {
      title: "Automation Testing",
      description: "Deploy AI agents to execute end-to-end test suites and ensure code reliability.",
      path: "/automation-testing",
      icon: <Beaker size={20} className="text-cyan-400 group-hover:scale-110 transition-transform" />,
      color: "cyan"
    },
    {
      title: "Functional Testing",
      description: "Verify software actions against requirements to ensure perfect user experience.",
      path: "/functional-testing",
      icon: <Layers size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />,
      color: "purple"
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Quality Assurance Hub</h1>
          <p className="text-slate-400">Select a testing methodology to begin your audit.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testingModules.map((module, index) => (
            <div
              key={index}
              onClick={() => navigate(module.path)}
              className="group relative bg-[#0f172a]/80 backdrop-blur-md border border-white/10 p-8 rounded-3xl cursor-pointer transition-all duration-300 hover:border-cyan-400/40 hover:bg-[#1e293b]/50 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(34,211,238,0.1)] shadow-2xl"
            >
              {/* Icon Container */}
              <div className="w-12 h-12 bg-white/5 rounded-2xl mb-6 flex items-center justify-center border border-white/10 group-hover:border-cyan-400/50 transition-all">
                {module.icon}
              </div>

              {/* Content */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors tracking-tight">
                  {module.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {module.description}
                </p>
              </div>

              {/* Bottom Action */}
              <div className="mt-8 flex items-center text-xs font-bold uppercase tracking-widest text-cyan-400 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Launch Module <ChevronRight size={14} className="ml-1" />
              </div>

              {/* Decorative Gradient Glow */}
              <div className="absolute -inset-px bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestHome;