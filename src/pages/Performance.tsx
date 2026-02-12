import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { performanceApi, teamApi, type MyPerformanceData, type TeamPerformance, type TimelineItem } from "../api/client";

export function Performance() {
  const [myPerf, setMyPerf] = useState<MyPerformanceData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamPerformance[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"week" | "month" | "quarter">("month");
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [myData, teamData] = await Promise.all([
        performanceApi.getMyPerformance(timeframe),
        teamApi.getPerformance(timeframe),
      ]);
      setMyPerf(myData);
      setTeamMembers(teamData.members.map(p => ({
        ...p,
        rank: p.rank || 0,
        targets: p.targets || { calls: 50, emails: 100, meetings: 10, conversions: 5 },
      })));
      setTeamStats(teamData.team_stats);
    } catch (err) {
      console.error("Failed to fetch performance:", err);
      setError("Failed to load performance data.");
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return "";
    const utc = ts.endsWith("Z") ? ts : ts + "Z";
    const d = new Date(utc);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "Call": return "📞";
      case "Email": return "✉️";
      case "Meeting": return "📅";
      case "Note": return "📝";
      case "Task": return "✅";
      case "Proposal": return "📄";
      default: return "📊";
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={styles.spinner}
          />
          <p style={{ color: "#6b7280", marginTop: "12px" }}>Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorState}>
          <p style={{ color: "#ef4444" }}>{error}</p>
          <button onClick={fetchData} style={styles.retryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      style={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.div
        style={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 style={styles.title}>Performance</h1>
          <p style={styles.subtitle}>
            {myPerf?.user?.name ? `Welcome back, ${myPerf.user.name.split(" ")[0]}` : "Track your activity and progress"}
          </p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.tabGroup}>
            <motion.button
              onClick={() => setActiveTab("my")}
              style={{ ...styles.tabBtn, ...(activeTab === "my" ? styles.tabBtnActive : {}) }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              My Performance
            </motion.button>
            <motion.button
              onClick={() => setActiveTab("team")}
              style={{ ...styles.tabBtn, ...(activeTab === "team" ? styles.tabBtnActive : {}) }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Team
            </motion.button>
          </div>
          <div style={styles.timeframeTabs}>
            {(["week", "month", "quarter"] as const).map((t) => (
              <motion.button
                key={t}
                onClick={() => setTimeframe(t)}
                style={{
                  ...styles.timeframeBtn,
                  ...(timeframe === t ? styles.timeframeBtnActive : {}),
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t === "week" ? "This Week" : t === "month" ? "This Month" : "This Quarter"}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {activeTab === "my" && myPerf && (
        <>
          {/* My Stats Overview */}
          <motion.div
            style={styles.myOverviewCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div style={styles.myOverviewHeader}>
              <div style={styles.myAvatar}>
                {myPerf.user.name.split(" ").map(n => n[0]).join("").toUpperCase()}
              </div>
              <div>
                <h2 style={styles.myName}>{myPerf.user.name}</h2>
                <p style={styles.myEmail}>{myPerf.user.email}</p>
              </div>
            </div>
            <div style={styles.myStatsGrid}>
              {[
                { value: myPerf.stats.total_activities, label: "Total Activities", icon: "📊", color: "#667eea" },
                { value: myPerf.stats.calls, label: "Calls Made", icon: "📞", color: "#8b5cf6" },
                { value: myPerf.stats.emails_sent, label: "Emails Sent", icon: "✉️", color: "#06b6d4" },
                { value: myPerf.stats.meetings, label: "Meetings", icon: "📅", color: "#f59e0b" },
                { value: myPerf.stats.proposals, label: "Proposals", icon: "📄", color: "#ec4899" },
                { value: myPerf.stats.conversions, label: "Conversions", icon: "🎯", color: "#10b981" },
                { value: formatCurrency(myPerf.stats.revenue), label: "Revenue", icon: "💰", color: "#10b981" },
                { value: myPerf.stats.leads_assigned, label: "Leads Assigned", icon: "👤", color: "#6366f1" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  style={styles.myStatCard}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                >
                  <span style={styles.myStatIcon}>{stat.icon}</span>
                  <span style={{ ...styles.myStatValue, color: stat.color }}>{stat.value}</span>
                  <span style={styles.myStatLabel}>{stat.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Email Pipeline + Recent Activity side by side */}
          <div style={styles.twoColumnGrid}>
            {/* Email Pipeline */}
            <motion.div
              style={styles.pipelineCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 style={styles.sectionTitle}>Email Pipeline</h3>
              <div style={styles.pipelineGrid}>
                {[
                  { label: "Pending Review", value: myPerf.email_pipeline.pending_review, color: "#f59e0b", bg: "#fffbeb" },
                  { label: "Approved", value: myPerf.email_pipeline.approved, color: "#667eea", bg: "#eef2ff" },
                  { label: "Sent", value: myPerf.email_pipeline.sent, color: "#10b981", bg: "#ecfdf5" },
                  { label: "Rejected", value: myPerf.email_pipeline.rejected, color: "#ef4444", bg: "#fef2f2" },
                  { label: "Total Composed", value: myPerf.email_pipeline.total_composed, color: "#6b7280", bg: "#f9fafb" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    style={{ ...styles.pipelineStat, background: item.bg }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 + i * 0.05 }}
                  >
                    <span style={{ ...styles.pipelineValue, color: item.color }}>{item.value}</span>
                    <span style={styles.pipelineLabel}>{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              style={styles.timelineCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <h3 style={styles.sectionTitle}>Recent Activity</h3>
              <div style={styles.timelineList}>
                {myPerf.timeline.length === 0 ? (
                  <p style={styles.emptyText}>No recent activity in this timeframe.</p>
                ) : (
                  myPerf.timeline.slice(0, 12).map((item: TimelineItem, i: number) => (
                    <motion.div
                      key={`${item.timestamp}-${i}`}
                      style={styles.timelineItem}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.04 }}
                    >
                      <span style={styles.timelineIcon}>{getActivityIcon(item.activity_type)}</span>
                      <div style={styles.timelineContent}>
                        <span style={styles.timelineAction}>
                          <strong>{item.activity_type}</strong>
                          {item.outcome ? ` - ${item.outcome}` : ""}
                        </span>
                        {item.lead_name && (
                          <span style={styles.timelineLead}>{item.lead_name}</span>
                        )}
                        {item.notes && (
                          <span style={styles.timelineNotes}>{item.notes.substring(0, 80)}{item.notes.length > 80 ? "..." : ""}</span>
                        )}
                      </div>
                      <span style={styles.timelineTime}>{formatTimestamp(item.timestamp)}</span>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}

      {activeTab === "team" && (
        <>
          {/* Team Overview */}
          <motion.div
            style={styles.teamOverviewCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 style={styles.teamOverviewTitle}>Team Overview</h3>
            <div style={styles.teamOverviewGrid}>
              {[
                { value: (teamStats.total_activities || 0).toLocaleString(), label: "Total Activities" },
                { value: teamStats.total_calls || 0, label: "Calls" },
                { value: teamStats.total_emails || 0, label: "Emails" },
                { value: teamStats.total_meetings || 0, label: "Meetings" },
                { value: teamStats.total_proposals || 0, label: "Proposals" },
                { value: teamStats.total_conversions || 0, label: "Conversions" },
                { value: formatCurrency(teamStats.total_revenue || 0), label: "Revenue" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  style={styles.teamOverviewStat}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                >
                  <span style={styles.teamOverviewValue}>{stat.value}</span>
                  <span style={styles.teamOverviewLabel}>{stat.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Team Leaderboard */}
          <motion.div
            style={styles.leaderboardCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 style={styles.sectionTitle}>Team Leaderboard</h3>
            <div style={styles.leaderboardTable}>
              <div style={styles.leaderboardHeader}>
                <span style={{ flex: 0.5 }}>Rank</span>
                <span style={{ flex: 2 }}>Rep</span>
                <span style={{ flex: 1, textAlign: "center" }}>Calls</span>
                <span style={{ flex: 1, textAlign: "center" }}>Emails</span>
                <span style={{ flex: 1, textAlign: "center" }}>Meetings</span>
                <span style={{ flex: 1, textAlign: "center" }}>Proposals</span>
                <span style={{ flex: 1, textAlign: "center" }}>Conversions</span>
                <span style={{ flex: 1, textAlign: "right" }}>Revenue</span>
              </div>
              {teamMembers.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af" }}>
                  No team data available.
                </div>
              ) : (
                teamMembers.map((rep, index) => (
                  <motion.div
                    key={rep.id}
                    style={{
                      ...styles.leaderboardRow,
                      background: index === 0 ? "#fefce8" : index % 2 === 0 ? "#fff" : "#f9fafb",
                    }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.05 }}
                  >
                    <span style={{ flex: 0.5 }}>
                      <span style={{
                        ...styles.leaderboardRank,
                        background: index === 0 ? "#fef3c7" : index === 1 ? "#f3f4f6" : index === 2 ? "#fed7aa" : "#f3f4f6",
                      }}>
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                      </span>
                    </span>
                    <span style={{ flex: 2, display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={styles.miniAvatar}>
                        {rep.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </span>
                      {rep.name}
                    </span>
                    <span style={{ flex: 1, textAlign: "center" }}>{rep.calls}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{rep.emails}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{rep.meetings}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{rep.proposals}</span>
                    <span style={{ flex: 1, textAlign: "center", fontWeight: 600 }}>{rep.conversions}</span>
                    <span style={{ flex: 1, textAlign: "right", fontWeight: 600, color: "#10b981" }}>
                      {formatCurrency(rep.revenue)}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px",
    maxWidth: "1344px",
    margin: "0 auto",
    minHeight: "calc(100vh - 80px)",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid #e5e7eb",
    borderTopColor: "#667eea",
    borderRadius: "50%",
  },
  errorState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    gap: "12px",
  },
  retryBtn: {
    padding: "8px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  headerActions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  tabGroup: {
    display: "flex",
    gap: "4px",
    background: "#f3f4f6",
    padding: "4px",
    borderRadius: "8px",
  },
  tabBtn: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#667eea",
    color: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  timeframeTabs: {
    display: "flex",
    gap: "4px",
    background: "#f3f4f6",
    padding: "4px",
    borderRadius: "8px",
  },
  timeframeBtn: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  timeframeBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },

  // My Performance
  myOverviewCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  myOverviewHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
  },
  myAvatar: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: 700,
  },
  myName: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  myEmail: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "2px 0 0",
  },
  myStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },
  myStatCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 12px",
    background: "#f9fafb",
    borderRadius: "12px",
    transition: "all 0.2s",
  },
  myStatIcon: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  myStatValue: {
    fontSize: "24px",
    fontWeight: 700,
  },
  myStatLabel: {
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "4px",
    textAlign: "center",
  },

  sectionTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 20px",
  },

  // Two column layout
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    marginBottom: "24px",
  },

  // Email Pipeline
  pipelineCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  pipelineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  pipelineStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px",
    borderRadius: "12px",
  },
  pipelineValue: {
    fontSize: "28px",
    fontWeight: 700,
  },
  pipelineLabel: {
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "4px",
  },

  // Timeline
  timelineCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    maxHeight: "500px",
    overflowY: "auto",
  },
  timelineList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  emptyText: {
    color: "#9ca3af",
    textAlign: "center",
    padding: "20px",
  },
  timelineItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "#f9fafb",
  },
  timelineIcon: {
    fontSize: "18px",
    marginTop: "2px",
  },
  timelineContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  timelineAction: {
    fontSize: "13px",
    color: "#1f2937",
  },
  timelineLead: {
    fontSize: "12px",
    color: "#667eea",
    fontWeight: 500,
  },
  timelineNotes: {
    fontSize: "12px",
    color: "#6b7280",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  timelineTime: {
    fontSize: "11px",
    color: "#9ca3af",
    whiteSpace: "nowrap",
    marginTop: "2px",
  },

  // Team Overview
  teamOverviewCard: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "24px",
    color: "#fff",
  },
  teamOverviewTitle: {
    fontSize: "18px",
    fontWeight: 600,
    margin: "0 0 20px",
    opacity: 0.9,
  },
  teamOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "24px",
  },
  teamOverviewStat: {
    textAlign: "center",
  },
  teamOverviewValue: {
    display: "block",
    fontSize: "24px",
    fontWeight: 700,
  },
  teamOverviewLabel: {
    fontSize: "12px",
    opacity: 0.8,
  },

  // Leaderboard
  leaderboardCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  leaderboardTable: {},
  leaderboardHeader: {
    display: "flex",
    padding: "12px 16px",
    background: "#f9fafb",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  leaderboardRow: {
    display: "flex",
    padding: "14px 16px",
    alignItems: "center",
    fontSize: "14px",
    color: "#1f2937",
    borderRadius: "8px",
  },
  leaderboardRank: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "13px",
  },
  miniAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 600,
  },
};

export default Performance;
