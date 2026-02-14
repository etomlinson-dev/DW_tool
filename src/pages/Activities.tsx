import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { activitiesApi, leadsApi, teamApi, type Activity as APIActivity, type Lead } from "../api/client";

// Activity types for UI
interface Activity {
  id: number;
  leadId: number;
  leadName: string;
  type: "Call" | "Email" | "Meeting" | "Note" | "Task" | "Proposal";
  outcome: string;
  rep: string;
  timestamp: string;
  duration?: number;
  notes: string;
  emailSubject?: string;
  emailOpened?: boolean;
  emailClicked?: boolean;
}

// Map API activity to UI format
const mapApiToActivity = (a: APIActivity): Activity => ({
  id: a.id,
  leadId: a.lead_id,
  leadName: a.lead_name || "Unknown",
  type: (a.activity_type as Activity["type"]) || "Note",
  outcome: a.outcome || "",
  rep: a.assigned_rep || "",
  timestamp: a.timestamp || new Date().toISOString(),
  duration: a.call_duration,
  notes: a.notes || "",
  emailSubject: a.email_subject,
  emailOpened: a.email_opened,
  emailClicked: a.email_clicked,
});

const ACTIVITY_TYPES = ["All", "Call", "Email", "Meeting", "Note", "Task", "Proposal"];
const OUTCOMES = ["All", "Connected", "No Answer", "Sent", "Replied", "Completed", "Added"];

