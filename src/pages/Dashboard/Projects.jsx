import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { 
  FolderKanban, 
  Hash, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  ChevronDown,
  Loader2,
  Globe,
  Search,
  X,
  Link,
  Copy
} from 'lucide-react';

import { fetchUserSessions } from '../../services/operations/projectAPI'; 

const Projects = () => {
  const dispatch = useDispatch();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await dispatch(fetchUserSessions());
      if (data) {
        setSessions(data);
      }
      setLoading(false);
    };
    
    loadData();
  }, [dispatch]);

  const handleDownload = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      console.error("No download URL available for this sheet.");
    }
  };

  // --- NEW: Handle Copy to Clipboard ---
  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.parent_session
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (dateFilter) {
      const sessionDate = new Date(session.created_at).toISOString().split('T')[0];
      matchesDate = sessionDate === dateFilter;
    }

    return matchesSearch && matchesDate;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("");
  };

  return (
    <div className="min-h-screen bg-[#ffffff] p-8 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#0c1e5b]/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#0c1e5b]/5 rounded-xl border border-[#0c1e5b]/10">
              <FolderKanban className="w-9 h-9 text-[#0c1e5b]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold text-[#0c1e5b] tracking-tight">
                Project Workspace
              </h1>
              <p className="text-[#0c1e5b]/70 text-lg mt-1.5">
                Centralized view of your active and completed testing sessions.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[#0c1e5b]/60 font-semibold hidden sm:inline-block">
              Total Sessions: {sessions.length}
            </span>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-colors border ${
                showFilters || searchQuery || dateFilter 
                  ? 'bg-[#f97316] text-white border-[#f97316] hover:bg-[#f97316]/90' 
                  : 'bg-white text-[#0c1e5b] border-[#0c1e5b]/20 hover:border-[#0c1e5b]/40'
              }`}
            >
              Filter Data
              <ChevronDown size={18} className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* INLINE FILTER BAR */}
        {showFilters && (
          <div className="bg-[#0c1e5b]/5 p-5 rounded-2xl border border-[#0c1e5b]/10 flex flex-col md:flex-row gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="relative w-full md:w-1/2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0c1e5b]/40 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by Session ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#0c1e5b]/20 bg-white focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] text-[#0c1e5b] placeholder-[#0c1e5b]/40 transition-all shadow-sm"
              />
            </div>
            
            <div className="w-full md:w-auto relative flex-grow max-w-sm">
               <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#0c1e5b]/20 bg-white focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] text-[#0c1e5b] transition-all shadow-sm cursor-pointer"
              />
            </div>
            
            {(searchQuery || dateFilter) && (
              <button
                onClick={clearFilters}
                className="text-[#f97316] hover:text-[#f97316]/80 text-sm font-bold whitespace-nowrap flex items-center gap-1.5 px-2"
              >
                <X className="w-4 h-4" strokeWidth={3} /> Clear
              </button>
            )}
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-[#f97316] animate-spin mb-4" />
            <p className="text-[#0c1e5b] font-semibold">Loading your workspace...</p>
          </div>
        )}

        {/* NO DATA STATE */}
        {!loading && sessions.length === 0 && (
          <div className="bg-[#0c1e5b]/5 border border-[#0c1e5b]/10 rounded-3xl p-12 text-center">
             <FolderKanban className="w-16 h-16 text-[#0c1e5b]/40 mx-auto mb-4" />
             <h2 className="text-2xl font-bold text-[#0c1e5b]">No Sessions Found</h2>
             <p className="text-[#0c1e5b]/60 mt-2">You haven't run any automation tests yet.</p>
          </div>
        )}

        {/* NO RESULTS STATE */}
        {!loading && sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="bg-white border border-[#f97316]/20 rounded-3xl p-12 text-center shadow-sm">
             <Search className="w-12 h-12 text-[#f97316]/40 mx-auto mb-4" />
             <h2 className="text-xl font-bold text-[#0c1e5b]">No matches found</h2>
             <p className="text-[#0c1e5b]/60 mt-2 mb-6">Try adjusting your Session ID or Date filter.</p>
             <button onClick={clearFilters} className="bg-[#0c1e5b]/5 text-[#0c1e5b] px-4 py-2 rounded-lg font-semibold hover:bg-[#0c1e5b]/10 transition-colors">
               Clear Filters
             </button>
          </div>
        )}

        {/* FILTERED SESSIONS LIST */}
        {!loading && filteredSessions.map((session) => {
          
          const formattedDate = new Date(session.created_at).toLocaleString('en-US', {
            dateStyle: 'long',
            timeStyle: 'medium'
          });

          return (
            <div key={session._id} className="bg-white rounded-3xl shadow-lg border border-[#0c1e5b]/10 overflow-hidden mb-8 transition-all hover:border-[#0c1e5b]/20">
              
              {/* SESSION HEADER & STATUS */}
              <div className="p-7 border-b border-[#0c1e5b]/10 bg-[#0c1e5b]/5 flex items-center justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white border border-[#0c1e5b]/20 rounded-xl flex items-center justify-center shadow-inner">
                    <Hash size={20} className="text-[#0c1e5b]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#0c1e5b]/60 uppercase tracking-wider">
                      Session ID
                    </span>
                    <p className="text-2xl font-bold text-[#0c1e5b]">
                      {session.parent_session}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <span className="text-sm font-medium text-[#0c1e5b]/60">Execution Date</span>
                      <p className="font-semibold text-[#0c1e5b] flex items-center gap-1.5 mt-0.5">
                        <Calendar size={16} className="text-[#0c1e5b]/40" />
                        {formattedDate}
                      </p>
                    </div>
                    
                    <span className="bg-[#f97316] text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-inner">
                      Completed
                    </span>
                </div>
              </div>

              {/* GENERATED REPORTS SECTION */}
              <div className="p-8 md:p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-white border border-[#0c1e5b]/10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <FileSpreadsheet className="w-7 h-7 text-[#f97316]" strokeWidth={1} />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-[#0c1e5b]">
                      Generated Automation Reports
                    </h3>
                    <p className="text-[#0c1e5b]/60 mt-0.5 text-sm md:text-base">
                      Securely access and download {session.excel_sheet_ids.length} detailed Excel sheets from this session.
                    </p>
                  </div>
                </div>

                {/* DOWNLOAD GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {session.excel_sheet_ids.map((sheet, index) => (
                    <div 
                      key={sheet._id || index}
                      className="bg-white p-6 rounded-2xl border border-[#0c1e5b]/10 shadow-sm hover:border-[#f97316]/50 hover:shadow-md transition-all flex flex-col justify-between gap-5 group relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        {/* URL Details Section */}
                        <div className="space-y-4 overflow-hidden pr-2 flex-1">
                            
                            {/* Target Website */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-[#0c1e5b]/50 uppercase tracking-widest flex items-center gap-1">
                                    <Globe size={12} /> Target Website
                                </span>
                                <button 
                                  onClick={() => handleCopy(sheet.target_website, "Target Website")} 
                                  className="text-[#0c1e5b]/30 hover:text-[#f97316] transition-colors p-1" 
                                  title="Copy Target Website URL"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                              <p className="text-sm font-semibold text-[#0c1e5b] truncate" title={sheet.target_website}>
                                {sheet.target_website}
                              </p>
                            </div>

                            {/* Tested Page URL */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-[#f97316] uppercase tracking-widest flex items-center gap-1">
                                    <Link size={12} /> Page Tested
                                </span>
                                <button 
                                  onClick={() => handleCopy(sheet.page_url, "Page Tested URL")} 
                                  className="text-[#0c1e5b]/30 hover:text-[#f97316] transition-colors p-1" 
                                  title="Copy Page Tested URL"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                              <p 
                                className="text-sm font-extrabold text-[#0c1e5b] group-hover:text-[#f97316] break-all line-clamp-2 transition-colors" 
                                title={sheet.page_url}
                              >
                                {sheet.page_url || "N/A"}
                              </p>
                            </div>

                        </div>
                        <FileSpreadsheet size={24} className="text-[#0c1e5b]/20 group-hover:text-[#f97316] transition-colors flex-shrink-0 mt-1" />
                      </div>
                      
                      <button 
                        onClick={() => handleDownload(sheet.s3_download_url)}
                        className="w-full flex items-center justify-center gap-2.5 bg-[#0c1e5b]/5 text-[#0c1e5b] hover:bg-[#f97316] hover:text-white border border-[#0c1e5b]/10 hover:border-transparent px-5 py-3 rounded-xl text-md font-bold transition-all mt-auto"
                      >
                        <Download size={18} />
                        Download Data
                      </button>
                    </div>
                  ))}
                </div>
                
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Projects;