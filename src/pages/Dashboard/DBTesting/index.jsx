import React, { useState } from 'react';
import { Activity, Sparkles, BarChart3, Key, Shield } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import AssessmentTab from './tabs/AssessmentTab';
import AnalysisTab from './tabs/AnalysisTab';
import CredentialsTab from './tabs/CredentialsTab';
import ApiKeysTab from './tabs/ApiKeysTab';

const TABS = [
  { id: 'assessment',  icon: Sparkles,  label: 'Full Assessment' },
  { id: 'analysis',    icon: BarChart3, label: 'DB Analysis'     },
  { id: 'credentials', icon: Key,       label: 'Credentials'     },
  { id: 'api-keys',    icon: Shield,    label: 'API Keys'        },
];

export default function DBTesting() {
  const [tab, setTab] = useState('assessment');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .shimmer-bar {
          background: linear-gradient(90deg, #fed7aa 25%, #fb923c 50%, #fed7aa 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
      `}} />

      <Toaster position="top-right" />

      <div className="max-w-5xl mx-auto space-y-5 pb-12 pt-4 px-4">

        {/* Header + Tab bar */}
        <div className="bg-white rounded-3xl px-8 pt-7 pb-0 shadow-xl border border-slate-200">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-500/20">
              <Activity size={13} /><span>DB Testing Suite</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Database <span className="text-orange-500">Tester</span>
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm">AI-powered diagnostics, test generation, and credential management for your databases.</p>
          </div>
          <div className="flex gap-0 border-b border-slate-200 -mx-8 px-8 overflow-x-auto hide-scroll">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 -mb-px transition-all whitespace-nowrap ${
                  tab === id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Always-mounted tabs — CSS hidden preserves state across switches */}
        <div className={tab !== 'assessment'  ? 'hidden' : ''}><AssessmentTab  /></div>
        <div className={tab !== 'analysis'    ? 'hidden' : ''}><AnalysisTab    /></div>
        <div className={tab !== 'credentials' ? 'hidden' : ''}><CredentialsTab /></div>
        <div className={tab !== 'api-keys'    ? 'hidden' : ''}><ApiKeysTab     /></div>

      </div>
    </div>
  );
}
