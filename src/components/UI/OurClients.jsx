"use client";
import { useEffect, useRef } from "react";
// Replace this with the actual path to your logo
import clientLogo from "../../assets/advanto.png";

export default function OurClients() {
  const sectionRef = useRef(null);

  /* Animate on scroll (Matching ContactPage) */
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("opacity-100", "translate-y-0");
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  return (

    <main id="our clients" className="bg-white">
      
      {/* HERO SECTION */}
      <section className="pt-24 pb-16 text-center px-6 bg-gradient-to-b from-orange-50/50 to-white">
        <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-slate-900">
          Our <span className="text-orange-500">Clients</span>
        </h2>
        <p className="max-w-2xl mx-auto text-lg text-slate-500 leading-relaxed">
          We are proud to partner with industry-leading organizations that trust 
          MNR AT to deliver technology excellence and innovative solutions.
        </p>
      </section>

      {/* CLIENTS GRID SECTION */}
      <section
        ref={sectionRef}
        className="pb-24 px-6 opacity-0 translate-y-10 transition-all duration-700"
      >
        <div className="max-w-6xl mx-auto">
          
          <div className="flex justify-center items-center mt-4">
            {/* 
              SINGLE CLIENT CARD
              - Uses slate-900 to support the white text in the Advent Global logo.
              - Uses rounded-3xl and similar hover states/shadows from the Contact Form.
            */}
            <div className="group flex items-center justify-center w-[320px] h-[160px] bg-slate-900 rounded-3xl p-10 border border-slate-800 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:shadow-orange-500/20 hover:-translate-y-1 hover:border-orange-500/50 cursor-pointer">
              <img
                src={clientLogo}
                alt="Advent Global Solutions Inc."
                className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>
          
        </div>
      </section>
      
    </main>
  );
}