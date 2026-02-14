import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { leadsApi } from "../api/client";
import type { Lead, LeadStatus, ResponseStatus } from "../types";
import { RESPONSE_STATUS_LABELS } from "../types";

// Pipeline stages matching the new system architecture
interface PipelineColumn {
  id: LeadStatus;
  title: string;
  color: string;
  bgColor: string;
  icon: string;
}

const PIPELINE_COLUMNS: PipelineColumn[] = [
  { id: "Not Contacted", title: "Lead Identified", color: "#6b7280", bgColor: "#f9fafb", icon: "🎯" },
  { id: "Attempted", title: "Contacted", color: "#f59e0b", bgColor: "#fffbeb", icon: "📤" },
  { id: "Connected", title: "Engaged", color: "#3b82f6", bgColor: "#eff6ff", icon: "💬" },
  { id: "Follow-up Needed", title: "Discovery Call", color: "#8b5cf6", bgColor: "#f5f3ff", icon: "📞" },
  { id: "Proposal Sent", title: "Proposal Sent", color: "#06b6d4", bgColor: "#ecfeff", icon: "📋" },
  { id: "Qualified Lead", title: "Negotiation", color: "#f97316", bgColor: "#fff7ed", icon: "🤝" },
];

const CLOSED_COLUMNS: PipelineColumn[] = [
  { id: "Converted", title: "Closed Won", color: "#22c55e", bgColor: "#f0fdf4", icon: "🏆" },
  { id: "Not Interested", title: "Closed Lost", color: "#ef4444", bgColor: "#fef2f2", icon: "❌" },
];

// Response status colors
const RESPONSE_COLORS: Record<ResponseStatus, { bg: string; text: string }> = {
  no_response: { bg: "#f3f4f6", text: "#6b7280" },
  opened: { bg: "#fef3c7", text: "#92400e" },
  replied: { bg: "#dbeafe", text: "#1d4ed8" },
  interested: { bg: "#dcfce7", text: "#166534" },
  not_interested: { bg: "#fee2e2", text: "#dc2626" },
};

// Source colors
const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  LinkedIn: { bg: "#dbeafe", text: "#1d4ed8" },
  "Cold Outreach": { bg: "#f3e8ff", text: "#7c3aed" },
  Referral: { bg: "#dcfce7", text: "#166534" },
  Website: { bg: "#fef3c7", text: "#92400e" },
  Event: { bg: "#fce7f3", text: "#be185d" },
  "Social Media": { bg: "#cffafe", text: "#0891b2" },
  List: { bg: "#e5e7eb", text: "#374151" },
  Scraping: { bg: "#e5e7eb", text: "#374151" },
  Other: { bg: "#f3f4f6", text: "#6b7280" },
};

