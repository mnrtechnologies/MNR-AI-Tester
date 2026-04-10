"use client";
import { useState, useEffect, useRef } from "react";
import { Send, MapPin, Phone, Mail, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    service: "Select a service",
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const sectionRef = useRef(null);

  /* Animate on scroll */
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("opacity-100", "translate-y-0");
        }
      },
      { threshold: 0.1 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = "Name is required";

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Email is invalid";
    }

    if (!formData.message.trim()) errors.message = "Message is required";

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length === 0) {
      setIsSubmitting(true);

      try {
        const response = await fetch("https://usebasin.com/f/4e0fba56e576", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          setSubmitSuccess(true);
          setFormData({
            name: "",
            email: "",
            phone: "",
            company: "",
            message: "",
            service: "Select a service",
          });
        }
      } catch (err) {
        console.error("Submit error", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <main className="pt-20 bg-white">
      {/* HERO */}
      <section className="py-24 text-center px-6 bg-gradient-to-b from-orange-50/50 to-white">
        <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-slate-900">
          Contact <span className="text-orange-500">Us</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-slate-500 leading-relaxed">
          We'd love to hear from you. Reach out to discuss how we can help with
          your technology needs.
        </p>
      </section>

      {/* CONTACT */}
      <section
        ref={sectionRef}
        className="pb-24 px-6 opacity-0 translate-y-10 transition-all duration-700"
      >
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-stretch">
          
          {/* LEFT INFO */}
          <div className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-100 flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-4 tracking-tight text-slate-900">Contact Information</h3>
            <p className="text-slate-500 mb-10 leading-relaxed">
              Reach out to us for a consultation or to learn more about our
              services. Our team is ready to assist you.
            </p>

            <div className="space-y-8">
              <div className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                  <MapPin className="text-orange-500" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Our Location</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    WeWork - Krishe Emerald, Ground Floor, Laxmi Cyber City,
                    HITECH City, Hyderabad, Telangana - 500082
                  </p>
                </div>
              </div>

              <div className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                  <Phone className="text-orange-500" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Phone</h4>
                  <p className="text-slate-500 text-sm">+91 73299 99968</p>
                </div>
              </div>

              <div className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                  <Mail className="text-orange-500" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Email</h4>
                  <p className="text-slate-500 text-sm">
                    info@mnrtechnologies.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT FORM */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 p-8 lg:p-12"
          >
            <h3 className="text-2xl font-bold mb-8 text-slate-900 tracking-tight">Send Us a Message</h3>

            {submitSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl mb-8 font-medium flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                Thank you! We'll get back to you shortly.
              </div>
            )}

            <div className="space-y-5">
              <div>
                <input
                  name="name"
                  placeholder="Full Name*"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-slate-900"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-sm mt-2 font-medium">{formErrors.name}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <input
                    name="email"
                    placeholder="Email*"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-slate-900"
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-sm mt-2 font-medium">{formErrors.email}</p>
                  )}
                </div>

                <input
                  name="phone"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-slate-900"
                />
              </div>

              <input
                name="company"
                placeholder="Company"
                value={formData.company}
                onChange={handleChange}
                className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-slate-900"
              />

              <div>
                <textarea
                  name="message"
                  rows="4"
                  placeholder="Message*"
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all resize-none text-slate-900"
                />
                {formErrors.message && (
                  <p className="text-red-500 text-sm mt-2 font-medium">{formErrors.message}</p>
                )}
              </div>

              <button
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all w-full font-bold tracking-wide mt-4"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      </section>

    </main>
  );
}