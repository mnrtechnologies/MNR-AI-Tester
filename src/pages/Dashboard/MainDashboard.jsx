import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import axios from "axios";
import "react-calendar/dist/Calendar.css";
import {
  Users,
  CheckCircle2,
  LayoutGrid,
  Network,
  BarChart3,
  PieChart,
  History,
  Key,
  Trash2,
  Edit3,
  ArrowRight,
} from "lucide-react";

const AUTH_BASE = process.env.REACT_APP_AUTH_URL || "http://localhost:4000/api";

const MainDashboard = () => {
  const [date, setDate] = useState(new Date());
  const [onboardedCount, setOnboardedCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [projectUrl, setProjectUrl] = useState("");

  const [organizations, setOrganizations] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        console.warn("No token yet, skipping API call");
        return;
      }

      try {
        const response = await axios.get(`${AUTH_BASE}/auth/get-all-users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const users =
          response.data?.users ||
          response.data?.data?.users ||
          response.data?.data ||
          response.data ||
          [];

        setUsers(Array.isArray(users) ? users : []);
        setOnboardedCount(Array.isArray(users) ? users.length : 0);
      } catch (err) {
        console.error("Failed to fetch onboarded users", err);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const storedTarget =
      localStorage.getItem("targetUrl") || sessionStorage.getItem("targetUrl");

    if (storedTarget) {
      setProjectUrl(storedTarget);

      // axios.get("/organizations")
      setProjects([{ url: storedTarget }]);
    }
    // axios.get("/projects")
    setOrganizations([{ name: "MNR Technologies Pvt. Ltd." }]);
  }, []);

  // const projects = JSON.parse(localStorage.getItem("projects")) || [];
  // setProjectCount(projects.length);

  const topStats = [
    {
      key: "users",
      label: "On Boarded Users",
      value: onboardedCount,
      color: "bg-orange-500",
      icon: <Users size={16} />,
    },
    {
      key: "projects",
      label: "Projects",
      value: projects.length,
      color: "bg-orange-300",
      icon: <LayoutGrid size={16} />,
    },
    {
      key: "orgs",
      label: "Organizations",
      value: organizations.length,
      color: "bg-orange-200",
      icon: <Network size={16} />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* --- TOP METRIC CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {topStats.map((stat, i) => (
          <div
            key={i}
            onMouseEnter={() => stat.key && setHoveredCard(stat.key)}
            onMouseLeave={() => setHoveredCard(null)}
            className="relative bg-white p-4 rounded-xl shadow-sm border border-orange-100 flex justify-between items-center"
          >
            <div>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            </div>

            <div className={`p-2 rounded-lg text-white ${stat.color}`}>
              {stat.icon}
            </div>

            {/* USERS HOVER */}
            {hoveredCard === stat.key && stat.key === "users" && (
              <div className="absolute top-full left-0 mt-2 w-60 max-h-64 overflow-y-auto bg-white border border-orange-100 rounded-lg shadow-lg p-3 z-50">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Onboarded Users
                </p>

                {users.length === 0 ? (
                  <p className="text-xs text-slate-400">No users found</p>
                ) : (
                  users.map((user, idx) => (
                    <div
                      key={idx}
                      className="py-1 border-b last:border-none flex flex-col"
                    >
                      <span className="text-xs text-slate-800 font-medium">
                        {user.name || "Unnamed"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {user.email}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* PROJECTS HOVER */}
            {hoveredCard === stat.key && stat.key === "projects" && (
              <div className="absolute top-full left-0 mt-2 w-60 bg-white border border-orange-100 rounded-lg shadow-lg p-3 z-50">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Project URL
                </p>

                <span className="text-[11px] text-slate-800 break-all">
                  {projects.map((p, i) => (
                    <span
                      key={i}
                      className="text-[11px] text-slate-800 break-all block"
                    >
                      {p.url}
                    </span>
                  ))}
                </span>
              </div>
            )}

            {/* ORGANIZATION HOVER */}
            {hoveredCard === stat.key && stat.key === "orgs" && (
              <div className="absolute top-full left-0 mt-2 w-60 bg-white border border-orange-100 rounded-lg shadow-lg p-3 z-50">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Organization
                </p>

                <span className="text-xs text-slate-800 font-medium">
                  {organizations.map((org, i) => (
                    <span
                      key={i}
                      className="text-xs text-slate-800 font-medium block"
                    >
                      {org.name}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* --- BANNER HERO SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-8 border border-orange-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="z-10 max-w-md">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Built by MNR Technologies Global Pvt. Ltd.
            </p>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              <span className="font-bold text-blue-900 text-2xl">MNR</span>{" "}
              <span className="font-bold text-orange-500 text-3xl">AT</span>{" "}
              Dashboard
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Crafted with precision and innovation, this solution is brought to
              you by MNR Technologies Global Pvt. Ltd.
            </p>
          </div>

          <div className="w-32 h-32 bg-orange-50 rounded-2xl flex items-center justify-center p-4">
            <div className="text-orange-600 font-black text-xl italic tracking-tighter">
              MNR<span className="text-orange-400 text-2xl ">AT</span>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden group shadow-lg">
          <img
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80"
            alt="Autopilot"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
            <h3 className="text-xl font-bold text-white mb-2">
              MNR AT Autopilot
            </h3>

            <button className="flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-white/30 transition-all w-fit">
              Explore Auto Pilot <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* --- CHARTS SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DynamicMonthlyChart />
        <DynamicTraffic />
      </div>

      {/* --- CALENDAR & LOGS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-orange-400 rounded-2xl p-4 text-white shadow-lg custom-calendar-container">
          <Calendar
            onChange={setDate}
            value={date}
            className="border-none bg-transparent text-white w-full"
            next2Label={null}
            prev2Label={null}
          />
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
          <h3 className="font-medium text-slate-700 mb-6 border-b pb-4">
            📚 Activity Log
          </h3>

          <div className="space-y-6">
            <ActivityItem
              bg="bg-orange-500"
              icon={<Key size={14} />}
              title="Super Admin logged in"
              time="03:30 PM"
            />

            <ActivityItem
              bg="bg-orange-400"
              icon={<Edit3 size={14} />}
              title="Updated user permissions"
              time="08:00 PM"
            />

            <ActivityItem
              bg="bg-red-500"
              icon={<Trash2 size={14} />}
              title="Deleted account"
              time="02:45 PM"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
const ActivityItem = ({ icon, bg, title, time }) => (
  <div className="flex items-start gap-4">
    <div
      className={`p-2 rounded-full ${bg} text-white shrink-0 flex items-center justify-center`}
    >
      {icon}
    </div>
    <div className="flex-1">
      <h4 className="text-sm font-medium text-slate-800">{title}</h4>
      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
        <History size={10} /> {time}
      </p>
    </div>
  </div>
);

const DynamicMonthlyChart = () => {
  const [data, setData] = useState([
    { coverage: 48, defects: 22, saved: 30 },
    { coverage: 55, defects: 30, saved: 42 },
    { coverage: 62, defects: 35, saved: 50 },
    { coverage: 71, defects: 44, saved: 60 },
    { coverage: 78, defects: 52, saved: 68 },
    { coverage: 86, defects: 63, saved: 78 },
    { coverage: 92, defects: 70, saved: 90 },
    { coverage: 97, defects: 85, saved: 100 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) =>
        prev.map((m) => ({
          coverage: Math.min(
            98,
            Math.max(45, m.coverage + (Math.random() * 3 - 1.5)),
          ),
          defects: Math.max(
            15,
            Math.min(90, m.defects + (Math.random() * 6 - 3)),
          ),
          saved: Math.min(
            95,
            Math.max(25, m.saved + (Math.random() * 3 - 1.5)),
          ),
        })),
      );
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl p-6 text-white shadow-xl">
      <h3 className="flex items-center gap-2 font-medium mb-6 text-sm">
        <BarChart3 size={18} className="text-orange-400" />
        Autopilot AI Coverage • Defects Detected • Time Saved
      </h3>

      <div className="relative h-56">
        <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-600">
          {[100, 75, 50, 25, 0].map((v, i) => (
            <div key={i} className="border-t border-slate-700/40" />
          ))}
        </div>

        <div className="h-full flex items-end justify-between gap-6 px-2 relative overflow-x-auto">
          {data.map((month, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 min-w-[70px]"
            >
              <div className="flex gap-2 items-end w-full justify-center h-40">
                <div className="flex flex-col items-center justify-end h-full">
                  <div
                    className="w-4 bg-emerald-500 rounded-md transition-all duration-700"
                    style={{ height: `${month.coverage}%` }}
                  />
                  <span className="text-[9px] text-emerald-400 mt-1">
                    {Math.round(month.coverage)}%
                  </span>
                </div>

                <div className="flex flex-col items-center justify-end h-full">
                  <div
                    className="w-4 bg-orange-500 rounded-md transition-all duration-700"
                    style={{ height: `${month.defects}%` }}
                  />
                  <span className="text-[9px] text-orange-300 mt-1">
                    {Math.round(month.defects)}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-end h-full">
                  <div
                    className="w-4 bg-blue-400 rounded-md transition-all duration-700"
                    style={{ height: `${month.saved}%` }}
                  />
                  <span className="text-[9px] text-blue-300 mt-1">
                    {Math.round(month.saved)}%
                  </span>
                </div>
              </div>

              <span className="text-[10px] text-slate-400 font-bold mt-2">
                {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG"][i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-6 mt-5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-emerald-500 rounded-sm" />
          AI Coverage
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-orange-500 rounded-sm" />
          Defects Detected
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-400 rounded-sm" />
          Time Saved
        </div>
      </div>
    </div>
  );
};

const DynamicTraffic = () => {
  const [traffic, setTraffic] = useState({
    organic: 46,
    direct: 32,
    referral: 14,
    paid: 8,
  });

  const total =
    traffic.organic + traffic.direct + traffic.referral + traffic.paid;

  const organic = (traffic.organic / total) * 100;
  const direct = (traffic.direct / total) * 100;
  const referral = (traffic.referral / total) * 100;

  useEffect(() => {
    const interval = setInterval(() => {
      setTraffic({
        organic: 40 + Math.floor(Math.random() * 20),
        direct: 25 + Math.floor(Math.random() * 15),
        referral: 10 + Math.floor(Math.random() * 10),
        paid: 5 + Math.floor(Math.random() * 10),
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 flex flex-col items-center">
      <div className="w-full mb-6 flex items-center gap-2">
        <PieChart size={18} className="text-orange-500" />
        <h3 className="font-semibold text-slate-700 text-sm">
          Automation Traffic Sources
        </h3>
      </div>

      <div className="relative w-44 h-44">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-slate-100"
            strokeWidth="4"
          />

          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-orange-600 transition-all duration-700"
            strokeWidth="4"
            strokeDasharray={`${organic} 100`}
          />

          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-orange-400 transition-all duration-700"
            strokeWidth="4"
            strokeDasharray={`${direct} 100`}
            strokeDashoffset={-organic}
          />

          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-orange-200 transition-all duration-700"
            strokeWidth="4"
            strokeDasharray={`${referral} 100`}
            strokeDashoffset={-(organic + direct)}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-bold text-slate-800">
            {organic.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-400">Organic</p>
        </div>
      </div>

      <div className="mt-5 text-xs text-slate-500 space-y-1">
        <p>Organic • Direct • Referral • Paid</p>
      </div>
    </div>
  );
};

export default MainDashboard;
