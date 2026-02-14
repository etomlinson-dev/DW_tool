import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { emailsApi, type PendingEmail as APIPendingEmail } from "../api/client";
import { EmailComposer } from "../components";
import { useAuth } from "../contexts/AuthContext";

// Types for UI
interface PendingEmail {
  id: number;
  leadId: number;
  leadName: string;
  leadEmail: string;
  subject: string;
  body: string;
  templateName: string | null;
  templateCategory: string | null;
  generatedBy: string;
  generatedAt: string;
  sentAt: string | null;
  status: "draft" | "pending_review" | "approved" | "rejected" | "sent";
  priority: "High" | "Medium" | "Low";
  assignedTo: string;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  replyStatus: string;
  repliedAt: string | null;
  replySnippet: string | null;
}

interface TrackingTemplate {
  id: number;
  name: string;
  category: string;
}

interface TrackingStats {
  total_sent: number;
  replied: number;
  no_reply: number;
  bounced: number;
  reply_rate: number;
}

// Map API email to UI format
const mapApiToEmail = (e: APIPendingEmail & Record<string, unknown>): PendingEmail => {
  const priorityMap: Record<string, PendingEmail["priority"]> = {
    "high": "High",
    "medium": "Medium",
    "low": "Low",
  };
  
  return {
    id: e.id,
    leadId: e.lead_id,
    leadName: e.lead_name || "Unknown",
    leadEmail: e.lead_email || "",
    subject: e.subject,
    body: e.body,
    templateName: e.template_name || null,
    templateCategory: (e.template_category as string) || null,
    generatedBy: e.generated_by || "System",
    generatedAt: e.generated_at || new Date().toISOString(),
    sentAt: (e.sent_at as string) || null,
    status: e.status as PendingEmail["status"],
    priority: priorityMap[e.priority?.toLowerCase() || "medium"] || "Medium",
    assignedTo: e.generated_by || "",
    reviewNotes: e.review_notes || null,
    reviewedBy: e.reviewer || null,
    reviewedAt: null,
    replyStatus: (e.reply_status as string) || "no_reply",
    repliedAt: (e.replied_at as string) || null,
    replySnippet: (e.reply_snippet as string) || null,
  };
};

const STATUS_TABS = [
  { id: "draft", label: "Drafts", icon: "📝" },
  { id: "sent", label: "Sent", icon: "📤" },
  { id: "tracking", label: "Tracking", icon: "📊" },
];

