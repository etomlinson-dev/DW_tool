import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leadsApi, logsApi, dashboardApi } from "../api/client";
import type {
  Lead,
  LeadFilters,
  LeadStatus,
  DashboardStats,
  LeaderboardEntry,
  TrendDataPoint,
  FunnelStage,
} from "../types";
import { LEAD_STATUS_OPTIONS } from "../types";
import {
  FilterButtons,
  LeadsTable,
  Pagination,
  StatsCard,
  ActivityTrendChart,
  StatusDistributionChart,
  Leaderboard,
} from "../components";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export function Dashboard() {
  // Stats state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [trendDays, setTrendDays] = useState(7);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<
    "today" | "week" | "month"
  >("week");
  const [statsLoading, setStatsLoading] = useState(true);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<LeadFilters>({
    status: "",
    rep: "",
    industry: "",
    timeframe: "",
    page: 1,
    per_page: 50,
  });

  // Filter options
  const [reps, setReps] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);

  // Pagination
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk actions
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkRep, setBulkRep] = useState("");

  // View toggle — persisted in localStorage
  const [showStats, setShowStats] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("dw_show_stats");
      if (saved !== null) return saved === "true";
    } catch { /* use default */ }
    return true;
  });

  const toggleStats = () => {
    setShowStats((prev) => {
      const next = !prev;
      try { localStorage.setItem("dw_show_stats", String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Load dashboard data on mount
  useEffect(() => {
    const loadDashboardData = async () => {
      setStatsLoading(true);
      try {
        const [statsData, trendsData, filterOptions] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getTrends(trendDays),
          dashboardApi.getFilterOptions(),
        ]);
        setStats(statsData);
        setTrends(trendsData);
        setReps(filterOptions.reps);
        setIndustries(filterOptions.industries);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  // Re-fetch trends when days change
  const handleTrendDaysChange = (days: number) => {
    setTrendDays(days);
    dashboardApi.getTrends(days).then(setTrends).catch(console.error);
  };

  // Load leaderboard when timeframe changes
  useEffect(() => {
    dashboardApi
      .getLeaderboard(leaderboardTimeframe)
      .then(setLeaderboard)
      .catch(console.error);
  }, [leaderboardTimeframe]);

  // Load leads when filters change
  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await leadsApi.getLeads(filters);
      setLeads(response.data);
      setTotalPages(response.total_pages);
      setTotalLeads(response.total);
    } catch (err) {
      console.error("Failed to load leads:", err);
      setError("Failed to load leads. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Filter handlers
  const handleFilterChange = (key: keyof LeadFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handleQuickFilterChange = (
    paramType: "status" | "timeframe",
    value: string
  ) => {
    handleFilterChange(paramType, value);
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      rep: "",
      industry: "",
      timeframe: "",
      page: 1,
      per_page: 50,
    });
  };

  // Lead actions
  const handleStatusChange = async (leadId: number, status: LeadStatus) => {
    try {
      await leadsApi.updateLeadStatus(leadId, status);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status } : l))
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleQuickLog = async (leadId: number) => {
    if (!confirm("Quick log: Call - Attempted?")) return;
    try {
      await logsApi.quickLog(leadId, "Call", "Attempted");
      loadLeads();
      // Refresh stats
      const newStats = await dashboardApi.getStats();
      setStats(newStats);
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  // Bulk actions
  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one lead");
      return;
    }
    if (!bulkStatus && !bulkRep) {
      alert("Please select a status or rep to update");
      return;
    }

    try {
      await leadsApi.bulkUpdate(selectedIds, {
        status: bulkStatus || undefined,
        assigned_rep: bulkRep || undefined,
      });
      setSelectedIds([]);
      setBulkStatus("");
      setBulkRep("");
      loadLeads();
    } catch (err) {
      console.error("Failed to bulk update:", err);
    }
  };

  return (
    <motion.div 
      className="dashboard" 
      style={{ padding: "24px", maxWidth: "1344px", margin: "0 auto" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#1f2937",
            margin: 0,
          }}
        >
          Outreach Dashboard
        </h1>
        <motion.button
          onClick={toggleStats}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 500,
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            background: showStats ? "#667eea" : "#f3f4f6",
            color: showStats ? "#fff" : "#6b7280",
            transition: "all 0.2s",
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {showStats ? "Hide Stats" : "Show Stats"}
        </motion.button>
      </motion.div>

      {/* Stats Section */}
      {showStats && (
        <>
          {/* Stats Cards Row */}
          {statsLoading ? (
            <motion.div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#9ca3af",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Loading dashboard stats...
            </motion.div>
          ) : stats ? (
            <>
              <motion.div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {[
                  { title: "Today's Activities", value: stats.daily_completed, icon: "📊", color: "blue" as const, showProgress: false },
                  { title: "This Week", value: stats.weekly_completed, icon: "📈", color: "green" as const, showProgress: false },
                  { title: "This Month", value: stats.monthly_completed, icon: "📅", color: "purple" as const, showProgress: false },
                  { title: "Conversion Rate", value: `${stats.conversion_rate}%`, icon: "🎯", color: "orange" as const, showProgress: false },
                ].map((card, index) => (
                  <motion.div 
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  >
                    <StatsCard {...card} />
                  </motion.div>
                ))}
              </motion.div>

              {/* Charts Row */}
              <motion.div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <ActivityTrendChart data={trends} days={trendDays} onDaysChange={handleTrendDaysChange} />
                <StatusDistributionChart data={stats.status_distribution} />
              </motion.div>

              {/* Leaderboard */}
              <motion.div 
                style={{ marginBottom: "24px" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Leaderboard
                  data={leaderboard}
                  timeframe={leaderboardTimeframe}
                  onTimeframeChange={setLeaderboardTimeframe}
                />
              </motion.div>
            </>
          ) : null}
        </>
      )}

      {/* Leads Database Card */}
      <motion.div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#1f2937",
            marginBottom: "16px",
          }}
        >
          Leads Database
        </h3>

        {/* Filter Section */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280" }}>
              Filters & Quick Actions
            </span>
            <FilterButtons
              activeStatus={filters.status || ""}
              activeTimeframe={filters.timeframe || ""}
              onFilterChange={handleQuickFilterChange}
            />
          </div>

          {/* Dropdown Filters */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            <select
              value={filters.rep}
              onChange={(e) => handleFilterChange("rep", e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "14px",
                minWidth: "140px",
              }}
            >
              <option value="">All Reps</option>
              {reps.map((rep) => (
                <option key={rep} value={rep}>
                  {rep}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "14px",
                minWidth: "140px",
              }}
            >
              <option value="">All Statuses</option>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={filters.industry}
              onChange={(e) => handleFilterChange("industry", e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "14px",
                minWidth: "140px",
              }}
            >
              <option value="">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>

            <select
              value={filters.timeframe || ""}
              onChange={(e) => handleFilterChange("timeframe", e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "14px",
                minWidth: "140px",
              }}
            >
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            <button
              onClick={clearFilters}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#e5e7eb",
                color: "#6b7280",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "13px", color: "#9ca3af" }}>
              Showing {leads.length} of {totalLeads} leads (Page {filters.page} of{" "}
              {totalPages})
            </span>
          </div>
        </div>

        {/* Bulk Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setSelectedIds(leads.map((l) => l.id))}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedIds([])}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            {selectedIds.length} selected
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "13px",
              }}
            >
              <option value="">Bulk Status</option>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={bulkRep}
              onChange={(e) => setBulkRep(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "13px",
              }}
            >
              <option value="">Assign Rep</option>
              {reps.map((rep) => (
                <option key={rep} value={rep}>
                  {rep}
                </option>
              ))}
            </select>

            <button
              onClick={handleBulkUpdate}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#10b981",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
            <button
              onClick={async () => {
                if (selectedIds.length === 0) return;
                if (!confirm(`Delete ${selectedIds.length} lead(s)? This cannot be undone.`)) return;
                try {
                  await leadsApi.bulkDelete(selectedIds);
                  setSelectedIds([]);
                  const res = await leadsApi.getLeads({ per_page: 200 });
                  setLeads(res.data);
                } catch (err) {
                  console.error("Failed to delete leads:", err);
                }
              }}
              disabled={selectedIds.length === 0}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #fecaca",
                background: "#fff",
                color: selectedIds.length === 0 ? "#d1d5db" : "#ef4444",
                fontSize: "13px",
                fontWeight: 500,
                cursor: selectedIds.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Delete Selected
            </button>
            <button
              onClick={async () => {
                const confirmation = prompt(
                  `This will permanently delete ALL ${totalLeads} leads. Type DELETE to confirm.`
                );
                if (confirmation !== "DELETE") return;
                try {
                  const result = await leadsApi.bulkDelete([]);
                  alert(`Deleted ${result.deleted} leads.`);
                  setSelectedIds([]);
                  const res = await leadsApi.getLeads({ per_page: 200 });
                  setLeads(res.data);
                } catch (err) {
                  console.error("Failed to delete all leads:", err);
                }
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Delete All Leads
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div
            style={{
              padding: "12px",
              background: "#fef2f2",
              borderRadius: "8px",
              color: "#dc2626",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#9ca3af",
            }}
          >
            Loading leads...
          </div>
        ) : (
          <>
            {/* Leads Table */}
            <LeadsTable
              leads={leads}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onStatusChange={handleStatusChange}
              onQuickLog={handleQuickLog}
            />

            {/* Pagination */}
            <Pagination
              currentPage={filters.page || 1}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export default Dashboard;
