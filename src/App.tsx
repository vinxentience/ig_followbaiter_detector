/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { 
  Upload, 
  Users, 
  UserMinus, 
  UserCheck, 
  Search, 
  HelpCircle,
  Download, 
  Copy, 
  RefreshCw, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileJson,
  AlertCircle,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InstagramProfile, Statistics } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'results' | 'followers' | 'following' | 'fans'>('results');
  const [followers, setFollowers] = useState<InstagramProfile[]>([]);
  const [following, setFollowing] = useState<InstagramProfile[]>([]);
  const [results, setResults] = useState<InstagramProfile[]>([]);
  const [visitedUsernames, setVisitedUsernames] = useState<Set<string>>(new Set());
  const [isComparing, setIsComparing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search states
  const [searchFollowers, setSearchFollowers] = useState('');
  const [searchFollowing, setSearchFollowing] = useState('');
  const [searchResults, setSearchResults] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Sort states
  const [sortField, setSortField] = useState<'username' | 'timestamp' | null>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const followersInputRef = useRef<HTMLInputElement>(null);
  const followingInputRef = useRef<HTMLInputElement>(null);

  // Robust parsing: search for objects with specified keys, handling Instagram's nested structures
  const findInData = (data: any, usernameKey: string, hrefKey: string): InstagramProfile[] => {
    const results: InstagramProfile[] = [];
    const seen = new Set<string>();

    const sanitizeLink = (url: string) => url.replace('instagram.com/_u/', 'instagram.com/');

    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      // Pattern 1: Keys are in the same object (Standard for most followers)
      if (node[usernameKey] && node[hrefKey]) {
        const username = String(node[usernameKey]);
        const profileLink = sanitizeLink(String(node[hrefKey]));
        const timestamp = node.timestamp || (node.string_list_data?.[0]?.timestamp);
        if (username && !seen.has(username)) {
          results.push({ username, profileLink, timestamp });
          seen.add(username);
        }
      } 
      // Pattern 2: Username is in parent, link is in nested 'string_list_data' (Standard for following)
      else if (node[usernameKey] && Array.isArray(node.string_list_data)) {
        const listData = node.string_list_data;
        for (const entry of listData) {
          if (entry && entry[hrefKey]) {
            const username = String(node[usernameKey]);
            const profileLink = sanitizeLink(String(entry[hrefKey]));
            const timestamp = entry.timestamp;
            if (username && !seen.has(username)) {
              results.push({ username, profileLink, timestamp });
              seen.add(username);
            }
          }
        }
      }
      // Pattern 3: Both username and link are inside 'string_list_data' elements (Alternate followers format)
      else if (Array.isArray(node.string_list_data)) {
        const listData = node.string_list_data;
        for (const entry of listData) {
          if (entry && entry[usernameKey] && entry[hrefKey]) {
            const username = String(entry[usernameKey]);
            const profileLink = sanitizeLink(String(entry[hrefKey]));
            const timestamp = entry.timestamp;
            if (username && !seen.has(username)) {
              results.push({ username, profileLink, timestamp });
              seen.add(username);
            }
          }
        }
      }

      if (Array.isArray(node)) {
        node.forEach(traverse);
      } else {
        Object.values(node).forEach(traverse);
      }
    };

    traverse(data);
    return results;
  };

  const handleFileUpload = (type: 'followers' | 'following', file: File) => {
    setError(null);
    if (!file.name.endsWith('.json')) {
      setError('Please upload a valid JSON file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const parsed = type === 'followers' 
          ? findInData(json, 'value', 'href') 
          : findInData(json, 'title', 'href');

        if (parsed.length === 0) {
          setError(`No valid ${type} data found. Please check your Instagram JSON export.`);
          return;
        }

        if (type === 'followers') setFollowers(parsed);
        else setFollowing(parsed);
      } catch (err) {
        setError('Failed to parse JSON file.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const findNonFollowBacks = () => {
    setIsComparing(true);
    // Give a tiny delay for animation feel
    setTimeout(() => {
      const followersSet = new Set(followers.map(f => f.username.toLowerCase()));
      const nonFollowBacks = following.filter(f => !followersSet.has(f.username.toLowerCase()));
      setResults(nonFollowBacks);
      setIsComparing(false);
      // Scroll to results
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 600);
  };

  const resetAll = () => {
    setFollowers([]);
    setFollowing([]);
    setResults([]);
    setVisitedUsernames(new Set());
    setError(null);
    setSearchFollowers('');
    setSearchFollowing('');
    setSearchResults('');
    setCurrentPage(1);
  };

  const handleVisit = (username: string) => {
    setVisitedUsernames(prev => {
      const next = new Set(prev);
      next.add(username);
      return next;
    });
  };

  const stats: Statistics = {
    followersCount: followers.length,
    followingCount: following.length,
    notFollowingBackCount: results.length
  };

  const fansResults = useMemo(() => {
    const followingSet = new Set(following.map(f => f.username.toLowerCase()));
    return followers.filter(f => !followingSet.has(f.username.toLowerCase()));
  }, [followers, following]);

  const fansOnlyCount = fansResults.length;

  const filteredFollowers = useMemo(() => 
    followers.filter(f => f.username.toLowerCase().includes(searchFollowers.toLowerCase())),
    [followers, searchFollowers]
  );

  const filteredFollowing = useMemo(() => 
    following.filter(f => f.username.toLowerCase().includes(searchFollowing.toLowerCase())),
    [following, searchFollowing]
  );

  const filteredResults = useMemo(() => {
    return [...results].filter(f => f.username.toLowerCase().includes(searchResults.toLowerCase()));
  }, [results, searchResults]);

  // Derived data based on current tab and page
  const paginatedData = useMemo(() => {
    let rawData: InstagramProfile[] = [];
    if (activeTab === 'results') rawData = filteredResults;
    else if (activeTab === 'following') rawData = filteredFollowing;
    else if (activeTab === 'followers') rawData = filteredFollowers;
    else if (activeTab === 'fans') rawData = fansResults;

    let data = [...rawData];
    if (sortField) {
      data.sort((a, b) => {
        if (sortField === 'username') {
          const valA = a.username.toLowerCase();
          const valB = b.username.toLowerCase();
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          const valA = a.timestamp || 0;
          const valB = b.timestamp || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
      });
    }

    const start = (currentPage - 1) * itemsPerPage;
    return {
      currentItems: data.slice(start, start + itemsPerPage),
      totalItems: data.length,
      totalPages: Math.ceil(data.length / itemsPerPage)
    };
  }, [activeTab, filteredResults, filteredFollowing, filteredFollowers, fansResults, currentPage, itemsPerPage, sortField, sortDirection]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const toggleSort = (field: 'username' | 'timestamp') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const exportCSV = () => {
    const headers = ['Username', 'Profile Link'];
    const rows = results.map(r => [r.username, r.profileLink]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "not_following_back.csv");
    link.click();
  };

  const exportTXT = () => {
    const textContent = results.map(r => r.username).join("\n");
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "not_following_back.txt");
    link.click();
  };

  const copyUsernames = () => {
    const text = results.map(r => r.username).join(", ");
    navigator.clipboard.writeText(text);
    // Visual feedback could be added here
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-8 flex-1 flex flex-col">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Instagram Checker
              </h1>
            </div>
            <p className="text-slate-500 text-sm">Cross-reference follower JSON files locally and securely.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setShowInstructions(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium flex items-center gap-2 transition-all text-slate-300"
            >
              <HelpCircle className="w-4 h-4" />
              How to get JSON?
            </button>
            <button 
              onClick={resetAll}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium flex items-center gap-2 transition-all text-slate-300"
            >
              <Trash2 className="w-4 h-4" />
              Clear Data
            </button>
            <button 
              onClick={findNonFollowBacks}
              disabled={followers.length === 0 || following.length === 0 || isComparing}
              className={`
                px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2
                ${followers.length === 0 || following.length === 0 || isComparing
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-purple-500/20 active:scale-95'}
              `}
            >
              {isComparing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isComparing ? 'Comparing...' : 'Import Data'}
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatCard 
            title="Followers" 
            value={stats.followersCount} 
            subtitle="JSON LOADED"
            color="white"
          />
          <StatCard 
            title="Following" 
            value={stats.followingCount} 
            subtitle="JSON LOADED"
            color="white"
          />
          <StatCard 
            title="Not Following Back" 
            value={stats.notFollowingBackCount} 
            subtitle="DETECTED"
            color="purple"
            highlight
          />
          <StatCard 
            title="Fans Only" 
            value={fansOnlyCount} 
            subtitle="VIEW LIST"
            color="blue"
            onClick={() => handleTabChange('fans')}
          />
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[600px]">
          
          {/* Sidebar: Uploads */}
          <aside className="md:col-span-3 flex flex-col gap-6">
            <UploadArea 
              onFileSelect={(file) => handleFileUpload('followers', file)} 
              isLoaded={followers.length > 0}
              label="Upload Followers"
              hint="followers_1.json"
              icon={<Users className="w-8 h-8" />}
              color="purple"
            />
            <UploadArea 
              onFileSelect={(file) => handleFileUpload('following', file)} 
              isLoaded={following.length > 0}
              label="Upload Following"
              hint="following.json"
              icon={<UserCheck className="w-8 h-8" />}
              color="blue"
            />

            <div className="mt-auto bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl">
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2">Privacy Note</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All processing happens in your browser. No data is ever sent to a server. Your credentials remain safe.
              </p>
            </div>
          </aside>

          {/* Main Data Panel */}
          <div className="md:col-span-9 glass-panel flex flex-col min-h-0">
            <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar">
                <TabButton 
                  label={`Non-Followers (${results.length})`} 
                  active={activeTab === 'results'} 
                  onClick={() => handleTabChange('results')} 
                />
                <TabButton 
                  label={`All Following (${following.length})`} 
                  active={activeTab === 'following'} 
                  onClick={() => handleTabChange('following')} 
                />
                <TabButton 
                  label={`Followers (${followers.length})`} 
                  active={activeTab === 'followers'} 
                  onClick={() => handleTabChange('followers')} 
                />
                <TabButton 
                  label={`Fans Only (${fansOnlyCount})`} 
                  active={activeTab === 'fans'} 
                  onClick={() => handleTabChange('fans')} 
                />
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search username..." 
                  value={activeTab === 'results' ? searchResults : activeTab === 'following' ? searchFollowing : searchFollowers}
                  onChange={(e) => {
                    setCurrentPage(1);
                    if (activeTab === 'results') setSearchResults(e.target.value);
                    else if (activeTab === 'following') setSearchFollowing(e.target.value);
                    else setSearchFollowers(e.target.value);
                  }}
                  className="bg-slate-950 border border-slate-700/50 rounded-lg py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none w-full sm:w-64 text-slate-200 transition-all focus:border-purple-500/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0a0c10]/95 backdrop-blur-sm z-10">
                  <tr>
                    <th className="py-4 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">#</th>
                    <th 
                      onClick={() => toggleSort('timestamp')}
                      className="py-4 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-300 transition-colors group"
                    >
                      <div className="flex items-center gap-1">
                        Follow Date
                        {sortField === 'timestamp' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-purple-500" /> : <ChevronDown className="w-3 h-3 text-purple-500" />
                        )}
                        {sortField !== 'timestamp' && <RefreshCw className="w-2 h-2 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </th>
                    <th 
                      onClick={() => toggleSort('username')}
                      className="py-4 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-300 transition-colors group"
                    >
                      <div className="flex items-center gap-1">
                        Username
                        {sortField === 'username' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-purple-500" /> : <ChevronDown className="w-3 h-3 text-purple-500" />
                        )}
                        {sortField !== 'username' && <RefreshCw className="w-2 h-2 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </th>
                    <th className="py-4 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Profile URL</th>
                    <th className="py-4 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {paginatedData.currentItems.map((profile, i) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + i + 1;
                    return (
                      <DataRow 
                        key={profile.username + i} 
                        index={globalIndex} 
                        profile={profile} 
                        isVisited={visitedUsernames.has(profile.username)}
                        onVisit={() => handleVisit(profile.username)}
                      />
                    );
                  })}
                  
                  {paginatedData.totalItems === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-500 animate-pulse">
                        {followers.length > 0 && following.length > 0 
                          ? "Congratulations! Everyone you follow follows you back." 
                          : "Upload your data files and click 'Find Non-Followers' to begin."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 rounded-b-3xl">
              <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                <div className="flex gap-2">
                  <button 
                    onClick={copyUsernames}
                    disabled={results.length === 0}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Copy List
                  </button>
                  <button 
                    onClick={exportCSV}
                    disabled={results.length === 0}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Export CSV
                  </button>
                  <button 
                    onClick={exportTXT}
                    disabled={results.length === 0}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Export TXT
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  Showing {paginatedData.currentItems.length} of {paginatedData.totalItems} accounts
                </p>
              </div>

              {paginatedData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 border-t border-slate-800/50 pt-4">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                  </button>
                  <div className="flex items-center gap-1">
                    {[...Array(paginatedData.totalPages)].map((_, i) => {
                      const page = i + 1;
                      // Only show a limited number of page buttons
                      if (
                        page === 1 || 
                        page === paginatedData.totalPages || 
                        (page >= currentPage - 2 && page <= currentPage + 2)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${
                              currentPage === page 
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                                : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      }
                      if (page === currentPage - 3 || page === currentPage + 3) {
                        return <span key={page} className="text-slate-600 text-xs">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(paginatedData.totalPages, prev + 1))}
                    disabled={currentPage === paginatedData.totalPages}
                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-4 h-4 rotate-90" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Instructions Modal */}
        <InstructionsModal isOpen={showInstructions} onClose={() => setShowInstructions(false)} />

        {/* Footer */}
        <footer className="py-8 text-center border-t border-slate-900">
          <p className="text-[11px] text-slate-600 max-w-2xl mx-auto leading-relaxed">
            This tool is not affiliated with Instagram. It simply analyzes the data you provide. 
            All processing is done locally via JavaScript on your own device. <br />
            Make sure to download your Information from Instagram Settings &gt; Accounts Center &gt; Your information and permissions.
          </p>
        </footer>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, color, highlight, onClick }: { title: string, value: number, subtitle: string, color: 'white' | 'purple' | 'blue', highlight?: boolean, onClick?: () => void }) {
  const valueColors = {
    white: 'text-white',
    purple: 'text-purple-400',
    blue: 'text-blue-400'
  };

  const accentColors = {
    white: 'text-slate-500',
    purple: 'text-purple-400',
    blue: 'text-blue-400'
  };

  return (
    <div 
      onClick={onClick}
      className={`
      bg-slate-900/50 border border-slate-800 p-4 md:p-5 rounded-2xl transition-all duration-300 group hover:bg-slate-800/50
      ${highlight ? 'ring-2 ring-purple-500/20' : ''}
      ${onClick ? 'cursor-pointer' : ''}
    `}>
      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl md:text-3xl font-black ${valueColors[color]} tracking-tighter`}>
          {value.toLocaleString()}
        </span>
        <span className={`text-[10px] ${accentColors[color]} font-mono opacity-60 group-hover:opacity-100 transition-opacity`}>
          {subtitle}
        </span>
      </div>
    </div>
  );
}

function UploadArea({ onFileSelect, isLoaded, label, hint, icon, color }: { onFileSelect: (f: File) => void, isLoaded: boolean, label: string, hint: string, icon: React.ReactNode, color: 'purple' | 'blue' }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hoverColors = {
    purple: 'hover:border-purple-500/50 hover:bg-purple-500/5',
    blue: 'hover:border-blue-500/50 hover:bg-blue-500/5'
  };

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) onFileSelect(f); }}
      onClick={() => inputRef.current?.click()}
      className={`
        bg-slate-900/40 border border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300
        ${isDragging ? 'border-purple-500 bg-purple-500/10 scale-[0.98]' : `border-slate-800 ${hoverColors[color]}`}
        ${isLoaded ? 'border-green-500/30 bg-green-500/5' : ''}
      `}
    >
      <input 
        type="file" 
        hidden 
        ref={inputRef} 
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFileSelect(file);
            e.target.value = '';
          }
        }}
      />
      <div className={`mb-3 transition-transform duration-300 ${isDragging ? 'scale-110' : ''} ${isLoaded ? 'text-green-500' : 'text-slate-500'}`}>
        {isLoaded ? <CheckCircle2 className="w-8 h-8" /> : icon}
      </div>
      <p className={`text-xs font-bold ${isLoaded ? 'text-green-400' : 'text-slate-300'}`}>{label}</p>
      <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase opacity-60 tracking-wider">
        {isLoaded ? 'Loaded successfully' : hint}
      </p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`
        text-sm font-bold pb-2 transition-all border-b-2 whitespace-nowrap
        ${active ? 'border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}
      `}
    >
      {label}
    </button>
  );
}

function DataRow({ index, profile, isVisited, onVisit }: { index: number, profile: InstagramProfile, isVisited: boolean, onVisit: () => void }) {
  const formattedDate = useMemo(() => {
    if (!profile.timestamp) return 'N/A';
    // Instagram timestamps are in seconds
    const date = new Date(profile.timestamp * 1000);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }, [profile.timestamp]);

  return (
    <tr className={`border-b border-slate-800/50 hover:bg-slate-800/30 group transition-colors ${isVisited ? 'opacity-40' : ''}`}>
      <td className="py-3 px-2 font-mono text-slate-600 text-[10px]">{index.toString().padStart(2, '0')}</td>
      <td className="py-3 px-2 text-[11px] text-slate-400 font-mono italic">{formattedDate}</td>
      <td className="py-3 px-2 font-bold text-slate-200">
        <div className="flex items-center gap-2 text-sm">
          {profile.username}
          {isVisited && <CheckCircle2 className="w-3 h-3 text-green-500/50" />}
        </div>
      </td>
      <td className="py-3 px-2">
        <div className="flex items-center gap-2 group/link">
          <code className="text-[11px] text-slate-500 font-mono truncate max-w-[150px] md:max-w-[300px]">
            {profile.profileLink}
          </code>
        </div>
      </td>
      <td className="py-3 px-2 text-right">
        <a 
          href={profile.profileLink} 
          target="_blank" 
          rel="noreferrer"
          onClick={onVisit}
          className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase transition-all ${
            isVisited 
              ? 'bg-slate-900 border-slate-700 text-slate-600' 
              : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
        >
          {isVisited ? 'Visited' : 'Open'}
          <ExternalLink className="w-3 h-3" />
        </a>
      </td>
    </tr>
  );
}

function InstructionsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm p-6 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white">How to Export Instagram Data</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <InstructionStep 
              number="1" 
              title="Go to Settings" 
              text="Open Instagram on your mobile device or desktop and go to your Profile > Settings > Accounts Center."
            />
            <InstructionStep 
              number="2" 
              title="Access Information" 
              text="Tap on 'Your information and permissions' and then select 'Download your information'."
            />
            <InstructionStep 
              number="3" 
              title="Request Download" 
              text="Tap 'Request a download' and choose your account."
            />
            <InstructionStep 
              number="4" 
              title="Select Data Types" 
              text="Choose 'Some of your information' and find 'Followers and following' in the list. Check it and continue."
            />
            <InstructionStep 
              number="5" 
              title="Configure Format (Crucial!)" 
              text="Change Format to 'JSON' (HTML will not work here). Set Media Quality to 'Low' to make it faster, and Date Range to 'All time'."
            />
            <InstructionStep 
              number="6" 
              title="Submit & Wait" 
              text="Tap 'Submit Request'. Instagram will email you when the file is ready (usually takes 5-30 minutes)."
            />
            <InstructionStep 
              number="7" 
              title="Download & Extract" 
              text="Once it's ready, download the ZIP file from the link in your email. Extract it and look for 'followers_1.json' and 'following.json' inside the 'followers_and_following' folder."
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-500 mb-1">Make sure you select JSON</p>
                <p className="text-xs text-amber-200/70 leading-relaxed">
                  Instagram defaults to HTML format. Ensure you manually change it to JSON during Step 5, otherwise this tool won't be able to read your data.
                </p>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
          >
            Got it!
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InstructionStep({ number, title, text }: { number: string, title: string, text: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-slate-400">{number}</span>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-200 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
