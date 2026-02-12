import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { searchApi } from "../api/client";

type SearchCategory = "all" | "leads" | "activities" | "emails" | "proposals";

interface SearchResult {
  id: number;
  type: "lead" | "activity" | "email" | "proposal";
  title: string;
  subtitle: string;
  description?: string;
  timestamp?: string;
  status?: string;
  link: string;
}

export function Search() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [totalResults, setTotalResults] = useState(0);

  // Fetch recent searches on mount
  useEffect(() => {
    searchApi.getRecentSearches().then(setRecentSearches).catch(console.error);
  }, []);

  const categories: { id: SearchCategory; label: string; icon: string }[] = [
    { id: "all", label: "All Results", icon: "🔍" },
    { id: "leads", label: "Leads", icon: "👤" },
    { id: "activities", label: "Activities", icon: "📋" },
    { id: "emails", label: "Emails", icon: "✉️" },
    { id: "proposals", label: "Proposals", icon: "📄" },
  ];

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string, searchCategory: SearchCategory) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotalResults(0);
      return;
    }

    setIsLoading(true);
    try {
      // Use search API
      const searchResults = await searchApi.search(searchQuery, searchCategory === "all" ? undefined : searchCategory);
      
      // Save search to history
      searchApi.saveSearch(searchQuery, searchCategory).catch(console.error);
      
      // Convert leads to search results
      const leadResults: SearchResult[] = (searchResults.leads || []).map((lead) => ({
        id: lead.id,
        type: "lead" as const,
        title: lead.business_name,
        subtitle: lead.contact_name || "No contact",
        description: `${lead.industry || "N/A"} • ${lead.assigned_rep || "Unassigned"}`,
        timestamp: lead.last_activity || undefined,
        status: lead.status,
        link: `/lead/${lead.id}`,
      }));

      // Convert activities to search results
      const activityResults: SearchResult[] = (searchResults.activities || []).map((activity) => ({
        id: activity.id,
        type: "activity" as const,
        title: activity.activity_type || "Activity",
        subtitle: activity.lead_name || "Unknown",
        description: activity.notes || "",
        timestamp: activity.timestamp || undefined,
        link: "/activities",
      }));

      // Convert emails to search results
      const emailResults: SearchResult[] = (searchResults.emails || []).map((email) => ({
        id: email.id,
        type: "email" as const,
        title: email.subject || "Email",
        subtitle: email.lead_name || "Unknown",
        description: email.status || "",
        timestamp: email.generated_at || undefined,
        link: "/pending-emails",
      }));

      // Convert proposals to search results
      const proposalResults: SearchResult[] = (searchResults.proposals || []).map((proposal) => ({
        id: proposal.id,
        type: "proposal" as const,
        title: proposal.title || "Proposal",
        subtitle: proposal.lead_name || "Unknown",
        description: `$${proposal.total_price || 0}`,
        timestamp: proposal.created_at || undefined,
        status: proposal.status,
        link: "/workflow",
      }));

      // Combine based on category filter
      let allResults: SearchResult[] = [];
      if (searchCategory === "all") {
        allResults = [...leadResults, ...activityResults, ...emailResults, ...proposalResults];
      } else if (searchCategory === "leads") {
        allResults = leadResults;
      } else if (searchCategory === "activities") {
        allResults = activityResults;
      } else if (searchCategory === "emails") {
        allResults = emailResults;
      } else if (searchCategory === "proposals") {
        allResults = proposalResults;
      }

      setResults(allResults);
      setTotalResults(allResults.length);

      // Update recent searches
      if (searchQuery.trim() && !recentSearches.includes(searchQuery)) {
        setRecentSearches((prev) => [searchQuery, ...prev.slice(0, 4)]);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [recentSearches]);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, category);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, category, performSearch]);

  const getTypeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "lead": return "👤";
      case "activity": return "📋";
      case "email": return "✉️";
      case "proposal": return "📄";
    }
  };

  const getTypeColor = (type: SearchResult["type"]) => {
    switch (type) {
      case "lead": return "#667eea";
      case "activity": return "#10b981";
      case "email": return "#f59e0b";
      case "proposal": return "#8b5cf6";
    }
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "#6b7280";
    switch (status.toLowerCase()) {
      case "qualified lead": return "#10b981";
      case "proposal sent": return "#8b5cf6";
      case "converted": return "#059669";
      case "not interested": return "#ef4444";
      case "draft": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Search</h1>
        <p style={styles.subtitle}>Find leads, activities, emails, and proposals</p>
      </div>

      {/* Search Bar */}
      <div style={styles.searchSection}>
        <div style={styles.searchBar}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search across all data..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.searchInput}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={styles.clearBtn}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div style={styles.categoryTabs}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                ...styles.categoryTab,
                ...(category === cat.id ? styles.categoryTabActive : {}),
              }}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.layout}>
        {/* Main Results */}
        <div style={styles.resultsSection}>
          {/* Results Header */}
          {query && (
            <div style={styles.resultsHeader}>
              <span style={styles.resultsCount}>
                {isLoading ? "Searching..." : `${totalResults} result${totalResults !== 1 ? "s" : ""}`}
              </span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div style={styles.loadingState}>
              <div style={styles.spinner}></div>
              <span>Searching...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !query && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔍</div>
              <h3 style={styles.emptyTitle}>Start searching</h3>
              <p style={styles.emptyText}>
                Type a keyword to search across leads, activities, emails, and proposals
              </p>
            </div>
          )}

          {/* No Results */}
          {!isLoading && query && results.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🤷</div>
              <h3 style={styles.emptyTitle}>No results found</h3>
              <p style={styles.emptyText}>
                Try different keywords or broaden your search
              </p>
            </div>
          )}

          {/* Results List */}
          {!isLoading && results.length > 0 && (
            <div style={styles.resultsList}>
              {results.map((result) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  to={result.link}
                  style={styles.resultCard}
                >
                  <div
                    style={{
                      ...styles.resultIcon,
                      background: `${getTypeColor(result.type)}15`,
                      color: getTypeColor(result.type),
                    }}
                  >
                    {getTypeIcon(result.type)}
                  </div>
                  <div style={styles.resultContent}>
                    <div style={styles.resultTop}>
                      <span style={styles.resultTitle}>{result.title}</span>
                      {result.status && (
                        <span
                          style={{
                            ...styles.resultStatus,
                            background: `${getStatusColor(result.status)}15`,
                            color: getStatusColor(result.status),
                          }}
                        >
                          {result.status}
                        </span>
                      )}
                    </div>
                    <span style={styles.resultSubtitle}>{result.subtitle}</span>
                    {result.description && (
                      <span style={styles.resultDescription}>{result.description}</span>
                    )}
                  </div>
                  <div style={styles.resultMeta}>
                    <span style={styles.resultType}>{result.type}</span>
                    {result.timestamp && (
                      <span style={styles.resultTimestamp}>{result.timestamp}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          {/* Recent Searches */}
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarHeader}>
              <h3 style={styles.sidebarTitle}>Recent Searches</h3>
              {recentSearches.length > 0 && (
                <button onClick={clearRecentSearches} style={styles.clearLink}>
                  Clear
                </button>
              )}
            </div>
            {recentSearches.length === 0 ? (
              <p style={styles.sidebarEmpty}>No recent searches</p>
            ) : (
              <div style={styles.recentList}>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(search)}
                    style={styles.recentItem}
                  >
                    <span style={styles.recentIcon}>🕐</span>
                    {search}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Filters */}
          <div style={styles.sidebarSection}>
            <h3 style={styles.sidebarTitle}>Quick Filters</h3>
            <div style={styles.quickFilters}>
              <button
                onClick={() => setQuery("status:qualified")}
                style={styles.quickFilter}
              >
                <span style={{ ...styles.filterDot, background: "#10b981" }} />
                Qualified Leads
              </button>
              <button
                onClick={() => setQuery("status:proposal")}
                style={styles.quickFilter}
              >
                <span style={{ ...styles.filterDot, background: "#8b5cf6" }} />
                Proposals Sent
              </button>
              <button
                onClick={() => setQuery("today")}
                style={styles.quickFilter}
              >
                <span style={{ ...styles.filterDot, background: "#f59e0b" }} />
                Today's Activity
              </button>
              <button
                onClick={() => setQuery("follow-up")}
                style={styles.quickFilter}
              >
                <span style={{ ...styles.filterDot, background: "#ef4444" }} />
                Needs Follow-up
              </button>
            </div>
          </div>

          {/* Search Tips */}
          <div style={styles.sidebarSection}>
            <h3 style={styles.sidebarTitle}>Search Tips</h3>
            <div style={styles.tipsList}>
              <div style={styles.tip}>
                <span style={styles.tipCode}>name:</span>
                <span>Search by contact name</span>
              </div>
              <div style={styles.tip}>
                <span style={styles.tipCode}>status:</span>
                <span>Filter by lead status</span>
              </div>
              <div style={styles.tip}>
                <span style={styles.tipCode}>rep:</span>
                <span>Find by assigned rep</span>
              </div>
              <div style={styles.tip}>
                <span style={styles.tipCode}>@industry</span>
                <span>Search by industry</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px",
    maxWidth: "1344px",
    margin: "0 auto",
    minHeight: "calc(100vh - 80px)",
  },
  header: {
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--bg-cream)",
    margin: "4px 0 0",
  },
  searchSection: {
    marginBottom: "32px",
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    background: "#fff",
    borderRadius: "16px",
    padding: "16px 24px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    marginBottom: "16px",
  },
  searchIcon: {
    fontSize: "24px",
    marginRight: "16px",
    color: "#9ca3af",
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "18px",
    color: "#1f2937",
  },
  clearBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: "14px",
  },
  categoryTabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  categoryTab: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  categoryTabActive: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "1px solid transparent",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    gap: "32px",
  },
  resultsSection: {},
  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  resultsCount: {
    fontSize: "14px",
    color: "var(--bg-cream)",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    background: "#fff",
    borderRadius: "16px",
    gap: "16px",
    color: "#6b7280",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #667eea",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    background: "#fff",
    borderRadius: "16px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px",
  },
  emptyText: {
    fontSize: "14px",
    color: "var(--bg-cream)",
    margin: 0,
    maxWidth: "300px",
  },
  resultsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  resultCard: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px 20px",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    textDecoration: "none",
    transition: "all 0.2s",
    cursor: "pointer",
  },
  resultIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    flexShrink: 0,
  },
  resultContent: {
    flex: 1,
    minWidth: 0,
  },
  resultTop: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "4px",
  },
  resultTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1f2937",
  },
  resultStatus: {
    padding: "3px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 500,
  },
  resultSubtitle: {
    display: "block",
    fontSize: "13px",
    color: "var(--bg-cream)",
    marginBottom: "2px",
  },
  resultDescription: {
    display: "block",
    fontSize: "12px",
    color: "#9ca3af",
  },
  resultMeta: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
    flexShrink: 0,
  },
  resultType: {
    fontSize: "11px",
    fontWeight: 500,
    color: "#9ca3af",
    textTransform: "uppercase",
  },
  resultTimestamp: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  sidebarSection: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  sidebarTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  clearLink: {
    background: "none",
    border: "none",
    fontSize: "13px",
    color: "#667eea",
    cursor: "pointer",
  },
  sidebarEmpty: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: 0,
  },
  recentList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  recentItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "none",
    background: "#f9fafb",
    color: "#4b5563",
    fontSize: "13px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
  },
  recentIcon: {
    fontSize: "14px",
  },
  quickFilters: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  quickFilter: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "none",
    background: "#f9fafb",
    color: "#4b5563",
    fontSize: "13px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
  },
  filterDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  tipsList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  tip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "var(--bg-cream)",
  },
  tipCode: {
    background: "#f3f4f6",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "monospace",
    color: "#667eea",
  },
};

export default Search;
