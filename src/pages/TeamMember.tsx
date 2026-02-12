import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Lead, TrendDataPoint } from '../types';

interface TeamMemberProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  title: string | null;
  bio: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
  permissions: string[];
}

interface DashboardData {
  member: TeamMemberProfile;
  metrics: {
    activities: number;
    calls: number;
    emails: number;
    meetings: number;
    leads_assigned: number;
    conversions: number;
    conversion_rate: number;
    proposals_sent: number;
    proposals_won: number;
    revenue: number;
  };
  pipeline: Record<string, { count: number; value: number }>;
  recent_activities: Array<{
    id: number;
    activity_type: string;
    outcome: string;
    timestamp: string;
    lead_id: number;
  }>;
  pending_reminders: Array<{
    id: number;
    title: string;
    due_date: string;
    type: string;
  }>;
  targets: {
    calls: number;
    emails: number;
    meetings: number;
    conversions: number;
    revenue: number;
  };
}

export function TeamMember() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activityTrend, setActivityTrend] = useState<TrendDataPoint[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('week');
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'activity'>('overview');

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [dashboardRes, trendRes, leadsRes] = await Promise.all([
        fetch(`/api/team/${id}/dashboard?timeframe=${timeframe}`),
        fetch(`/api/team/${id}/activity-trend?days=14`),
        fetch(`/api/team/${id}/leads`),
      ]);

      if (dashboardRes.ok) setDashboardData(await dashboardRes.json());
      if (trendRes.ok) setActivityTrend(await trendRes.json());
      if (leadsRes.ok) setLeads(await leadsRes.json());
    } catch (err) {
      console.error('Failed to fetch team member data:', err);
      setError('Failed to load team member dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getProgressWidth = (value: number, target: number) => {
    return Math.min((value / target) * 100, 100);
  };

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <span style={styles.loadingSpinner}>⏳</span>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div style={styles.errorState}>
        <span style={styles.errorIcon}>⚠️</span>
        <p>{error || 'Team member not found'}</p>
        <button onClick={() => navigate('/performance')} style={styles.backBtn}>Back to Team</button>
      </div>
    );
  }

  const { member, metrics, targets, recent_activities, pending_reminders } = dashboardData;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backLink}>← Back</button>
        <div style={styles.profileHeader}>
          <div style={styles.avatar}>
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.name} style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarInitial}>{member.name.charAt(0)}</span>
            )}
          </div>
          <div style={styles.profileInfo}>
            <h1 style={styles.name}>{member.name}</h1>
            <p style={styles.title}>{member.title || member.role}</p>
            <div style={styles.badges}>
              <span style={styles.roleBadge}>{member.role}</span>
              {member.department && <span style={styles.deptBadge}>{member.department}</span>}
            </div>
          </div>
        </div>
        <div style={styles.timeframeSelector}>
          {['today', 'week', 'month', 'quarter'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                ...styles.timeframeBtn,
                ...(timeframe === tf ? styles.timeframeBtnActive : {}),
              }}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['overview', 'leads', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'leads' && `👥 Leads (${metrics.leads_assigned})`}
            {tab === 'activity' && '📝 Activity'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Metrics Grid */}
          <div style={styles.metricsGrid}>
            <MetricCard
              label="Activities"
              value={metrics.activities}
              target={targets.calls + targets.emails}
              color="#667eea"
            />
            <MetricCard
              label="Calls"
              value={metrics.calls}
              target={targets.calls}
              color="#10b981"
            />
            <MetricCard
              label="Emails"
              value={metrics.emails}
              target={targets.emails}
              color="#f59e0b"
            />
            <MetricCard
              label="Meetings"
              value={metrics.meetings}
              target={targets.meetings}
              color="#8b5cf6"
            />
            <MetricCard
              label="Conversions"
              value={metrics.conversions}
              target={targets.conversions}
              color="#06b6d4"
            />
            <MetricCard
              label="Revenue"
              value={metrics.revenue}
              target={targets.revenue}
              format="currency"
              color="#22c55e"
            />
          </div>

          {/* Activity Trend Chart */}
          <div style={styles.trendCard}>
            <h3 style={styles.cardTitle}>Activity Trend (Last 14 Days)</h3>
            <div style={styles.trendChart}>
              {activityTrend.map((day, idx) => (
                <div key={idx} style={styles.trendBar}>
                  <div style={styles.barContainer}>
                    <div
                      style={{
                        ...styles.bar,
                        height: `${Math.min((day.activities / 20) * 100, 100)}%`,
                        background: day.activities > 10 ? '#10b981' : day.activities > 5 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span style={styles.barLabel}>{day.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Two Column Layout */}
          <div style={styles.twoColumn}>
            {/* Pending Reminders */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Pending Reminders</h3>
              {pending_reminders.length === 0 ? (
                <p style={styles.emptyText}>No pending reminders</p>
              ) : (
                <div style={styles.reminderList}>
                  {pending_reminders.map((reminder) => (
                    <div key={reminder.id} style={styles.reminderItem}>
                      <span style={styles.reminderIcon}>🔔</span>
                      <div style={styles.reminderContent}>
                        <span style={styles.reminderTitle}>{reminder.title}</span>
                        <span style={styles.reminderDue}>{formatDate(reminder.due_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activities */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Recent Activities</h3>
              {recent_activities.length === 0 ? (
                <p style={styles.emptyText}>No recent activities</p>
              ) : (
                <div style={styles.activityList}>
                  {recent_activities.map((activity) => (
                    <div key={activity.id} style={styles.activityItem}>
                      <span style={styles.activityIcon}>
                        {activity.activity_type === 'Call' ? '📞' : activity.activity_type === 'Email' ? '📧' : '📋'}
                      </span>
                      <div style={styles.activityContent}>
                        <span style={styles.activityType}>{activity.activity_type}</span>
                        <span style={styles.activityOutcome}>{activity.outcome}</span>
                      </div>
                      <span style={styles.activityTime}>{formatDate(activity.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'leads' && (
        <div style={styles.leadsGrid}>
          {leads.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>👥</span>
              <p>No leads assigned</p>
            </div>
          ) : (
            leads.map((lead) => (
              <motion.div
                key={lead.id}
                style={styles.leadCard}
                whileHover={{ scale: 1.01 }}
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <div style={styles.leadHeader}>
                  <span style={styles.leadName}>{lead.business_name}</span>
                  <span style={{
                    ...styles.leadStatus,
                    background: lead.status === 'Converted' ? '#d1fae5' : '#f3f4f6',
                    color: lead.status === 'Converted' ? '#059669' : '#6b7280',
                  }}>{lead.status}</span>
                </div>
                <p style={styles.leadContact}>{lead.contact_name || 'No contact'}</p>
                {lead.deal_value && (
                  <p style={styles.leadValue}>{formatCurrency(lead.deal_value)}</p>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div style={styles.fullActivityList}>
          {recent_activities.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📝</span>
              <p>No activities logged</p>
            </div>
          ) : (
            recent_activities.map((activity) => (
              <div key={activity.id} style={styles.fullActivityItem}>
                <span style={styles.activityIcon}>
                  {activity.activity_type === 'Call' ? '📞' : activity.activity_type === 'Email' ? '📧' : '📋'}
                </span>
                <div style={styles.activityContent}>
                  <span style={styles.activityType}>{activity.activity_type}</span>
                  <span style={styles.activityOutcome}>{activity.outcome}</span>
                  <Link to={`/leads/${activity.lead_id}`} style={styles.leadLink}>View Lead →</Link>
                </div>
                <span style={styles.activityTime}>{formatDate(activity.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  target,
  color,
  format = 'number',
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  format?: 'number' | 'currency';
}) {
  const displayValue = format === 'currency' 
    ? (value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`)
    : value;
  const displayTarget = format === 'currency'
    ? (target >= 1000 ? `$${(target / 1000).toFixed(0)}K` : `$${target}`)
    : target;
  const progress = Math.min((value / target) * 100, 100);

  return (
    <motion.div
      style={styles.metricCard}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color }}>{displayValue}</span>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${progress}%`, background: color }} />
      </div>
      <span style={styles.metricTarget}>Target: {displayTarget}</span>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1344px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '16px',
    display: 'block',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '20px',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  avatarInitial: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#fff',
  },
  profileInfo: {},
  name: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1f2937',
    margin: '0 0 4px',
  },
  title: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 8px',
    textTransform: 'capitalize' as const,
  },
  badges: {
    display: 'flex',
    gap: '8px',
  },
  roleBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    background: '#eef2ff',
    color: '#4f46e5',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'capitalize' as const,
  },
  deptBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    background: '#f3f4f6',
    color: '#374151',
    fontSize: '12px',
  },
  timeframeSelector: {
    display: 'flex',
    gap: '8px',
  },
  timeframeBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#6b7280',
  },
  timeframeBtnActive: {
    background: '#667eea',
    color: '#fff',
    borderColor: '#667eea',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    background: '#f3f4f6',
    padding: '4px',
    borderRadius: '12px',
    width: 'fit-content',
  },
  tab: {
    padding: '10px 20px',
    border: 'none',
    background: 'transparent',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280',
    cursor: 'pointer',
  },
  tabActive: {
    background: '#fff',
    color: '#1f2937',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  metricCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  metricLabel: {
    fontSize: '12px',
    color: '#6b7280',
    display: 'block',
    marginBottom: '8px',
  },
  metricValue: {
    fontSize: '28px',
    fontWeight: 700,
    display: 'block',
    marginBottom: '12px',
  },
  progressBar: {
    height: '6px',
    background: '#e5e7eb',
    borderRadius: '3px',
    marginBottom: '8px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  metricTarget: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  trendCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    margin: '0 0 16px',
  },
  trendChart: {
    display: 'flex',
    gap: '8px',
    height: '120px',
    alignItems: 'flex-end',
  },
  trendBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  barContainer: {
    width: '100%',
    height: '80px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    width: '60%',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease',
  },
  barLabel: {
    fontSize: '10px',
    color: '#9ca3af',
    marginTop: '8px',
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: '14px',
    textAlign: 'center' as const,
    padding: '20px',
  },
  reminderList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  reminderItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#fef3c7',
    borderRadius: '8px',
  },
  reminderIcon: {
    fontSize: '16px',
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#1f2937',
  },
  reminderDue: {
    fontSize: '11px',
    color: '#6b7280',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  activityItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '8px',
  },
  activityIcon: {
    fontSize: '16px',
  },
  activityContent: {
    flex: 1,
  },
  activityType: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#1f2937',
  },
  activityOutcome: {
    fontSize: '11px',
    color: '#6b7280',
  },
  activityTime: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  leadsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  leadCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    cursor: 'pointer',
  },
  leadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  leadName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
  },
  leadStatus: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
  },
  leadContact: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 4px',
  },
  leadValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#10b981',
    margin: 0,
  },
  fullActivityList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  fullActivityItem: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    padding: '16px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  leadLink: {
    display: 'block',
    fontSize: '12px',
    color: '#667eea',
    textDecoration: 'none',
    marginTop: '4px',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: '#6b7280',
  },
  loadingSpinner: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: '#dc2626',
  },
  errorIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  backBtn: {
    marginTop: '12px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#667eea',
    color: '#fff',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#9ca3af',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '12px',
  },
};

export default TeamMember;
