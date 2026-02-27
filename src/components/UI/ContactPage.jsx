"use client";
import { useState, useEffect, useRef } from "react";
import { Send, MapPin, Phone, Mail } from "lucide-react";

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

  /*  Animate on scroll */
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

    if (formData.service === "Select a service") {
      errors.service = "Please select a service";
    }

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
    <main className="pt-20">
      {/*  HERO */}
      <section className="bg-gradient-to-br from-[#0c1e5b] to-[#1a2a5e] py-24 text-center text-white px-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact Us</h1>
        <p className="max-w-2xl mx-auto text-lg text-gray-200">
          We'd love to hear from you. Reach out to discuss how we can help with
          your technology needs.
        </p>
      </section>

      {/*  CONTACT */}
      <section
        ref={sectionRef}
        className="py-20 px-6 opacity-0 translate-y-10 transition-all duration-700"
      >
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10">
          {/* LEFT INFO */}
          <div className="bg-[#0c1e5b] rounded-xl p-8 text-white">
            <h3 className="text-2xl font-semibold mb-4">Contact Information</h3>
            <p className="text-gray-200 mb-8">
              Reach out to us for a consultation or to learn more about our
              services.
            </p>

            <div className="space-y-6">
              <div className="flex gap-4">
                <MapPin className="text-teal-400" />
                <div>
                  <h4 className="font-semibold">Our Location</h4>
                  <p className="text-gray-200 text-sm">
                    WeWork - Krishe Emerald, Ground Floor, Laxmi Cyber City,
                    HITECH City, Hyderabad, Telangana - 500082
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Phone className="text-teal-400" />
                <div>
                  <h4 className="font-semibold">Phone</h4>
                  <p className="text-gray-200 text-sm">+91 73299 99968</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Mail className="text-teal-400" />
                <div>
                  <h4 className="font-semibold">Email</h4>
                  <p className="text-gray-200 text-sm">
                    info@mnrtechnologies.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT FORM */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <h3 className="text-2xl font-semibold mb-6">Send Us a Message</h3>

            {submitSuccess && (
              <div className="bg-teal-50 border border-teal-300 text-teal-600 p-3 rounded mb-6">
                Thank you! We'll get back to you shortly.
              </div>
            )}

            <div className="space-y-5">
              <input
                name="name"
                placeholder="Full Name*"
                value={formData.name}
                onChange={handleChange}
                className="w-full border p-3 rounded focus:ring-2 focus:ring-teal-400"
              />
              {formErrors.name && (
                <p className="text-red-500 text-sm">{formErrors.name}</p>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  name="email"
                  placeholder="Email*"
                  value={formData.email}
                  onChange={handleChange}
                  className="border p-3 rounded focus:ring-2 focus:ring-teal-400"
                />

                <input
                  name="phone"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="border p-3 rounded focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <input
                name="company"
                placeholder="Company"
                value={formData.company}
                onChange={handleChange}
                className="w-full border p-3 rounded focus:ring-2 focus:ring-teal-400"
              />

              {/* <select
                name="service"
                value={formData.service}
                onChange={handleChange}
                className="w-full border p-3 rounded focus:ring-2 focus:ring-teal-400"
              >
                <option disabled>Select a service</option>
                <option>Healthcare</option>
                <option>Banking</option>
                <option>AI</option>
                <option>Cloud</option>
                <option>Cybersecurity</option>
                <option>Other</option>
              </select> */}

              <textarea
                name="message"
                rows="4"
                placeholder="Message*"
                value={formData.message}
                onChange={handleChange}
                className="w-full border p-3 rounded focus:ring-2 focus:ring-teal-400"
              />

              <button
                disabled={isSubmitting}
                className="bg-gradient-to-r from-teal-400 to-blue-500 text-white px-6 py-3 rounded flex items-center gap-2 hover:scale-105 transition"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/*  OFFICES */}
      <section className="bg-gray-100 py-24 px-6 text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-16">
          Our Global Offices
        </h2>

        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
          {/* Headquarters */}
          <div className="bg-white rounded-2xl shadow-sm px-10 py-12 hover:-translate-y-2 transition duration-300">
            <h3 className="font-semibold text-2xl text-gray-800 mb-6">
              Headquarters
            </h3>

            <div className="text-gray-600 leading-8 space-y-4">
              <p>
                WeWork - Krishe Emerald Ground Floor <br />
                Laxmi Cyber City Whitefields, HITECH City <br />
                Hyderabad, Telangana 500082
              </p>

              <p>Phone: +91 73299 99968</p>
              <p>Email: info@mnrtechnologies.com</p>
            </div>
          </div>

          {/* USA */}
          <div className="bg-white rounded-2xl shadow-sm px-10 py-12 hover:-translate-y-2 transition duration-300">
            <h3 className="font-semibold text-2xl text-gray-800 mb-6">USA</h3>

            <div className="text-gray-600 leading-8 space-y-4">
              <p>
                Phoenix, AZ, <br />
                USA
              </p>

              <p>Phone: +1 (860) 595-6756</p>
              <p>Email: us@mnrtechnologies.com</p>
            </div>
          </div>

          {/* Asia Pacific */}
          <div className="bg-white rounded-2xl shadow-sm px-10 py-12 hover:-translate-y-2 transition duration-300">
            <h3 className="font-semibold text-2xl text-gray-800 mb-6">
              Asia Pacific
            </h3>

            <div className="text-gray-600 leading-8 space-y-4">
              <p>
                88 Innovation Tower, Level 21 <br />
                Singapore 018956
              </p>

              <p>Phone: +65 6123 4567</p>
              <p>Email: apac@mnrtechnologies.com</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
