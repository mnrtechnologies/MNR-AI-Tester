import React from "react";

const Footer = () => {
  return (
    // Re-added 'fixed bottom-0 z-50'
    <footer className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 py-4 px-6 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-medium text-slate-400">
        <p>© 2026 AT Tester. All rights reserved.</p>
        <p>
          Developed by{" "}
          <a href="#" className="text-slate-700 font-bold hover:text-orange-500 transition-colors">
            MNR Technologies
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;