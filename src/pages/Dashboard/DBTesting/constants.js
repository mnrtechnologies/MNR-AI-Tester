import { Key, Lock, Shield, FileSpreadsheet, Database } from 'lucide-react';

export const sevCfg = {
  critical: { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-700'   },
  warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700'  },
  info:     { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700'   },
};

export const stCfg = {
  pending:   { pill: 'bg-slate-50 text-slate-500 border-slate-200',       dot: 'bg-slate-400 animate-pulse', label: 'Queued'    },
  running:   { pill: 'bg-orange-50 text-orange-700 border-orange-200',    dot: 'bg-orange-500 animate-pulse', label: 'Running'   },
  completed: { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500',              label: 'Completed' },
  failed:    { pill: 'bg-rose-50 text-rose-700 border-rose-200',          dot: 'bg-rose-500',                 label: 'Failed'    },
  cancelled: { pill: 'bg-slate-50 text-slate-500 border-slate-200',       dot: 'bg-slate-400',                label: 'Cancelled' },
};

export const credIcons = {
  api_key:      Key,
  password:     Lock,
  token:        Shield,
  certificate:  FileSpreadsheet,
  database_url: Database,
};

export const ASSESS_PHASES = ['DB Diagnostic', 'AI Generation', 'AI Analysis'];
