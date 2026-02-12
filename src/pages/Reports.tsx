import { useState, useEffect, useCallback } from "react";
import { dashboardApi } from "../api/client";
import type { DashboardStats, LeaderboardEntry, TrendDataPoint } from "../types";

type ReportPeriod = "today" | "week" | "month" | "quarter" | "year";
type ReportTab = "overview" | "response" | "revenue" | "service";

interface ResponseRateData {
  total_leads: number;
  overall_response_rate: number;
  response_breakdown: Record<string, { count: number; percentage: number }>;
  by_source: Record<string, { total: number; replied: number; response_rate: number }>;
  by_service: Record<string, { total: number; replied: number; response_rate: number }>;
}

interface TimeToCloseData {
  average_days: number;
  total_closed: number;
  by_service: Record<string, { average: number; count: number }>;
  distribution: Record<string, number>;
}

interface RevenuePipelineData {
  total_pipeline_value: number;
  total_deals: number;
  by_stage: Array<{ stage: string; color: string; count: number; value: number }>;
  by_service: Record<string, { count: number; value: number }>;
  by_rep: Record<string, { count: number; value: number }>;
  expected_this_month: { count: number; value: number };
}

interface ServiceBreakdownData {
  [category: string]: {
    total: number;
    by_status: Record<string, number>;
    by_response: Record<string, number>;
    total_value: number;
    converted: number;
    conversion_rate: number;
  };
}