export function Workflow() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  // Filters
  const [repFilter, setRepFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    const loadLeads = async () => {
      setLoading(true);
      try {
        const response = await leadsApi.getLeads({ per_page: 500 });
        setLeads(response.data);
      } catch (err) {
        console.error("Failed to load leads:", err);
      } finally {
        setLoading(false);
      }
    };
    loadLeads();
  }, []);

  const getLeadsForColumn = (status: LeadStatus): Lead[] => {
    return leads
      .filter((lead) => lead.status === status)
      .filter((lead) => {
        if (repFilter && lead.assigned_rep !== repFilter) return false;
        if (sourceFilter && lead.source !== sourceFilter) return false;
        if (serviceFilter && lead.service_category !== serviceFilter) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            lead.business_name.toLowerCase().includes(query) ||
            (lead.contact_name?.toLowerCase().includes(query) ?? false) ||
            (lead.email?.toLowerCase().includes(query) ?? false)
          );
        }
        return true;
      });
  };

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedLead || draggedLead.status === newStatus) {
      setDraggedLead(null);
      return;
    }

    try {
      await leadsApi.updateLeadStatus(draggedLead.id, newStatus);
      setLeads((prev) =>
        prev.map((l) => (l.id === draggedLead.id ? { ...l, status: newStatus } : l))
      );
    } catch (err) {
      console.error("Failed to update lead status:", err);
    }
    setDraggedLead(null);
  };

  const getUniqueReps = (): string[] => {
    const reps = leads.map((l) => l.assigned_rep).filter((r): r is string => !!r);
    return [...new Set(reps)];
  };

  const getUniqueSources = (): string[] => {
    const sources = leads.map((l) => l.source).filter((s): s is string => !!s);
    return [...new Set(sources)];
  };

  const getUniqueServices = (): string[] => {
    const services = leads.map((l) => l.service_category).filter((s): s is string => !!s);
    return [...new Set(services)];
  };

  const getTotalByStatus = (status: LeadStatus): number => {
    return getLeadsForColumn(status).length;
  };

  const getTotalPipelineValue = (): number => {
    return leads
      .filter((l) => !["Converted", "Not Interested"].includes(l.status))
      .reduce((sum, l) => sum + (l.deal_value || 0), 0);
  };

  const getOverdueFollowUps = (): number => {
    const today = new Date();
    return leads.filter((l) => {
      if (!l.next_follow_up_date) return false;
      return new Date(l.next_follow_up_date) < today;
    }).length;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
  };

  const isOverdue = (date: string | null): boolean => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={styles.spinner}
        />
        <span>Loading Pipeline...</span>
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
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 style={styles.title}>Sales Pipeline</h1>
          <p style={styles.subtitle}>Drag leads through stages to track progress</p>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.headerStat}>
            <span style={styles.headerStatValue}>{leads.length}</span>
            <span style={styles.headerStatLabel}>Total Leads</span>
          </div>
          <div style={styles.headerStat}>
            <span style={styles.headerStatValue}>${getTotalPipelineValue().toLocaleString()}</span>
            <span style={styles.headerStatLabel}>Pipeline Value</span>
          </div>
          <div style={{...styles.headerStat, ...(getOverdueFollowUps() > 0 ? styles.headerStatAlert : {})}}>
            <span style={styles.headerStatValue}>{getOverdueFollowUps()}</span>
            <span style={styles.headerStatLabel}>Overdue Follow-ups</span>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        style={styles.filtersBar}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Team Members</option>
          {getUniqueReps().map((rep) => (
            <option key={rep} value={rep}>{rep}</option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Sources</option>
          {getUniqueSources().map((source) => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>

        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Services</option>
          {getUniqueServices().map((service) => (
            <option key={service} value={service}>{service}</option>
          ))}
        </select>

        <motion.button
          onClick={() => setShowClosed(!showClosed)}
          style={{
            ...styles.toggleBtn,
            background: showClosed ? "#122c21" : "#f3f4f6",
            color: showClosed ? "#fff" : "#6b7280",
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {showClosed ? "Hide" : "Show"} Closed
        </motion.button>
      </motion.div>

      {/* Pipeline Board */}
      <div style={styles.boardWrapper}>
        <motion.div
          style={styles.board}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {PIPELINE_COLUMNS.map((column, colIndex) => {
            const columnLeads = getLeadsForColumn(column.id);
            const isOver = dragOverColumn === column.id;

            return (
              <motion.div
                key={column.id}
                style={{
                  ...styles.column,
                  ...(isOver ? styles.columnDragOver : {}),
                }}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + colIndex * 0.03 }}
              >
                {/* Column Header */}
                <div style={{ ...styles.columnHeader, borderTopColor: column.color }}>
                  <div style={styles.columnTitleRow}>
                    <span style={styles.columnIcon}>{column.icon}</span>
                    <span style={styles.columnTitle}>{column.title}</span>
                  </div>
                  <span style={{ ...styles.columnCount, background: column.bgColor, color: column.color }}>
                    {getTotalByStatus(column.id)}
                  </span>
                </div>

                {/* Column Content */}
                <div style={styles.columnContent}>
                  {columnLeads.length === 0 ? (
                    <div style={styles.emptyColumn}>
                      <span style={styles.emptyIcon}>📭</span>
                      <span>No leads</span>
                    </div>
                  ) : (
                    columnLeads.map((lead) => (
                      <motion.div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead)}
                        style={{
                          ...styles.leadCard,
                          opacity: draggedLead?.id === lead.id ? 0.5 : 1,
                        }}
                        whileHover={{ y: -2, boxShadow: "0 8px 20px rgba(0,0,0,0.12)" }}
                        layout
                      >
                        {/* Lead Header */}
                        <div style={styles.leadHeader}>
                          <Link to={`/leads/${lead.id}`} style={styles.leadName}>
                            {lead.business_name}
                          </Link>
                          {lead.deal_value && lead.deal_value > 0 && (
                            <span style={styles.dealValue}>
                              ${lead.deal_value.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Contact Info */}
                        {lead.contact_name && (
                          <div style={styles.contactRow}>
                            <span style={styles.contactName}>{lead.contact_name}</span>
                            {lead.contact_title && (
                              <span style={styles.contactTitle}>{lead.contact_title}</span>
                            )}
                          </div>
                        )}

                        {/* Tags Row */}
                        <div style={styles.tagsRow}>
                          {lead.source && (
                            <span
                              style={{
                                ...styles.tag,
                                background: SOURCE_COLORS[lead.source]?.bg || "#f3f4f6",
                                color: SOURCE_COLORS[lead.source]?.text || "#6b7280",
                              }}
                            >
                              {lead.source}
                            </span>
                          )}
                          {lead.service_category && (
                            <span style={styles.serviceTag}>
                              {lead.service_category}
                            </span>
                          )}
                        </div>

                        {/* Response Status */}
                        <div style={styles.responseRow}>
                          <span
                            style={{
                              ...styles.responseStatus,
                              background: RESPONSE_COLORS[lead.response_status]?.bg || "#f3f4f6",
                              color: RESPONSE_COLORS[lead.response_status]?.text || "#6b7280",
                            }}
                          >
                            {RESPONSE_STATUS_LABELS[lead.response_status] || "No Response"}
                          </span>
                          {lead.follow_up_count > 0 && (
                            <span style={styles.followUpCount}>
                              {lead.follow_up_count} follow-up{lead.follow_up_count > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Footer */}
                        <div style={styles.leadFooter}>
                          {lead.assigned_rep && (
                            <div style={styles.assignedRep}>
                              <span style={styles.repAvatar}>
                                {lead.assigned_rep.split(" ").map(n => n[0]).join("").toUpperCase()}
                              </span>
                              <span style={styles.repName}>{lead.assigned_rep.split(" ")[0]}</span>
                            </div>
                          )}
                          {lead.next_follow_up_date && (
                            <span
                              style={{
                                ...styles.followUpDate,
                                ...(isOverdue(lead.next_follow_up_date) ? styles.overdueDate : {}),
                              }}
                            >
                              {isOverdue(lead.next_follow_up_date) ? "⚠️ " : "📅 "}
                              {formatDate(lead.next_follow_up_date)}
                            </span>
                          )}
                        </div>

                        {/* Custom Tags */}
                        {lead.tags && lead.tags.length > 0 && (
                          <div style={styles.customTags}>
                            {lead.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} style={styles.customTag}>{tag}</span>
                            ))}
                            {lead.tags.length > 3 && (
                              <span style={styles.moreTags}>+{lead.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Closed Columns */}
        {showClosed && (
          <motion.div
            style={styles.closedSection}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 style={styles.closedTitle}>Closed Deals</h3>
            <div style={styles.closedColumns}>
              {CLOSED_COLUMNS.map((column) => {
                const columnLeads = getLeadsForColumn(column.id);
                const isOver = dragOverColumn === column.id;

                return (
                  <motion.div
                    key={column.id}
                    style={{
                      ...styles.closedColumn,
                      borderColor: column.color,
                      ...(isOver ? styles.columnDragOver : {}),
                    }}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                  >
                    <div style={styles.closedHeader}>
                      <span>{column.icon} {column.title}</span>
                      <span style={{ ...styles.closedCount, background: column.bgColor, color: column.color }}>
                        {getTotalByStatus(column.id)}
                      </span>
                    </div>
                    <div style={styles.closedContent}>
                      {columnLeads.slice(0, 5).map((lead) => (
                        <Link key={lead.id} to={`/leads/${lead.id}`} style={styles.closedLead}>
                          <span>{lead.business_name}</span>
                          {lead.deal_value && <span style={styles.closedValue}>${lead.deal_value.toLocaleString()}</span>}
                        </Link>
                      ))}
                      {columnLeads.length > 5 && (
                        <span style={styles.moreLeads}>+{columnLeads.length - 5} more</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Stats Footer */}
      <motion.div
        style={styles.statsFooter}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {PIPELINE_COLUMNS.map((col) => (
          <motion.div key={col.id} style={styles.stat} whileHover={{ scale: 1.05 }}>
            <span style={{ ...styles.statValue, color: col.color }}>{getTotalByStatus(col.id)}</span>
            <span style={styles.statLabel}>{col.title}</span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px",
    maxWidth: "100%",
    margin: "0 auto",
    minHeight: "calc(100vh - 80px)",
    overflow: "hidden",
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "400px",
    color: "#9ca3af",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e5e7eb",
    borderTopColor: "#122c21",
    borderRadius: "50%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
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
  headerStats: {
    display: "flex",
    gap: "24px",
  },
  headerStat: {
    textAlign: "right" as const,
    padding: "12px 16px",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  headerStatAlert: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
  },
  headerStatValue: {
    display: "block",
    fontSize: "20px",
    fontWeight: 700,
    color: "#122c21",
  },
  headerStatLabel: {
    fontSize: "12px",
    color: "#6b7280",
  },
  filtersBar: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    background: "#fff",
    borderRadius: "10px",
    padding: "10px 14px",
    gap: "8px",
    border: "1px solid #e5e7eb",
    flex: "1",
    maxWidth: "300px",
  },
  searchIcon: {
    fontSize: "14px",
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    fontSize: "14px",
    outline: "none",
  },
  filterSelect: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: "14px",
    cursor: "pointer",
    minWidth: "150px",
  },
  toggleBtn: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  boardWrapper: {
    width: "100%",
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "12px",
    width: "100%",
  },
  column: {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column" as const,
    maxHeight: "calc(100vh - 320px)",
    minWidth: 0,
  },
  columnDragOver: {
    boxShadow: "0 0 0 2px #122c21, 0 4px 12px rgba(18,44,33,0.2)",
  },
  columnHeader: {
    padding: "12px",
    borderTop: "3px solid",
    borderTopColor: "#6b7280",
    borderRadius: "12px 12px 0 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  columnTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  columnIcon: {
    fontSize: "16px",
  },
  columnTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1f2937",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  columnCount: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
  },
  columnContent: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "8px 10px 10px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  emptyColumn: {
    textAlign: "center" as const,
    padding: "32px 16px",
    color: "#9ca3af",
    fontSize: "13px",
  },
  emptyIcon: {
    display: "block",
    fontSize: "24px",
    marginBottom: "8px",
  },
  leadCard: {
    background: "#fff",
    borderRadius: "8px",
    padding: "12px",
    border: "1px solid #e5e7eb",
    cursor: "grab",
    transition: "all 0.2s",
  },
  leadHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
  },
  leadName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1f2937",
    textDecoration: "none",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  dealValue: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#059669",
    background: "#dcfce7",
    padding: "2px 8px",
    borderRadius: "6px",
    marginLeft: "8px",
  },
  contactRow: {
    marginBottom: "8px",
  },
  contactName: {
    fontSize: "13px",
    color: "#374151",
    fontWeight: 500,
  },
  contactTitle: {
    fontSize: "12px",
    color: "#9ca3af",
    marginLeft: "6px",
  },
  tagsRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginBottom: "8px",
  },
  tag: {
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: 500,
  },
  serviceTag: {
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "6px",
    background: "#f3e8ff",
    color: "#7c3aed",
    fontWeight: 500,
  },
  responseRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  responseStatus: {
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: 500,
  },
  followUpCount: {
    fontSize: "11px",
    color: "#6b7280",
  },
  leadFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "10px",
    borderTop: "1px solid #f3f4f6",
  },
  assignedRep: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  repAvatar: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)",
    color: "#fff",
    fontSize: "9px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  repName: {
    fontSize: "12px",
    color: "#6b7280",
  },
  followUpDate: {
    fontSize: "11px",
    color: "#6b7280",
  },
  overdueDate: {
    color: "#dc2626",
    fontWeight: 600,
  },
  customTags: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "4px",
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px dashed #e5e7eb",
  },
  customTag: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    background: "#f3f4f6",
    color: "#6b7280",
  },
  moreTags: {
    fontSize: "10px",
    color: "#9ca3af",
  },
  closedSection: {
    marginTop: "24px",
    paddingTop: "24px",
    borderTop: "1px solid #e5e7eb",
  },
  closedTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: "16px",
  },
  closedColumns: {
    display: "flex",
    gap: "16px",
  },
  closedColumn: {
    flex: 1,
    background: "#fff",
    borderRadius: "12px",
    border: "2px solid",
    padding: "16px",
  },
  closedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    fontSize: "14px",
    fontWeight: 600,
  },
  closedCount: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
  },
  closedContent: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  closedLead: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 12px",
    background: "#f9fafb",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#374151",
    textDecoration: "none",
  },
  closedValue: {
    fontWeight: 600,
    color: "#059669",
  },
  moreLeads: {
    fontSize: "12px",
    color: "#9ca3af",
    textAlign: "center" as const,
    padding: "8px",
  },
  statsFooter: {
    display: "flex",
    justifyContent: "space-around",
    padding: "20px",
    background: "#fff",
    borderRadius: "16px",
    marginTop: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    flexWrap: "wrap" as const,
    gap: "16px",
  },
  stat: {
    textAlign: "center" as const,
    minWidth: "100px",
  },
  statValue: {
    display: "block",
    fontSize: "24px",
    fontWeight: 700,
  },
  statLabel: {
    fontSize: "12px",
    color: "#6b7280",
  },
};

export default Workflow;
