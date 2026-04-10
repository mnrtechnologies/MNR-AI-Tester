import React from "react";

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-100 py-6 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-medium text-slate-400">
        
        {/* Left Side: Copyright */}
        <p>© 2026 AT Tester. All rights reserved.</p>
        
        {/* Right Side: Developed By */}
        <p>
          Developed by{" "}
          <a 
            href="#" 
            className="text-slate-700 font-bold hover:text-orange-500 transition-colors"
          >
            MNR Technologies
          </a>
        </p>

      </div>
    </footer>
  );
};

export default Footer;