export function Activities() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // New activity form
  const [newActivity, setNewActivity] = useState({
    lead_id: 0,
    leadName: "",
    activity_type: "Call" as Activity["type"],
    outcome: "Connected",
    notes: "",
    call_duration: "",
    email_subject: "",
  });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [repFilter, setRepFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("today");

  // Fetch activities from API
  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activitiesApi.getActivities({ date: dateFilter === "all" ? undefined : dateFilter });
      setActivities(data.map(mapApiToActivity));
    } catch (err) {
      console.error("Failed to fetch activities:", err);
      setError("Failed to load activities. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  // Fetch leads for the dropdown
  const fetchLeads = useCallback(async () => {
    try {
      const data = await leadsApi.getLeads({ per_page: 200 });
      setLeads(data.data || []);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchLeads();
  }, [fetchActivities, fetchLeads]);

  // Outcome options based on activity type
  const getOutcomeOptions = (type: Activity["type"]) => {
    switch (type) {
      case "Call": return ["Connected", "No Answer", "Left Voicemail", "Busy", "Wrong Number"];
      case "Email": return ["Sent", "Replied", "Bounced", "Opened"];
      case "Meeting": return ["Completed", "Cancelled", "Rescheduled", "No Show"];
      case "Note": return ["Added"];
      case "Task": return ["Completed", "In Progress", "Deferred"];
      case "Proposal": return ["Sent", "Accepted", "Rejected", "Revised"];
      default: return ["Completed"];
    }
  };

  // Filter leads for search
  const filteredLeads = leads.filter((l) =>
    (l.business_name || "").toLowerCase().includes(leadSearch.toLowerCase()) ||
    (l.contact_name || "").toLowerCase().includes(leadSearch.toLowerCase())
  );

  const handleDeleteActivity = async (id: number) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;
    try {
      await activitiesApi.deleteActivity(id);
      setActivities(activities.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete activity:", err);
      alert("Failed to delete activity.");
    }
  };

  const handleLogActivity = async () => {
    if (!newActivity.lead_id) {
      alert("Please select a lead");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        lead_id: newActivity.lead_id,
        activity_type: newActivity.activity_type,
        outcome: newActivity.outcome,
        notes: newActivity.notes,
      };

      if (newActivity.activity_type === "Call" && newActivity.call_duration) {
        payload.call_duration = parseInt(newActivity.call_duration);
      }
      if (newActivity.activity_type === "Email" && newActivity.email_subject) {
        payload.email_subject = newActivity.email_subject;
      }

      const created = await activitiesApi.createActivity(payload as Parameters<typeof activitiesApi.createActivity>[0]);
      const mapped = mapApiToActivity(created);
      setActivities([mapped, ...activities]);
      setShowLogModal(false);
      setNewActivity({
        lead_id: 0,
        leadName: "",
        activity_type: "Call",
        outcome: "Connected",
        notes: "",
        call_duration: "",
        email_subject: "",
      });
      setLeadSearch("");
    } catch (err) {
      console.error("Failed to log activity:", err);
      alert("Failed to log activity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const todayActivities = activities.filter((a) => {
    const today = new Date().toDateString();
    return new Date(a.timestamp).toDateString() === today;
  });

  const stats = {
    total: todayActivities.length,
    calls: todayActivities.filter((a) => a.type === "Call").length,
    emails: todayActivities.filter((a) => a.type === "Email").length,
    meetings: todayActivities.filter((a) => a.type === "Meeting").length,
  };

  const reps = [...new Set(activities.map((a) => a.rep))];

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      activity.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.rep.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "All" || activity.type === typeFilter;
    const matchesRep = repFilter === "All" || activity.rep === repFilter;
    
    // Date filter
    const activityDate = new Date(activity.timestamp);
    const now = new Date();
    let matchesDate = true;
    if (dateFilter === "today") {
      matchesDate = activityDate.toDateString() === now.toDateString();
    } else if (dateFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = activityDate >= weekAgo;
    } else if (dateFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = activityDate >= monthAgo;
    }
    
    return matchesSearch && matchesType && matchesRep && matchesDate;
  });

  const getTypeIcon = (type: Activity["type"]) => {
    switch (type) {
      case "Call": return "📞";
      case "Email": return "✉️";
      case "Meeting": return "📅";
      case "Note": return "📝";
      case "Task": return "✅";
      case "Proposal": return "📄";
      default: return "📋";
    }
  };

  const getTypeColor = (type: Activity["type"]) => {
    switch (type) {
      case "Call": return { bg: "#dcfce7", color: "#166534" };
      case "Email": return { bg: "#dbeafe", color: "#1d4ed8" };
      case "Meeting": return { bg: "#fef3c7", color: "#92400e" };
      case "Note": return { bg: "#f3f4f6", color: "#374151" };
      case "Task": return { bg: "#e0e7ff", color: "#4338ca" };
      case "Proposal": return { bg: "#fce7f3", color: "#be185d" };
      default: return { bg: "#f3f4f6", color: "#6b7280" };
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "Connected":
      case "Completed":
      case "Replied":
        return { bg: "#dcfce7", color: "#166534" };
      case "No Answer":
        return { bg: "#fef3c7", color: "#92400e" };
      case "Sent":
      case "Added":
        return { bg: "#dbeafe", color: "#1d4ed8" };
      default:
        return { bg: "#f3f4f6", color: "#6b7280" };
    }
  };

  const formatTime = (timestamp: string) => {
    const utc = timestamp.endsWith("Z") ? timestamp : timestamp + "Z";
    const date = new Date(utc);
    return date.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true });
  };

  const formatDate = (timestamp: string) => {
    const utc = timestamp.endsWith("Z") ? timestamp : timestamp + "Z";
    const date = new Date(utc);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
  };

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = formatDate(activity.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

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
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 style={styles.title}>Activity Log</h1>
          <p style={styles.subtitle}>Track all sales activities across your team</p>
        </div>
        <motion.button 
          onClick={() => setShowLogModal(true)}
          style={styles.primaryBtn}
          whileHover={{ scale: 1.05, boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)" }}
          whileTap={{ scale: 0.95 }}
        >
          + Log Activity
        </motion.button>
      </motion.div>

      {/* Stats Row */}
      <motion.div 
        style={styles.statsRow}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {[
          { icon: "📊", value: stats.total, label: "Today's Activities" },
          { icon: "📞", value: stats.calls, label: "Calls Made" },
          { icon: "✉️", value: stats.emails, label: "Emails Sent" },
          { icon: "📅", value: stats.meetings, label: "Meetings" },
        ].map((stat, index) => (
          <motion.div 
            key={stat.label}
            style={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ scale: 1.02, boxShadow: "0 8px 25px rgba(0, 0, 0, 0.1)" }}
          >
            <span style={styles.statIcon}>{stat.icon}</span>
            <div>
              <span style={styles.statValue}>{stat.value}</span>
              <span style={styles.statLabel}>{stat.label}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div 
        style={styles.filtersCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div style={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          
          <div style={styles.filterGroup}>
            <div style={styles.dateButtons}>
              {(["today", "week", "month", "all"] as const).map((period) => (
                <motion.button
                  key={period}
                  onClick={() => setDateFilter(period)}
                  style={{
                    ...styles.dateBtn,
                    ...(dateFilter === period ? styles.dateBtnActive : {}),
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {period === "today" ? "Today" : period === "week" ? "This Week" : period === "month" ? "This Month" : "All Time"}
                </motion.button>
              ))}
            </div>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={styles.filterSelect}
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "All" ? "All Types" : type}
              </option>
            ))}
          </select>

          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="All">All Reps</option>
            {reps.map((rep) => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Activity Timeline */}
      <motion.div 
        style={styles.timelineContainer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {Object.entries(groupedActivities).map(([date, dateActivities], groupIndex) => (
          <motion.div 
            key={date} 
            style={styles.dateGroup}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + groupIndex * 0.1 }}
          >
            <div style={styles.dateHeader}>
              <span style={styles.dateBadge}>{date}</span>
              <span style={styles.dateCount}>{dateActivities.length} activities</span>
            </div>
            
            <div style={styles.activitiesList}>
              {dateActivities.map((activity, activityIndex) => (
                <motion.div 
                  key={activity.id} 
                  style={styles.activityCard}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + activityIndex * 0.05 }}
                  whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)" }}
                >
                  <div style={styles.activityLeft}>
                    <div style={{
                      ...styles.activityIcon,
                      background: getTypeColor(activity.type).bg,
                    }}>
                      {getTypeIcon(activity.type)}
                    </div>
                    <div style={styles.activityTimeline}>
                      <div style={styles.timelineLine} />
                    </div>
                  </div>
                  
                  <div style={styles.activityContent}>
                    <div style={styles.activityHeader}>
                      <div style={styles.activityMeta}>
                        <span style={{
                          ...styles.typeBadge,
                          background: getTypeColor(activity.type).bg,
                          color: getTypeColor(activity.type).color,
                        }}>
                          {activity.type}
                        </span>
                        <span style={{
                          ...styles.outcomeBadge,
                          background: getOutcomeColor(activity.outcome).bg,
                          color: getOutcomeColor(activity.outcome).color,
                        }}>
                          {activity.outcome}
                        </span>
                        {activity.duration && (
                          <span style={styles.duration}>{activity.duration} min</span>
                        )}
                      </div>
                      <span style={styles.time}>{formatTime(activity.timestamp)}</span>
                    </div>
                    
                    <div style={styles.activityBody}>
                      <Link to={`/lead/${activity.leadId}`} style={styles.leadLink}>
                        {activity.leadName}
                      </Link>
                      <p style={styles.notes}>{activity.notes}</p>
                      
                      {activity.emailSubject && (
                        <div style={styles.emailInfo}>
                          <span style={styles.emailSubject}>📧 {activity.emailSubject}</span>
                          <div style={styles.emailStats}>
                            <span style={{
                              ...styles.emailStat,
                              color: activity.emailOpened ? "#16a34a" : "#9ca3af",
                            }}>
                              {activity.emailOpened ? "✓ Opened" : "Not opened"}
                            </span>
                            <span style={{
                              ...styles.emailStat,
                              color: activity.emailClicked ? "#16a34a" : "#9ca3af",
                            }}>
                              {activity.emailClicked ? "✓ Clicked" : "No clicks"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div style={styles.activityFooter}>
                      <span style={styles.repName}>👤 {activity.rep}</span>
                      <div style={styles.activityActions}>
                        <motion.button 
                          onClick={() => navigate(`/lead/${activity.leadId}`)}
                          style={styles.actionBtn}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          View Lead
                        </motion.button>
                        <motion.button 
                          onClick={() => {
                            setNewActivity({
                              lead_id: activity.leadId,
                              leadName: activity.leadName,
                              activity_type: activity.type,
                              outcome: activity.outcome,
                              notes: activity.notes,
                              call_duration: activity.duration ? String(activity.duration) : "",
                              email_subject: activity.emailSubject || "",
                            });
                            setShowLogModal(true);
                          }}
                          style={styles.actionBtn}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Edit
                        </motion.button>
                        <motion.button 
                          onClick={() => handleDeleteActivity(activity.id)}
                          style={styles.deleteActionBtn}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          🗑️
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}

        {filteredActivities.length === 0 && (
          <motion.div 
            style={styles.emptyState}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span style={styles.emptyIcon}>📋</span>
            <h3 style={styles.emptyTitle}>No activities found</h3>
            <p style={styles.emptyText}>Try adjusting your filters or log a new activity</p>
          </motion.div>
        )}
      </motion.div>

      {/* Log Activity Modal */}
      {showLogModal && (
        <div
          style={styles.modalOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogModal(false); }}
        >
          <motion.div 
            style={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Log Activity</h2>
              <button onClick={() => setShowLogModal(false)} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              {/* Lead Selection */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Lead / Company *</label>
                {newActivity.lead_id ? (
                  <div style={styles.selectedLead}>
                    <span style={styles.selectedLeadName}>{newActivity.leadName}</span>
                    <button
                      onClick={() => { setNewActivity({ ...newActivity, lead_id: 0, leadName: "" }); setLeadSearch(""); }}
                      style={styles.clearLeadBtn}
                    >✕</button>
                  </div>
                ) : (
                  <div style={styles.leadSearchContainer}>
                    <input
                      type="text"
                      placeholder="Search for a lead..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      style={styles.formInput}
                      autoFocus
                    />
                    {leadSearch.length > 0 && (
                      <div style={styles.leadDropdown}>
                        {filteredLeads.slice(0, 8).map((lead) => (
                          <div
                            key={lead.id}
                            onClick={() => {
                              setNewActivity({ ...newActivity, lead_id: lead.id!, leadName: lead.business_name || lead.contact_name || "Unknown" });
                              setLeadSearch("");
                            }}
                            style={styles.leadOption}
                          >
                            <span style={styles.leadOptionName}>{lead.business_name}</span>
                            {lead.contact_name && <span style={styles.leadOptionContact}>{lead.contact_name}</span>}
                          </div>
                        ))}
                        {filteredLeads.length === 0 && (
                          <div style={styles.noLeadsFound}>No leads found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Activity Type */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Activity Type</label>
                <div style={styles.typeGrid}>
                  {(["Call", "Email", "Meeting", "Note", "Task", "Proposal"] as Activity["type"][]).map((type) => (
                    <motion.button
                      key={type}
                      onClick={() => setNewActivity({ ...newActivity, activity_type: type, outcome: getOutcomeOptions(type)[0] })}
                      style={{
                        ...styles.typeOption,
                        ...(newActivity.activity_type === type ? {
                          background: getTypeColor(type).bg,
                          color: getTypeColor(type).color,
                          borderColor: getTypeColor(type).color,
                        } : {}),
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {getTypeIcon(type)} {type}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Outcome */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Outcome</label>
                <select
                  value={newActivity.outcome}
                  onChange={(e) => setNewActivity({ ...newActivity, outcome: e.target.value })}
                  style={styles.formSelect}
                >
                  {getOutcomeOptions(newActivity.activity_type).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Call Duration (only for calls) */}
              {newActivity.activity_type === "Call" && (
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Call Duration (minutes)</label>
                  <input
                    type="number"
                    value={newActivity.call_duration}
                    onChange={(e) => setNewActivity({ ...newActivity, call_duration: e.target.value })}
                    placeholder="e.g. 15"
                    style={styles.formInput}
                    min="0"
                  />
                </div>
              )}

              {/* Email Subject (only for emails) */}
              {newActivity.activity_type === "Email" && (
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Email Subject</label>
                  <input
                    type="text"
                    value={newActivity.email_subject}
                    onChange={(e) => setNewActivity({ ...newActivity, email_subject: e.target.value })}
                    placeholder="Subject line..."
                    style={styles.formInput}
                  />
                </div>
              )}

              {/* Notes */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Notes</label>
                <textarea
                  value={newActivity.notes}
                  onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })}
                  placeholder="What happened? Key takeaways, next steps..."
                  rows={4}
                  style={styles.formTextarea}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <motion.button 
                onClick={() => setShowLogModal(false)} 
                style={styles.cancelBtn}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
              <motion.button 
                onClick={handleLogActivity} 
                style={{
                  ...styles.submitBtn,
                  opacity: submitting ? 0.7 : 1,
                }}
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.02, boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)" }}
                whileTap={{ scale: submitting ? 1 : 0.98 }}
              >
                {submitting ? "Logging..." : "Log Activity"}
              </motion.button>
            </div>
          </motion.div>
        </div>
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
  primaryBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "24px",
  },
  statCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  statIcon: {
    fontSize: "28px",
  },
  statValue: {
    display: "block",
    fontSize: "24px",
    fontWeight: 700,
    color: "#1f2937",
  },
  statLabel: {
    fontSize: "13px",
    color: "#6b7280",
  },
  filtersCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "16px 20px",
    marginBottom: "24px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  filtersRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    width: "250px",
  },
  filterGroup: {
    flex: 1,
  },
  dateButtons: {
    display: "flex",
    gap: "4px",
    background: "#f3f4f6",
    padding: "4px",
    borderRadius: "8px",
  },
  dateBtn: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  dateBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
  },
  filterSelect: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    minWidth: "140px",
  },
  timelineContainer: {},
  dateGroup: {
    marginBottom: "24px",
  },
  dateHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  dateBadge: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    background: "#f3f4f6",
    padding: "6px 12px",
    borderRadius: "6px",
  },
  dateCount: {
    fontSize: "13px",
    color: "#9ca3af",
  },
  activitiesList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  activityCard: {
    display: "flex",
    gap: "16px",
    background: "#fff",
    borderRadius: "12px",
    padding: "16px 20px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  activityLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  activityIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },
  activityTimeline: {
    flex: 1,
    width: "2px",
    position: "relative",
    marginTop: "8px",
  },
  timelineLine: {
    position: "absolute",
    top: 0,
    bottom: "-12px",
    left: "50%",
    width: "2px",
    background: "#e5e7eb",
    transform: "translateX(-50%)",
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  activityMeta: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  typeBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
  },
  outcomeBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
  },
  duration: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  time: {
    fontSize: "13px",
    color: "#6b7280",
  },
  activityBody: {
    marginBottom: "12px",
  },
  leadLink: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1f2937",
    textDecoration: "none",
  },
  notes: {
    fontSize: "14px",
    color: "#4b5563",
    margin: "6px 0 0",
    lineHeight: 1.5,
  },
  emailInfo: {
    marginTop: "10px",
    padding: "10px 12px",
    background: "#f9fafb",
    borderRadius: "8px",
  },
  emailSubject: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "6px",
  },
  emailStats: {
    display: "flex",
    gap: "16px",
  },
  emailStat: {
    fontSize: "12px",
  },
  activityFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "12px",
    borderTop: "1px solid #f3f4f6",
  },
  repName: {
    fontSize: "13px",
    color: "#6b7280",
  },
  activityActions: {
    display: "flex",
    gap: "8px",
  },
  actionBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "12px",
    cursor: "pointer",
  },
  deleteActionBtn: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    fontSize: "12px",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    background: "#fff",
    borderRadius: "12px",
  },
  emptyIcon: {
    fontSize: "48px",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "16px 0 8px",
  },
  emptyText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  // Modal styles
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "24px",
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "520px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  modalClose: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "none",
    background: "#f3f4f6",
    fontSize: "14px",
    cursor: "pointer",
    color: "#6b7280",
  },
  modalBody: {
    padding: "24px",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "16px 24px",
    borderTop: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: "0 0 16px 16px",
  },
  formGroup: {
    marginBottom: "18px",
  },
  formLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "6px",
  },
  formInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    boxSizing: "border-box" as const,
  },
  formSelect: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
  },
  formTextarea: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    resize: "vertical" as const,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    lineHeight: 1.5,
  },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  typeOption: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "2px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center" as const,
  },
  leadSearchContainer: {
    position: "relative" as const,
  },
  leadDropdown: {
    position: "absolute" as const,
    top: "100%",
    left: 0,
    right: 0,
    background: "#fff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 10,
    maxHeight: "200px",
    overflowY: "auto" as const,
    marginTop: "4px",
  },
  leadOption: {
    padding: "10px 14px",
    cursor: "pointer",
    borderBottom: "1px solid #f3f4f6",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leadOptionName: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1f2937",
  },
  leadOptionContact: {
    fontSize: "12px",
    color: "#6b7280",
  },
  noLeadsFound: {
    padding: "16px",
    textAlign: "center" as const,
    color: "#9ca3af",
    fontSize: "13px",
  },
  selectedLead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "2px solid #667eea",
    background: "#eef2ff",
  },
  selectedLeadName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#4338ca",
  },
  clearLeadBtn: {
    width: "24px",
    height: "24px",
    borderRadius: "6px",
    border: "none",
    background: "#c7d2fe",
    color: "#4338ca",
    fontSize: "12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  submitBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
};

export default Activities;