export function PendingEmails() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<PendingEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("draft");
  const [selectedEmail, setSelectedEmail] = useState<PendingEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [showComposer, setShowComposer] = useState(false);

  // Tab counts (fetched independently so they always show)
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({ draft: 0, sent: 0 });

  // Tracking state
  const [trackedEmails, setTrackedEmails] = useState<PendingEmail[]>([]);
  const [trackingTemplates, setTrackingTemplates] = useState<TrackingTemplate[]>([]);
  const [trackingStats, setTrackingStats] = useState<TrackingStats>({ total_sent: 0, replied: 0, no_reply: 0, bounced: 0, reply_rate: 0 });
  const [templateFilter, setTemplateFilter] = useState("all");
  const [replyFilter, setReplyFilter] = useState("all");
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [selectedTrackedEmail, setSelectedTrackedEmail] = useState<PendingEmail | null>(null);

  // Fetch tab counts on mount and after actions
  const fetchCounts = useCallback(async () => {
    try {
      const resp = await fetch("/api/emails/counts");
      if (resp.ok) {
        const data = await resp.json();
        setTabCounts(data);
      }
    } catch { /* non-fatal */ }
  }, []);

  // Fetch tracking data
  const fetchTracking = useCallback(async () => {
    try {
      const data = await emailsApi.getTracking({
        template_id: templateFilter !== "all" ? templateFilter : undefined,
        reply_status: replyFilter !== "all" ? replyFilter : undefined,
      });
      setTrackedEmails(data.emails.map((e: Record<string, unknown>) => mapApiToEmail(e as APIPendingEmail & Record<string, unknown>)));
      setTrackingTemplates(data.templates);
      setTrackingStats(data.stats);
    } catch (err) {
      console.error("Failed to fetch tracking:", err);
    }
  }, [templateFilter, replyFilter]);

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    try {
      const result = await emailsApi.checkReplies();
      alert(`${result.message}`);
      fetchTracking();
    } catch (err) {
      console.error("Failed to check replies:", err);
      alert("Failed to check replies. Make sure Microsoft is connected.");
    } finally {
      setCheckingReplies(false);
    }
  };

  // Fetch emails from API
  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (activeTab === "tracking") {
        await fetchTracking();
      } else {
        const data = await emailsApi.getPendingEmails(activeTab);
        setEmails(data.map((e: APIPendingEmail) => mapApiToEmail(e as APIPendingEmail & Record<string, unknown>)));
      }
    } catch (err) {
      console.error("Failed to fetch pending emails:", err);
      setError("Failed to load emails.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchTracking]);

  useEffect(() => {
    fetchEmails();
    fetchCounts();
  }, [fetchEmails, fetchCounts]);

  // Filter emails by status
  const filteredEmails = emails.filter((email) => {
    const matchesStatus = email.status === activeTab;
    const matchesSearch =
      email.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.assignedTo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Stats - use server counts so they show on all tabs
  const stats = {
    draft: tabCounts.draft || 0,
    sent: tabCounts.sent || 0,
    tracking: trackingStats.total_sent || tabCounts.sent || 0,
  };

  const handleApprove = async (id: number) => {
    try {
      await emailsApi.approveEmail(id, user?.name || "Unknown", "Approved for sending.");
      setEmails(emails.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "approved" as const,
              reviewedBy: user?.name || "Unknown",
              reviewedAt: new Date().toISOString(),
              reviewNotes: "Approved for sending.",
            }
          : e
      ));
      setSelectedEmail(null);
      fetchCounts();
    } catch (err) {
      console.error("Failed to approve email:", err);
      alert("Failed to approve email.");
    }
  };

  const handleReject = async (id: number, notes: string) => {
    try {
      await emailsApi.rejectEmail(id, user?.name || "Unknown", notes || "Rejected - needs revision.");
      setEmails(emails.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "rejected" as const,
              reviewedBy: user?.name || "Unknown",
              reviewedAt: new Date().toISOString(),
              reviewNotes: notes || "Rejected - needs revision.",
            }
          : e
      ));
      setSelectedEmail(null);
      fetchCounts();
    } catch (err) {
      console.error("Failed to reject email:", err);
      alert("Failed to reject email.");
    }
  };

  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSend = async (id: number) => {
    setSendingEmail(true);
    try {
      await emailsApi.sendEmail(id);
      setEmails(emails.map((e) =>
        e.id === id ? { ...e, status: "sent" as const } : e
      ));
      setSelectedEmail(null);
      fetchCounts();
    } catch (err) {
      console.error("Failed to send email:", err);
      alert("Failed to send email. Make sure Microsoft is connected.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEdit = () => {
    if (selectedEmail) {
      setEditedBody(selectedEmail.body);
      setEditMode(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedEmail) {
      setEmails(emails.map((e) =>
        e.id === selectedEmail.id ? { ...e, body: editedBody } : e
      ));
      setSelectedEmail({ ...selectedEmail, body: editedBody });
      setEditMode(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return { bg: "#fee2e2", color: "#dc2626" };
      case "Medium": return { bg: "#fef3c7", color: "#d97706" };
      case "Low": return { bg: "#dcfce7", color: "#16a34a" };
      default: return { bg: "#f3f4f6", color: "#6b7280" };
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    // Append Z if missing so JS knows it's UTC and converts to local time
    const utcString = dateString.endsWith("Z") ? dateString : dateString + "Z";
    const date = new Date(utcString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

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
          <h1 style={styles.title}>Emails</h1>
          <p style={styles.subtitle}>Compose, draft, and send outgoing emails</p>
        </div>
        <div style={styles.headerActions}>
          <motion.span 
            style={styles.statBadge}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span style={styles.statDot} /> {stats.draft} draft{stats.draft !== 1 ? "s" : ""}
          </motion.span>
          <motion.button
            onClick={() => setShowComposer(true)}
            style={styles.composeBtn}
            whileHover={{ scale: 1.05, boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)" }}
            whileTap={{ scale: 0.95 }}
          >
            ✉️ Compose
          </motion.button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div 
        style={styles.tabsContainer}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {STATUS_TABS.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            <span style={styles.tabCount}>
              {tab.id === "draft" ? stats.draft :
               tab.id === "tracking" ? stats.tracking : stats.sent}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {activeTab === "tracking" ? (
        /* ======= TRACKING VIEW ======= */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {/* Tracking Stats */}
          <div style={styles.trackingStatsRow}>
            {[
              { label: "Total Sent", value: trackingStats.total_sent, color: "#667eea", bg: "#eef2ff" },
              { label: "Replied", value: trackingStats.replied, color: "#10b981", bg: "#ecfdf5" },
              { label: "No Reply", value: trackingStats.no_reply, color: "#f59e0b", bg: "#fffbeb" },
              { label: "Reply Rate", value: `${trackingStats.reply_rate}%`, color: "#8b5cf6", bg: "#f5f3ff" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                style={{ ...styles.trackingStat, background: stat.bg }}
                whileHover={{ scale: 1.03 }}
              >
                <span style={{ ...styles.trackingStatValue, color: stat.color }}>{stat.value}</span>
                <span style={styles.trackingStatLabel}>{stat.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div style={styles.trackingFilters}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Template:</label>
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Templates</option>
                {trackingTemplates.map((t) => (
                  <option key={t.id} value={t.id.toString()}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Reply Status:</label>
              <select
                value={replyFilter}
                onChange={(e) => setReplyFilter(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All</option>
                <option value="no_reply">No Reply</option>
                <option value="replied">Replied</option>
                <option value="bounced">Bounced</option>
              </select>
            </div>
            <motion.button
              onClick={handleCheckReplies}
              style={{ ...styles.checkRepliesBtn, opacity: checkingReplies ? 0.7 : 1 }}
              disabled={checkingReplies}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {checkingReplies ? "Checking..." : "🔄 Check for Replies"}
            </motion.button>
          </div>

          {/* Tracked Emails List + Preview */}
          <div style={styles.mainLayout}>
            <div style={styles.emailList}>
              <div style={styles.listHeader}>
                <input
                  type="text"
                  placeholder="Search sent emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
              {trackedEmails.filter((e) =>
                e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.leadEmail || "").toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 ? (
                <div style={styles.emptyState}>
                  <span style={styles.emptyIcon}>📊</span>
                  <p>No sent emails found</p>
                </div>
              ) : (
                <div style={styles.emailCards}>
                  {trackedEmails
                    .filter((e) =>
                      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      e.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (e.leadEmail || "").toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((email, index) => {
                      const replyColor = email.replyStatus === "replied"
                        ? { bg: "#ecfdf5", color: "#059669", icon: "✅" }
                        : email.replyStatus === "bounced"
                        ? { bg: "#fef2f2", color: "#dc2626", icon: "⚠️" }
                        : { bg: "#fffbeb", color: "#d97706", icon: "⏳" };
                      return (
                        <motion.div
                          key={email.id}
                          onClick={() => setSelectedTrackedEmail(email)}
                          style={{
                            ...styles.emailCard,
                            ...(selectedTrackedEmail?.id === email.id ? styles.emailCardActive : {}),
                          }}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.03 }}
                          whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)" }}
                        >
                          <div style={styles.emailCardHeader}>
                            <span style={{ ...styles.priorityBadge, background: replyColor.bg, color: replyColor.color }}>
                              {replyColor.icon} {email.replyStatus === "replied" ? "Replied" : email.replyStatus === "bounced" ? "Bounced" : "Awaiting"}
                            </span>
                            <span style={styles.emailTime}>{email.sentAt ? formatDate(email.sentAt) : formatDate(email.generatedAt)}</span>
                          </div>
                          <span style={{ ...styles.leadName, display: "block", cursor: "pointer" }}>
                            To: {email.leadEmail || email.leadName}
                          </span>
                          <p style={styles.emailSubject}>{email.subject}</p>
                          <div style={styles.emailCardFooter}>
                            {email.templateName && (
                              <span style={styles.templateBadge}>{email.templateName}</span>
                            )}
                            {email.repliedAt && (
                              <span style={{ fontSize: "11px", color: "#059669" }}>
                                Replied {formatDate(email.repliedAt)}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Tracking Preview */}
            <div style={styles.previewPane}>
              {selectedTrackedEmail ? (
                <>
                  <div style={styles.previewHeader}>
                    <div>
                      <h3 style={styles.previewSubject}>{selectedTrackedEmail.subject}</h3>
                      <div style={styles.previewMeta}>
                        <span>To: {selectedTrackedEmail.leadEmail}</span>
                        <span>•</span>
                        <span>Sent by: {selectedTrackedEmail.generatedBy}</span>
                      </div>
                    </div>
                    <span style={{
                      ...styles.priorityBadge,
                      background: selectedTrackedEmail.replyStatus === "replied" ? "#ecfdf5" : "#fffbeb",
                      color: selectedTrackedEmail.replyStatus === "replied" ? "#059669" : "#d97706",
                    }}>
                      {selectedTrackedEmail.replyStatus === "replied" ? "✅ Replied" : "⏳ Awaiting Reply"}
                    </span>
                  </div>

                  <div style={styles.previewInfo}>
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Recipient:</span>
                      <span>{selectedTrackedEmail.leadEmail}</span>
                    </div>
                    {selectedTrackedEmail.leadId && (
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Lead:</span>
                        <Link to={`/lead/${selectedTrackedEmail.leadId}`} style={styles.infoLink}>
                          {selectedTrackedEmail.leadName}
                        </Link>
                      </div>
                    )}
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Sent:</span>
                      <span>{selectedTrackedEmail.sentAt ? formatDate(selectedTrackedEmail.sentAt) : "N/A"}</span>
                    </div>
                    {selectedTrackedEmail.templateName && (
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Template:</span>
                        <span>{selectedTrackedEmail.templateName}</span>
                      </div>
                    )}
                    {selectedTrackedEmail.repliedAt && (
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Reply At:</span>
                        <span style={{ color: "#059669", fontWeight: 500 }}>
                          {formatDate(selectedTrackedEmail.repliedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reply Snippet */}
                  {selectedTrackedEmail.replySnippet && (
                    <div style={styles.replySnippetBox}>
                      <span style={styles.replySnippetLabel}>Reply Preview:</span>
                      <p style={styles.replySnippetText}>{selectedTrackedEmail.replySnippet}</p>
                    </div>
                  )}

                  <div style={styles.previewBody}>
                    <h4 style={{ margin: "0 0 12px", fontSize: "14px", color: "#6b7280" }}>Original Email:</h4>
                    {selectedTrackedEmail.body.includes("<") && selectedTrackedEmail.body.includes(">") ? (
                      <div style={styles.emailBodyHtml} dangerouslySetInnerHTML={{ __html: selectedTrackedEmail.body }} />
                    ) : (
                      <pre style={styles.emailBody}>{selectedTrackedEmail.body}</pre>
                    )}
                  </div>
                </>
              ) : (
                <div style={styles.noSelection}>
                  <span style={styles.noSelectionIcon}>📊</span>
                  <h3>Select an email to see tracking details</h3>
                  <p>Click on a sent email to view its reply status and details</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        /* ======= QUEUE VIEW (existing) ======= */
        <motion.div 
          style={styles.mainLayout}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {/* Email List */}
          <div style={styles.emailList}>
            <div style={styles.listHeader}>
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {filteredEmails.length === 0 ? (
              <motion.div 
                style={styles.emptyState}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <span style={styles.emptyIcon}>📧</span>
                <p>No emails in this queue</p>
              </motion.div>
            ) : (
              <div style={styles.emailCards}>
                {filteredEmails.map((email, index) => (
                  <motion.div
                    key={email.id}
                    onClick={() => {
                      setSelectedEmail(email);
                      setEditMode(false);
                    }}
                    style={{
                      ...styles.emailCard,
                      ...(selectedEmail?.id === email.id ? styles.emailCardActive : {}),
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    whileHover={{ scale: 1.02, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)" }}
                  >
                    <div style={styles.emailCardHeader}>
                      <span style={{
                        ...styles.priorityBadge,
                        background: getPriorityColor(email.priority).bg,
                        color: getPriorityColor(email.priority).color,
                      }}>
                        {email.priority}
                      </span>
                      <span style={styles.emailTime}>{formatDate(email.generatedAt)}</span>
                    </div>
                    
                    {email.leadId ? (
                      <Link to={`/lead/${email.leadId}`} style={styles.leadName}>
                        {email.leadName}
                      </Link>
                    ) : (
                      <span style={styles.leadName}>{email.leadName}</span>
                    )}
                    <p style={styles.emailSubject}>{email.subject}</p>
                    <p style={styles.emailPreview}>
                      {email.body.replace(/<[^>]*>/g, "").substring(0, 100)}...
                    </p>
                    
                    <div style={styles.emailCardFooter}>
                      <span style={styles.assignee}>👤 {email.assignedTo}</span>
                      {email.templateName && (
                        <span style={styles.templateBadge}>{email.templateName}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Email Preview */}
          <div style={styles.previewPane}>
            {selectedEmail ? (
              <>
                <div style={styles.previewHeader}>
                  <div>
                    <h3 style={styles.previewSubject}>{selectedEmail.subject}</h3>
                    <div style={styles.previewMeta}>
                      <span>To: {selectedEmail.leadEmail}</span>
                      <span>•</span>
                      <span>From: {selectedEmail.assignedTo}</span>
                    </div>
                  </div>
                  <span style={{
                    ...styles.priorityBadge,
                    background: getPriorityColor(selectedEmail.priority).bg,
                    color: getPriorityColor(selectedEmail.priority).color,
                  }}>
                    {selectedEmail.priority} Priority
                  </span>
                </div>

                <div style={styles.previewInfo}>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Lead:</span>
                    {selectedEmail.leadId ? (
                      <Link to={`/lead/${selectedEmail.leadId}`} style={styles.infoLink}>
                        {selectedEmail.leadName}
                      </Link>
                    ) : (
                      <span>{selectedEmail.leadName}</span>
                    )}
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Generated:</span>
                    <span>{formatDate(selectedEmail.generatedAt)} by {selectedEmail.generatedBy}</span>
                  </div>
                  {selectedEmail.templateName && (
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Template:</span>
                      <span>{selectedEmail.templateName}</span>
                    </div>
                  )}
                  {selectedEmail.reviewedBy && (
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Reviewed:</span>
                      <span>{selectedEmail.reviewedAt ? formatDate(selectedEmail.reviewedAt) : ""} by {selectedEmail.reviewedBy}</span>
                    </div>
                  )}
                </div>

                <div style={styles.previewBody}>
                  {editMode ? (
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      style={styles.editTextarea}
                    />
                  ) : selectedEmail.body.includes("<") && selectedEmail.body.includes(">") ? (
                    <div style={styles.emailBodyHtml} dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
                  ) : (
                    <pre style={styles.emailBody}>{selectedEmail.body}</pre>
                  )}
                </div>

                {selectedEmail.reviewNotes && (
                  <div style={styles.reviewNotes}>
                    <span style={styles.reviewNotesLabel}>Review Notes:</span>
                    <p>{selectedEmail.reviewNotes}</p>
                  </div>
                )}

                <div style={styles.previewActions}>
                  {selectedEmail.status === "draft" && (
                    <>
                      {editMode ? (
                        <>
                          <button onClick={() => setEditMode(false)} style={styles.cancelBtn}>
                            Cancel
                          </button>
                          <button onClick={handleSaveEdit} style={styles.saveBtn}>
                            Save Changes
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={handleEdit} style={styles.editBtn}>
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleSend(selectedEmail.id)}
                            style={{ ...styles.sendBtn, opacity: sendingEmail ? 0.7 : 1 }}
                            disabled={sendingEmail}
                          >
                            {sendingEmail ? "⏳ Sending..." : "📤 Send Now"}
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {selectedEmail.status === "sent" && (
                    <span style={styles.sentBadge}>Sent Successfully</span>
                  )}
                </div>
              </>
            ) : (
              <div style={styles.noSelection}>
                <span style={styles.noSelectionIcon}>📧</span>
                <h3>Select an email to preview</h3>
                <p>Choose an email from the list to view its contents and take action</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Email Composer Modal */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "24px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowComposer(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <EmailComposer
                onClose={() => setShowComposer(false)}
                onSent={() => {
                  setShowComposer(false);
                  // Refresh emails and switch to drafts tab
                  setActiveTab("draft");
                  fetchEmails();
                  fetchCounts();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  composeBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  statBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    background: "#fef3c7",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#92400e",
  },
  statDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#f59e0b",
    animation: "pulse 2s infinite",
  },
  tabsContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "16px",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "#667eea",
    color: "#fff",
  },
  tabCount: {
    padding: "2px 8px",
    borderRadius: "10px",
    background: "rgba(255, 255, 255, 0.2)",
    fontSize: "12px",
  },
  mainLayout: {
    display: "grid",
    gridTemplateColumns: "400px 1fr",
    gap: "24px",
    minHeight: "600px",
  },
  emailList: {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
  },
  listHeader: {
    padding: "16px",
    borderBottom: "1px solid #f3f4f6",
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
  },
  emailCards: {
    maxHeight: "calc(100vh - 350px)",
    overflowY: "auto",
  },
  emailCard: {
    padding: "16px",
    borderBottom: "1px solid #f3f4f6",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  emailCardActive: {
    background: "#eef2ff",
    borderLeft: "3px solid #667eea",
  },
  emailCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  priorityBadge: {
    padding: "3px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: 600,
  },
  emailTime: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  leadName: {
    display: "block",
    fontSize: "15px",
    fontWeight: 600,
    color: "#1f2937",
    textDecoration: "none",
    marginBottom: "4px",
  },
  emailSubject: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    margin: "0 0 6px",
  },
  emailPreview: {
    fontSize: "12px",
    color: "#6b7280",
    margin: "0 0 10px",
    lineHeight: 1.4,
  },
  emailCardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assignee: {
    fontSize: "12px",
    color: "#6b7280",
  },
  templateBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    background: "#e0e7ff",
    color: "#4338ca",
    borderRadius: "4px",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#9ca3af",
  },
  emptyIcon: {
    fontSize: "32px",
    marginBottom: "8px",
    display: "block",
  },
  previewPane: {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
    display: "flex",
    flexDirection: "column",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 24px",
    borderBottom: "1px solid #f3f4f6",
  },
  previewSubject: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 6px",
  },
  previewMeta: {
    display: "flex",
    gap: "8px",
    fontSize: "13px",
    color: "#6b7280",
  },
  previewInfo: {
    padding: "16px 24px",
    background: "#f9fafb",
    borderBottom: "1px solid #f3f4f6",
  },
  infoRow: {
    display: "flex",
    gap: "8px",
    fontSize: "13px",
    marginBottom: "6px",
  },
  infoLabel: {
    color: "#6b7280",
    minWidth: "80px",
  },
  infoLink: {
    color: "#667eea",
    textDecoration: "none",
  },
  previewBody: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
  },
  emailBody: {
    fontFamily: "inherit",
    fontSize: "14px",
    lineHeight: 1.7,
    color: "#374151",
    whiteSpace: "pre-wrap" as const,
    margin: 0,
  },
  emailBodyHtml: {
    fontSize: "14px",
    lineHeight: 1.6,
    overflow: "auto",
  },
  editTextarea: {
    width: "100%",
    height: "100%",
    minHeight: "300px",
    padding: "16px",
    border: "1px solid #667eea",
    borderRadius: "8px",
    fontSize: "14px",
    lineHeight: 1.7,
    fontFamily: "inherit",
    resize: "none",
  },
  reviewNotes: {
    padding: "16px 24px",
    background: "#fef3c7",
    borderTop: "1px solid #fde68a",
  },
  reviewNotesLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#92400e",
    marginBottom: "4px",
  },
  previewActions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    padding: "16px 24px",
    borderTop: "1px solid #f3f4f6",
    background: "#f9fafb",
  },
  editBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  rejectBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  approveBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#10b981",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  sendBtn: {
    padding: "10px 24px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "14px",
    cursor: "pointer",
  },
  saveBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  resubmitBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  sentBadge: {
    padding: "10px 18px",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
  },
  noSelection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#9ca3af",
    textAlign: "center",
    padding: "40px",
  },
  noSelectionIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  // Tracking styles
  trackingStatsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  },
  trackingStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    borderRadius: "12px",
  },
  trackingStatValue: {
    fontSize: "28px",
    fontWeight: 700,
  },
  trackingStatLabel: {
    fontSize: "13px",
    color: "#6b7280",
    marginTop: "4px",
  },
  trackingFilters: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
    padding: "16px 20px",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  filterLabel: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    whiteSpace: "nowrap",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
    background: "#fff",
    minWidth: "160px",
  },
  checkRepliesBtn: {
    marginLeft: "auto",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  replySnippetBox: {
    padding: "16px 24px",
    background: "#ecfdf5",
    borderTop: "1px solid #d1fae5",
    borderBottom: "1px solid #d1fae5",
  },
  replySnippetLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#059669",
    marginBottom: "6px",
  },
  replySnippetText: {
    fontSize: "14px",
    color: "#065f46",
    lineHeight: 1.5,
    margin: 0,
  },
};

export default PendingEmails;
