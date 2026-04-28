import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const DashboardCard = ({ title, desc, link, icon }) => (
  <motion.div
    whileHover={{ y: -4 }}
    className="bg-white p-6 cursor-pointer rounded-2xl shadow-sm border border-slate-100 transition-all hover:border-orange-200 hover:shadow-md group relative overflow-hidden"
  >
    <div className="absolute right-0 bottom-0 opacity-[0.03] transform translate-x-4 translate-y-4 text-slate-900 group-hover:text-orange-500 transition-colors duration-300">
      {React.cloneElement(icon, { size: 100 })}
    </div>
    
    <Link to={link} className="block h-full relative z-10">
      <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-6 border border-orange-100">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-orange-600 transition-colors">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </Link>
  </motion.div>
);

export default DashboardCard;