export function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Advanced analytics state
  const [responseRates, setResponseRates] = useState<ResponseRateData | null>(null);
  const [timeToClose, setTimeToClose] = useState<TimeToCloseData | null>(null);
  const [revenuePipeline, setRevenuePipeline] = useState<RevenuePipelineData | null>(null);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdownData | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const timeframe = period === "today" ? "week" : period;
      const [responseRes, closeRes, revenueRes, serviceRes] = await Promise.all([
        fetch(`/api/analytics/response-rates?timeframe=${timeframe}`),
        fetch("/api/analytics/time-to-close"),
        fetch("/api/analytics/revenue-pipeline"),
        fetch("/api/analytics/service-breakdown"),
      ]);

      if (responseRes.ok) setResponseRates(await responseRes.json());
      if (closeRes.ok) setTimeToClose(await closeRes.json());
      if (revenueRes.ok) setRevenuePipeline(await revenueRes.json());
      if (serviceRes.ok) setServiceBreakdown(await serviceRes.json());
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  }, [period]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [statsData, leaderboardData, trendsData] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getLeaderboard("month"),
          dashboardApi.getTrends(30),
        ]);
        setStats(statsData);
        setLeaderboard(leaderboardData);
        setTrends(trendsData);
        await fetchAnalytics();
      } catch (err) {
        console.error("Failed to load report data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [period, fetchAnalytics]);

  const exportReport = (format: "csv" | "pdf") => {
    // Generate CSV data
    if (format === "csv" && stats) {
      const csvContent = [
        ["Metric", "Value"],
        ["Daily Activities", stats.daily_completed],
        ["Weekly Activities", stats.weekly_completed],
        ["Monthly Activities", stats.monthly_completed],
        ["Conversion Rate", `${stats.conversion_rate}%`],
        ["Total Leads", stats.total_leads],
        ["Unique Businesses", stats.unique_businesses],
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}>Loading reports...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Sales Reports</h1>
          <p style={styles.subtitle}>Performance analytics and insights</p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.periodSelector}>
            {(["today", "week", "month", "quarter", "year"] as ReportPeriod[]).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    ...styles.periodBtn,
                    ...(period === p ? styles.periodBtnActive : {}),
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              )
            )}
          </div>
          <div style={styles.exportBtns}>
            <button onClick={() => exportReport("csv")} style={styles.exportBtn}>
              📥 Export CSV
            </button>
            <button onClick={() => exportReport("pdf")} style={styles.exportBtnPrimary}>
              📄 Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div style={styles.tabContainer}>
        {([
          { id: "overview", label: "📊 Overview" },
          { id: "response", label: "📈 Response Rates" },
          { id: "revenue", label: "💰 Revenue Pipeline" },
          { id: "service", label: "🏷️ Service Breakdown" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tabBtn,
              ...(activeTab === tab.id ? styles.tabBtnActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
      <>
      {/* Key Metrics Grid */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>📊</div>
          <div style={styles.metricContent}>
            <span style={styles.metricValue}>{stats?.monthly_completed || 0}</span>
            <span style={styles.metricLabel}>Total Activities</span>
            <div style={styles.metricChange}>
              <span style={styles.changePositive}>
                ↑ {stats?.monthly_change || 0}%
              </span>
              <span style={styles.changeLabel}>vs last period</span>
            </div>
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>🎯</div>
          <div style={styles.metricContent}>
            <span style={styles.metricValue}>{stats?.conversion_rate || 0}%</span>
            <span style={styles.metricLabel}>Conversion Rate</span>
            <div style={styles.metricChange}>
              <span style={styles.changePositive}>↑ 2.3%</span>
              <span style={styles.changeLabel}>vs last period</span>
            </div>
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>👥</div>
          <div style={styles.metricContent}>
            <span style={styles.metricValue}>{stats?.total_leads || 0}</span>
            <span style={styles.metricLabel}>Total Leads</span>
            <div style={styles.metricChange}>
              <span style={styles.changePositive}>↑ 12</span>
              <span style={styles.changeLabel}>new this period</span>
            </div>
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>🏢</div>
          <div style={styles.metricContent}>
            <span style={styles.metricValue}>{stats?.unique_businesses || 0}</span>
            <span style={styles.metricLabel}>Unique Businesses</span>
            <div style={styles.metricChange}>
              <span style={styles.changePositive}>↑ 8</span>
              <span style={styles.changeLabel}>new this period</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={styles.chartsRow}>
        {/* Activity Trend */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Activity Trend</h3>
          <div style={styles.chartContainer}>
            <div style={styles.trendChart}>
              {trends.map((point, index) => {
                const maxActivities = Math.max(...trends.map((t) => t.activities), 1);
                const height = (point.activities / maxActivities) * 100;
                return (
                  <div key={index} style={styles.trendBar}>
                    <div
                      style={{
                        ...styles.trendBarFill,
                        height: `${height}%`,
                      }}
                    />
                    <span style={styles.trendLabel}>{point.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Pipeline Distribution</h3>
          <div style={styles.pipelineList}>
            {stats?.status_distribution &&
              Object.entries(stats.status_distribution).map(([status, count]) => {
                const total = Object.values(stats.status_distribution).reduce(
                  (a, b) => a + b,
                  0
                );
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={status} style={styles.pipelineItem}>
                    <div style={styles.pipelineHeader}>
                      <span style={styles.pipelineStatus}>{status}</span>
                      <span style={styles.pipelineCount}>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div style={styles.pipelineBar}>
                      <div
                        style={{
                          ...styles.pipelineBarFill,
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Team Performance */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>Team Performance</h3>
          <select style={styles.tableFilter}>
            <option>All Time</option>
            <option>This Month</option>
            <option>This Week</option>
          </select>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Rank</th>
              <th style={styles.th}>Rep</th>
              <th style={styles.th}>Activities</th>
              <th style={styles.th}>Calls</th>
              <th style={styles.th}>Emails</th>
              <th style={styles.th}>Conversions</th>
              <th style={styles.th}>Leads</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => (
              <tr key={entry.rank} style={styles.tr}>
                <td style={styles.td}>
                  <span style={styles.rank}>#{entry.rank}</span>
                </td>
                <td style={styles.td}>
                  <div style={styles.repCell}>
                    <div style={styles.repAvatar}>
                      {entry.rep.charAt(0).toUpperCase()}
                    </div>
                    <span style={styles.repName}>{entry.rep}</span>
                  </div>
                </td>
                <td style={styles.td}>{entry.activities}</td>
                <td style={styles.td}>{entry.calls}</td>
                <td style={styles.td}>{entry.emails}</td>
                <td style={styles.td}>
                  <span style={styles.conversionBadge}>{entry.conversions}</span>
                </td>
                <td style={styles.td}>{entry.leads_assigned}</td>
              </tr>
            ))}
            {leaderboard.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...styles.td, textAlign: "center" }}>
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Activity Breakdown */}
      <div style={styles.breakdownRow}>
        <div style={styles.breakdownCard}>
          <h3 style={styles.breakdownTitle}>Activity Breakdown</h3>
          <div style={styles.breakdownList}>
            {stats?.activity_breakdown &&
              Object.entries(stats.activity_breakdown).map(([type, count]) => (
                <div key={type} style={styles.breakdownItem}>
                  <span style={styles.breakdownType}>{type}</span>
                  <span style={styles.breakdownCount}>{count}</span>
                </div>
              ))}
          </div>
        </div>

        <div style={styles.breakdownCard}>
          <h3 style={styles.breakdownTitle}>Goal Progress</h3>
          <div style={styles.goalList}>
            <div style={styles.goalItem}>
              <div style={styles.goalHeader}>
                <span>Daily Target</span>
                <span>
                  {stats?.daily_completed || 0} / {stats?.daily_target || 0}
                </span>
              </div>
              <div style={styles.goalBar}>
                <div
                  style={{
                    ...styles.goalBarFill,
                    width: `${Math.min(
                      ((stats?.daily_completed || 0) / (stats?.daily_target || 1)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div style={styles.goalItem}>
              <div style={styles.goalHeader}>
                <span>Weekly Target</span>
                <span>
                  {stats?.weekly_completed || 0} / {stats?.weekly_target || 0}
                </span>
              </div>
              <div style={styles.goalBar}>
                <div
                  style={{
                    ...styles.goalBarFill,
                    width: `${Math.min(
                      ((stats?.weekly_completed || 0) / (stats?.weekly_target || 1)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div style={styles.goalItem}>
              <div style={styles.goalHeader}>
                <span>Monthly Target</span>
                <span>
                  {stats?.monthly_completed || 0} / {stats?.monthly_target || 0}
                </span>
              </div>
              <div style={styles.goalBar}>
                <div
                  style={{
                    ...styles.goalBarFill,
                    width: `${Math.min(
                      ((stats?.monthly_completed || 0) / (stats?.monthly_target || 1)) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Response Rates Tab */}
      {activeTab === "response" && responseRates && (
        <div style={styles.analyticsSection}>
          <div style={styles.analyticsHeader}>
            <h2 style={styles.analyticsTitle}>Response Rate Analytics</h2>
            <div style={styles.overallRate}>
              <span style={styles.rateValue}>{responseRates.overall_response_rate}%</span>
              <span style={styles.rateLabel}>Overall Response Rate</span>
            </div>
          </div>

          <div style={styles.analyticsGrid}>
            {/* Response Breakdown */}
            <div style={styles.analyticsCard}>
              <h3 style={styles.cardTitle}>Response Status Breakdown</h3>
              {Object.entries(responseRates.response_breakdown).map(([status, data]) => (
                <div key={status} style={styles.barRow}>
                  <span style={styles.barLabel}>{status.replace("_", " ")}</span>
                  <div style={styles.barContainer}>
                    <div
                      style={{
                        ...styles.barFill,
                        width: `${data.percentage}%`,
                        background: status === "interested" ? "#10b981" : status === "replied" ? "#3b82f6" : "#9ca3af",
                      }}
                    />
                  </div>
                  <span style={styles.barValue}>{data.count} ({data.percentage}%)</span>
                </div>
              ))}
            </div>

            {/* By Source */}
            <div style={styles.analyticsCard}>
              <h3 style={styles.cardTitle}>Response Rate by Source</h3>
              {Object.entries(responseRates.by_source).map(([source, data]) => (
                <div key={source} style={styles.sourceRow}>
                  <span style={styles.sourceName}>{source}</span>
                  <span style={styles.sourceRate}>{data.response_rate}%</span>
                  <span style={styles.sourceCount}>({data.total} leads)</span>
                </div>
              ))}
            </div>

            {/* By Service */}
            <div style={styles.analyticsCard}>
              <h3 style={styles.cardTitle}>Response Rate by Service</h3>
              {Object.entries(responseRates.by_service).map(([service, data]) => (
                <div key={service} style={styles.sourceRow}>
                  <span style={styles.sourceName}>{service}</span>
                  <span style={styles.sourceRate}>{data.response_rate}%</span>
                  <span style={styles.sourceCount}>({data.total} leads)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Pipeline Tab */}
      {activeTab === "revenue" && revenuePipeline && (
        <div style={styles.analyticsSection}>
          <div style={styles.analyticsHeader}>
            <h2 style={styles.analyticsTitle}>Revenue Pipeline</h2>
            <div style={styles.pipelineTotal}>
              <span style={styles.pipelineValue}>
                ${(revenuePipeline.total_pipeline_value / 1000).toFixed(0)}K
              </span>
              <span style={styles.pipelineLabel}>Total Pipeline Value</span>
            </div>
          </div>

          {/* Pipeline Stages */}
          <div style={styles.pipelineStages}>
            {revenuePipeline.by_stage.map((stage, idx) => (
              <div key={idx} style={styles.stageCard}>
                <div style={{ ...styles.stageBar, background: stage.color }} />
                <span style={styles.stageName}>{stage.stage}</span>
                <span style={styles.stageValue}>${(stage.value / 1000).toFixed(0)}K</span>
                <span style={styles.stageCount}>{stage.count} deals</span>
              </div>
            ))}
          </div>

          <div style={styles.analyticsGrid}>
            {/* By Service */}
            <div style={styles.analyticsCard}>
              <h3 style={styles.cardTitle}>By Service Category</h3>
              {Object.entries(revenuePipeline.by_service).map(([service, data]) => (
                <div key={service} style={styles.revenueRow}>
                  <span style={styles.revenueName}>{service}</span>
                  <span style={styles.revenueValue}>${(data.value / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>

            {/* By Rep */}
            <div style={styles.analyticsCard}>
              <h3 style={styles.cardTitle}>By Sales Rep</h3>
              {Object.entries(revenuePipeline.by_rep)
                .sort((a, b) => b[1].value - a[1].value)
                .slice(0, 5)
                .map(([rep, data]) => (
                <div key={rep} style={styles.revenueRow}>
                  <span style={styles.revenueName}>{rep}</span>
                  <span style={styles.revenueValue}>${(data.value / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>

            {/* Expected This Month */}
            <div style={styles.analyticsCard}>
              <h3 style={styles.cardTitle}>Expected This Month</h3>
              <div style={styles.expectedCard}>
                <span style={styles.expectedValue}>
                  ${(revenuePipeline.expected_this_month.value / 1000).toFixed(0)}K
                </span>
                <span style={styles.expectedCount}>
                  {revenuePipeline.expected_this_month.count} deals
                </span>
              </div>
            </div>
          </div>

          {/* Time to Close */}
          {timeToClose && (
            <div style={styles.timeToCloseSection}>
              <h3 style={styles.cardTitle}>Time to Close Analysis</h3>
              <div style={styles.ttcGrid}>
                <div style={styles.ttcCard}>
                  <span style={styles.ttcValue}>{timeToClose.average_days}</span>
                  <span style={styles.ttcLabel}>Avg Days to Close</span>
                </div>
                <div style={styles.ttcCard}>
                  <span style={styles.ttcValue}>{timeToClose.total_closed}</span>
                  <span style={styles.ttcLabel}>Total Closed</span>
                </div>
                {Object.entries(timeToClose.distribution).map(([range, count]) => (
                  <div key={range} style={styles.ttcCard}>
                    <span style={styles.ttcValue}>{count}</span>
                    <span style={styles.ttcLabel}>{range} days</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Service Breakdown Tab */}
      {activeTab === "service" && serviceBreakdown && (
        <div style={styles.analyticsSection}>
          <h2 style={styles.analyticsTitle}>Service Category Breakdown</h2>
          
          <div style={styles.serviceGrid}>
            {Object.entries(serviceBreakdown).map(([category, data]) => (
              <div key={category} style={styles.serviceCard}>
                <h3 style={styles.serviceName}>{category}</h3>
                <div style={styles.serviceStats}>
                  <div style={styles.serviceStat}>
                    <span style={styles.serviceStatValue}>{data.total}</span>
                    <span style={styles.serviceStatLabel}>Total Leads</span>
                  </div>
                  <div style={styles.serviceStat}>
                    <span style={styles.serviceStatValue}>{data.conversion_rate}%</span>
                    <span style={styles.serviceStatLabel}>Conversion Rate</span>
                  </div>
                  <div style={styles.serviceStat}>
                    <span style={styles.serviceStatValue}>
                      ${(data.total_value / 1000).toFixed(0)}K
                    </span>
                    <span style={styles.serviceStatLabel}>Total Value</span>
                  </div>
                </div>
                <div style={styles.serviceBreakdown}>
                  <h4 style={styles.serviceSubtitle}>By Status</h4>
                  {Object.entries(data.by_status).map(([status, count]) => (
                    <div key={status} style={styles.serviceRow}>
                      <span>{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "400px",
  },
  spinner: {
    color: "#9ca3af",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    color: "#6b7280",
    margin: "4px 0 0",
  },
  headerActions: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
  },
  periodSelector: {
    display: "flex",
    background: "#f3f4f6",
    borderRadius: "8px",
    padding: "4px",
  },
  periodBtn: {
    padding: "8px 12px",
    border: "none",
    background: "transparent",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#6b7280",
    cursor: "pointer",
  },
  periodBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  exportBtns: {
    display: "flex",
    gap: "8px",
  },
  exportBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    cursor: "pointer",
  },
  exportBtnPrimary: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "24px",
  },
  metricCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    gap: "16px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  metricIcon: {
    width: "48px",
    height: "48px",
    background: "#eef2ff",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },
  metricContent: {
    flex: 1,
  },
  metricValue: {
    display: "block",
    fontSize: "28px",
    fontWeight: 700,
    color: "#1f2937",
  },
  metricLabel: {
    display: "block",
    fontSize: "13px",
    color: "#6b7280",
    marginBottom: "8px",
  },
  metricChange: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  changePositive: {
    fontSize: "12px",
    color: "#10b981",
    fontWeight: 500,
  },
  changeLabel: {
    fontSize: "11px",
    color: "#9ca3af",
  },
  chartsRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "16px",
    marginBottom: "24px",
  },
  chartCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  chartTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px",
  },
  chartContainer: {
    height: "200px",
  },
  trendChart: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    height: "100%",
  },
  trendBar: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
  },
  trendBarFill: {
    width: "100%",
    background: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
    borderRadius: "4px 4px 0 0",
    minHeight: "4px",
    marginTop: "auto",
  },
  trendLabel: {
    fontSize: "10px",
    color: "#9ca3af",
    marginTop: "8px",
  },
  pipelineList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  pipelineItem: {},
  pipelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  pipelineStatus: {
    fontSize: "13px",
    color: "#374151",
  },
  pipelineCount: {
    fontSize: "12px",
    color: "#6b7280",
  },
  pipelineBar: {
    height: "8px",
    background: "#f3f4f6",
    borderRadius: "4px",
    overflow: "hidden",
  },
  pipelineBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
    borderRadius: "4px",
  },
  tableCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    marginBottom: "24px",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  tableTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  tableFilter: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  th: {
    textAlign: "left" as const,
    padding: "12px 16px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    borderBottom: "1px solid #e5e7eb",
  },
  tr: {
    borderBottom: "1px solid #f3f4f6",
  },
  td: {
    padding: "16px",
    fontSize: "14px",
    color: "#374151",
  },
  rank: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#667eea",
  },
  repCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  repAvatar: {
    width: "32px",
    height: "32px",
    background: "#eef2ff",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: 600,
    color: "#667eea",
  },
  repName: {
    fontWeight: 500,
  },
  conversionBadge: {
    background: "#d1fae5",
    color: "#059669",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 500,
  },
  breakdownRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  breakdownCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  breakdownTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px",
  },
  breakdownList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  breakdownItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    background: "#f9fafb",
    borderRadius: "8px",
  },
  breakdownType: {
    fontSize: "14px",
    color: "#374151",
  },
  breakdownCount: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  goalList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  goalItem: {},
  goalHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    fontSize: "13px",
    color: "#374151",
  },
  goalBar: {
    height: "8px",
    background: "#f3f4f6",
    borderRadius: "4px",
    overflow: "hidden",
  },
  goalBarFill: {
    height: "100%",
    background: "#10b981",
    borderRadius: "4px",
  },
  // Tab styles
  tabContainer: {
    display: "flex",
    gap: "4px",
    marginBottom: "24px",
    background: "#f3f4f6",
    padding: "4px",
    borderRadius: "12px",
    width: "fit-content",
  },
  tabBtn: {
    padding: "10px 20px",
    border: "none",
    background: "transparent",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#6b7280",
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  // Analytics styles
  analyticsSection: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  analyticsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  analyticsTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  overallRate: {
    textAlign: "right" as const,
  },
  rateValue: {
    display: "block",
    fontSize: "32px",
    fontWeight: 700,
    color: "#10b981",
  },
  rateLabel: {
    fontSize: "13px",
    color: "#6b7280",
  },
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
  },
  analyticsCard: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "20px",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: "16px",
  },
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  barLabel: {
    width: "100px",
    fontSize: "13px",
    color: "#374151",
    textTransform: "capitalize" as const,
  },
  barContainer: {
    flex: 1,
    height: "8px",
    background: "#e5e7eb",
    borderRadius: "4px",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: "4px",
  },
  barValue: {
    fontSize: "12px",
    color: "#6b7280",
    width: "80px",
    textAlign: "right" as const,
  },
  sourceRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  sourceName: {
    flex: 1,
    fontSize: "14px",
    color: "#374151",
  },
  sourceRate: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#10b981",
    marginRight: "12px",
  },
  sourceCount: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  // Revenue Pipeline styles
  pipelineTotal: {
    textAlign: "right" as const,
  },
  pipelineValue: {
    display: "block",
    fontSize: "32px",
    fontWeight: 700,
    color: "#667eea",
  },
  pipelineLabel: {
    fontSize: "13px",
    color: "#6b7280",
  },
  pipelineStages: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
    overflowX: "auto" as const,
    paddingBottom: "8px",
  },
  stageCard: {
    minWidth: "140px",
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "center" as const,
  },
  stageBar: {
    height: "4px",
    borderRadius: "2px",
    marginBottom: "12px",
  },
  stageName: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1f2937",
    marginBottom: "4px",
  },
  stageValue: {
    display: "block",
    fontSize: "18px",
    fontWeight: 700,
    color: "#374151",
  },
  stageCount: {
    fontSize: "11px",
    color: "#9ca3af",
  },
  revenueRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  revenueName: {
    fontSize: "14px",
    color: "#374151",
  },
  revenueValue: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#10b981",
  },
  expectedCard: {
    textAlign: "center" as const,
    padding: "20px",
  },
  expectedValue: {
    display: "block",
    fontSize: "28px",
    fontWeight: 700,
    color: "#10b981",
    marginBottom: "4px",
  },
  expectedCount: {
    fontSize: "14px",
    color: "#6b7280",
  },
  timeToCloseSection: {
    marginTop: "24px",
    padding: "20px",
    background: "#f9fafb",
    borderRadius: "12px",
  },
  ttcGrid: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap" as const,
  },
  ttcCard: {
    flex: "1 1 100px",
    textAlign: "center" as const,
    padding: "16px",
    background: "#fff",
    borderRadius: "8px",
  },
  ttcValue: {
    display: "block",
    fontSize: "24px",
    fontWeight: 700,
    color: "#374151",
  },
  ttcLabel: {
    fontSize: "12px",
    color: "#6b7280",
  },
  // Service breakdown styles
  serviceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginTop: "24px",
  },
  serviceCard: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "20px",
  },
  serviceName: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px",
  },
  serviceStats: {
    display: "flex",
    gap: "16px",
    marginBottom: "16px",
  },
  serviceStat: {
    flex: 1,
    textAlign: "center" as const,
    padding: "12px",
    background: "#fff",
    borderRadius: "8px",
  },
  serviceStatValue: {
    display: "block",
    fontSize: "18px",
    fontWeight: 700,
    color: "#374151",
  },
  serviceStatLabel: {
    fontSize: "11px",
    color: "#6b7280",
  },
  serviceBreakdown: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: "12px",
  },
  serviceSubtitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    margin: "0 0 8px",
    textTransform: "uppercase" as const,
  },
  serviceRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#374151",
    padding: "4px 0",
  },
};

export default Reports;
