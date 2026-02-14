import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { leadsApi, logsApi } from "../api/client";
import { EmailComposer, EmailTimelineView } from "../components";
import type { Lead, Log, LeadStatus, GeneratedEmail, ResponseStatus } from "../types";
import { 
  LEAD_STATUS_OPTIONS, 
  LEAD_SOURCE_OPTIONS,
  SERVICE_CATEGORY_OPTIONS,
  OUTREACH_METHOD_OPTIONS,
  RESPONSE_STATUS_OPTIONS,
  RESPONSE_STATUS_LABELS,
} from "../types";

type TabType = "info" | "activity" | "emails" | "outreach";

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [showComposer, setShowComposer] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [reps, setReps] = useState<{ id: number; name: string }[]>([]);

  // Load team members for assigned rep dropdown
  useEffect(() => {
    fetch("/api/team/sso")
      .then((r) => r.json())
      .then(setReps)
      .catch(console.error);
  }, []);

  // Load lead, logs, and emails
  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [leadData, logsData] = await Promise.all([
          leadsApi.getLead(parseInt(id)),
          logsApi.getLogsForLead(parseInt(id)),
        ]);
        setLead(leadData);
        setLogs(logsData);
        setEditForm(leadData);

        // Load emails for this lead
        try {
          const emailsResponse = await fetch(`/api/leads/${id}/emails`);
          if (emailsResponse.ok) {
            const emailsData = await emailsResponse.json();
            setEmails(emailsData);
          }
        } catch {
          // Emails endpoint may not exist yet, that's okay
        }
      } catch (err) {
        console.error("Failed to load lead:", err);
        setError("Failed to load lead details.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleStatusChange = async (status: LeadStatus) => {
    if (!lead) return;
    try {
      const updated = await leadsApi.updateLeadStatus(lead.id, status);
      setLead(updated);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleSave = async () => {
    if (!lead) return;
    try {
      const updated = await leadsApi.updateLead(lead.id, editForm);
      setLead(updated);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save lead:", err);
    }
  };

  const [quickLogModal, setQuickLogModal] = useState<{ type: string; outcome: string } | null>(null);
  const [quickLogNotes, setQuickLogNotes] = useState("");
  const [quickLogSaving, setQuickLogSaving] = useState(false);
  const [quickLogSuccess, setQuickLogSuccess] = useState<string | null>(null);

  const openQuickLog = (activityType: string, outcome: string) => {
    setQuickLogNotes("");
    setQuickLogModal({ type: activityType, outcome });
  };

  const handleQuickLogSubmit = async () => {
    if (!lead || !quickLogModal) return;
    setQuickLogSaving(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}/quick-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: quickLogModal.type,
          outcome: quickLogModal.outcome,
          notes: quickLogNotes,
        }),
      });
      if (!response.ok) throw new Error("Failed to log");
      const newLog = await response.json();
      setLogs((prev) => [newLog, ...prev]);
      const updatedLead = await leadsApi.getLead(lead.id);
      setLead(updatedLead);
      setQuickLogModal(null);
      setQuickLogSuccess(`${quickLogModal.type} logged successfully!`);
      setTimeout(() => setQuickLogSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to log activity:", err);
      alert("Failed to log activity. Please try again.");
    } finally {
      setQuickLogSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const utc = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
    return new Date(utc).toLocaleString("en-US", { timeZone: "America/New_York" });
  };

  if (loading) {
    return <div className="loading">Loading lead details...</div>;
  }

  if (error || !lead) {
    return (
      <div className="error-page">
        <h2>Error</h2>
        <p>{error || "Lead not found"}</p>
        <Link to="/" className="btn">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
    "New": { bg: "#eef2ff", text: "#4338ca", dot: "#6366f1" },
    "Contacted": { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
    "Qualified": { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
    "Proposal": { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
    "Negotiation": { bg: "#fce7f3", text: "#9d174d", dot: "#ec4899" },
    "Won": { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
    "Lost": { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  };

  const currentStatusColor = statusColors[lead.status] || { bg: "#f3f4f6", text: "#374151", dot: "#6b7280" };

  const activityIcons: Record<string, string> = {
    "Call": "📞", "Email": "📧", "Meeting": "📅", "Note": "📝",
  };

  return (
    <div className="lead-detail" style={{ padding: "32px 40px", maxWidth: "1344px", margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: "#9ca3af", fontSize: "13px", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "6px" }}
        >
          <span style={{ fontSize: "16px" }}>&#8592;</span> Back to Leads
        </button>
      </div>

      {/* Hero Header Card */}
      <div style={{
        background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
        borderRadius: "20px",
        padding: "28px 32px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        border: "1px solid #f0f0f0",
        marginBottom: "28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
          {/* Avatar / Initial */}
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "22px",
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {(lead.business_name || "?")[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1f2937", margin: "0 0 6px" }}>
              {lead.business_name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              {/* Status Badge */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: currentStatusColor.bg,
                fontSize: "12px",
                fontWeight: 600,
                color: currentStatusColor.text,
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: currentStatusColor.dot }} />
                {lead.status}
              </div>
              {lead.industry && (
                <span style={{ fontSize: "13px", color: "#6b7280" }}>{lead.industry}</span>
              )}
              {lead.assigned_rep && (
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  <span style={{ color: "#d1d5db" }}>|</span> {lead.assigned_rep}
                </span>
              )}
            </div>
            {/* Contact quick-info row */}
            <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
              {lead.email && (
                <a href={`mailto:${lead.email}`} style={{ fontSize: "13px", color: "#667eea", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>&#9993;</span> {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} style={{ fontSize: "13px", color: "#667eea", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>&#9742;</span> {lead.phone}
                </a>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#667eea", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>&#127760;</span> Website
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            style={{
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
              background: "#fff",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            {LEAD_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (!confirm(`Delete "${lead.business_name}"? This cannot be undone.`)) return;
              try {
                await leadsApi.deleteLead(lead.id);
                navigate("/");
              } catch (err) {
                console.error("Failed to delete lead:", err);
                alert("Failed to delete lead.");
              }
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid #fecaca",
              background: "#fff",
              color: "#ef4444",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Delete
          </button>
          <button
            onClick={() => setShowComposer(true)}
            style={{
              padding: "8px 18px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Send Email
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: "2px",
        marginBottom: "24px",
        background: "#f3f4f6",
        padding: "4px",
        borderRadius: "14px",
        width: "fit-content",
      }}>
        {(["info", "activity", "outreach", "emails"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "9px 22px",
              border: "none",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              ...(activeTab === tab
                ? { background: "#fff", color: "#1f2937", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { background: "transparent", color: "#9ca3af" }),
            }}
          >
            {tab === "info" && "Info"}
            {tab === "activity" && "Activity"}
            {tab === "outreach" && "Outreach"}
            {tab === "emails" && `Emails (${emails.length})`}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px" }}>
        {/* Main Content */}
        <div>
          {activeTab === "info" && (
            <div style={{
              background: "#fff",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
              border: "1px solid #f0f0f0",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1f2937", margin: 0, letterSpacing: "-0.01em" }}>Lead Information</h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: "7px 18px",
                      borderRadius: "10px",
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      color: "#374151",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                  >
                    Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleSave}
                      style={{ padding: "7px 18px", borderRadius: "10px", border: "none", background: "#10b981", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setIsEditing(false); setEditForm(lead); }}
                      style={{ padding: "7px 18px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "13px", fontWeight: 500, cursor: "pointer", color: "#374151" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                  {[
                    { label: "Business Name", key: "business_name", type: "text" },
                    { label: "Contact Name", key: "contact_name", type: "text" },
                    { label: "Contact Title", key: "contact_title", type: "text" },
                    { label: "Email", key: "email", type: "email" },
                    { label: "Phone", key: "phone", type: "tel" },
                    { label: "Website", key: "website", type: "url" },
                    { label: "Industry", key: "industry", type: "text" },
                    { label: "Location", key: "location", type: "text" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{field.label}</label>
                      <input
                        type={field.type}
                        value={(editForm as Record<string, string>)[field.key] || ""}
                        onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px", boxSizing: "border-box", transition: "border-color 0.15s ease", outline: "none" }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "#667eea"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Source</label>
                    <select
                      value={editForm.source || ""}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px" }}
                    >
                      <option value="">Select Source</option>
                      {LEAD_SOURCE_OPTIONS.map((source) => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Service Category</label>
                    <select
                      value={editForm.service_category || ""}
                      onChange={(e) => setEditForm({ ...editForm, service_category: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px" }}
                    >
                      <option value="">Select Category</option>
                      {SERVICE_CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Assigned Rep</label>
                    <select
                      value={editForm.assigned_rep || ""}
                      onChange={(e) => setEditForm({ ...editForm, assigned_rep: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px" }}
                    >
                      <option value="">Unassigned</option>
                      {reps.map((rep) => (
                        <option key={rep.id} value={rep.name}>{rep.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Notes</label>
                    <textarea
                      value={editForm.notes || ""}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={4}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#667eea"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                  {[
                    { label: "Contact", value: lead.contact_name ? `${lead.contact_name}${lead.contact_title ? ` - ${lead.contact_title}` : ''}` : null },
                    { label: "Email", value: lead.email, link: lead.email ? `mailto:${lead.email}` : undefined },
                    { label: "Phone", value: lead.phone, link: lead.phone ? `tel:${lead.phone}` : undefined },
                    { label: "Website", value: lead.website, link: lead.website || undefined },
                    { label: "Industry", value: lead.industry },
                    { label: "Location", value: lead.location },
                    { label: "Service Category", value: lead.service_category },
                    { label: "Source", value: lead.source },
                    { label: "Assigned Rep", value: lead.assigned_rep || "Unassigned" },
                    { label: "Activities", value: lead.activity_count.toString() },
                    { label: "Last Activity", value: formatDate(lead.last_activity) },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "14px 16px", borderRadius: "12px", transition: "background 0.15s ease" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</span>
                      {item.link ? (
                        <a href={item.link} target={item.label === "Website" ? "_blank" : undefined} rel="noopener noreferrer" style={{ fontSize: "14px", color: "#667eea", textDecoration: "none", fontWeight: 500 }}>{item.value || "N/A"}</a>
                      ) : (
                        <span style={{ fontSize: "14px", color: "#1f2937", fontWeight: 500 }}>{item.value || "N/A"}</span>
                      )}
                    </div>
                  ))}
                  {/* Multiple emails */}
                  {(lead.emails?.length || 0) > 0 && (
                    <div style={{ gridColumn: "1 / -1", padding: "14px 16px", borderRadius: "12px", background: "#f9fafb" }}>
                      <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Additional Emails</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {lead.emails?.map((e, idx) => (
                          <a key={idx} href={`mailto:${e.email}`} style={{ padding: "5px 12px", background: "#eef2ff", color: "#4f46e5", borderRadius: "8px", fontSize: "13px", textDecoration: "none", fontWeight: 500 }}>
                            {e.label}: {e.email}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Multiple phones */}
                  {(lead.phones?.length || 0) > 0 && (
                    <div style={{ gridColumn: "1 / -1", padding: "14px 16px", borderRadius: "12px", background: "#f9fafb" }}>
                      <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Additional Phones</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {lead.phones?.map((p, idx) => (
                          <a key={idx} href={`tel:${p.phone}`} style={{ padding: "5px 12px", background: "#f0fdf4", color: "#15803d", borderRadius: "8px", fontSize: "13px", textDecoration: "none", fontWeight: 500 }}>
                            {p.label}: {p.phone}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {lead.notes && (
                    <div style={{ gridColumn: "1 / -1", padding: "14px 16px", borderRadius: "12px", background: "#f9fafb" }}>
                      <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</span>
                      <span style={{ fontSize: "14px", color: "#1f2937", lineHeight: 1.6 }}>{lead.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div style={{
              background: "#fff",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
              border: "1px solid #f0f0f0",
            }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1f2937", margin: "0 0 24px", letterSpacing: "-0.01em" }}>Activity Log</h3>
              {logs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.5 }}>📋</div>
                  <p style={{ fontSize: "14px", margin: 0 }}>No activities logged yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {logs.map((log) => (
                    <div key={log.id} style={{
                      padding: "16px 18px",
                      borderRadius: "14px",
                      border: "1px solid #f3f4f6",
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#f3f4f6"; }}
                    >
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: log.activity_type === "Call" ? "#f0fdf4" : log.activity_type === "Email" ? "#eef2ff" : log.activity_type === "Meeting" ? "#fef3c7" : "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        flexShrink: 0,
                      }}>
                        {activityIcons[log.activity_type] || "📌"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>{log.activity_type}</span>
                            <span style={{ fontSize: "12px", color: "#9ca3af", background: "#f3f4f6", padding: "2px 8px", borderRadius: "6px" }}>{log.outcome}</span>
                          </div>
                          <span style={{ fontSize: "12px", color: "#9ca3af" }}>{formatDate(log.timestamp)}</span>
                        </div>
                        {log.notes && <p style={{ fontSize: "13px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{log.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "outreach" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Response Tracking */}
              <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)", border: "1px solid #f0f0f0" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1f2937", margin: "0 0 20px", letterSpacing: "-0.01em" }}>Response Tracking</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "20px" }}>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Response Status</span>
                    <select
                      value={lead.response_status || "no_response"}
                      onChange={async (e) => {
                        const updated = await leadsApi.updateLead(lead.id, { response_status: e.target.value as ResponseStatus });
                        setLead(updated);
                      }}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    >
                      {RESPONSE_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{RESPONSE_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Follow-ups Sent</span>
                    <span style={{ fontSize: "28px", fontWeight: 700, color: "#1f2937" }}>{lead.follow_up_count || 0}</span>
                  </div>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Next Follow-up</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: lead.next_follow_up_date ? "#1f2937" : "#d1d5db" }}>
                      {lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toLocaleDateString("en-US", { timeZone: "America/New_York" }) : "Not scheduled"}
                    </span>
                  </div>
                </div>
                {lead.response_summary && (
                  <div style={{ padding: "16px", background: "#fffbeb", borderRadius: "14px", marginBottom: "16px", border: "1px solid #fde68a" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#92400e", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Response Summary</span>
                    <p style={{ fontSize: "14px", color: "#78350f", margin: 0, lineHeight: 1.5 }}>{lead.response_summary}</p>
                  </div>
                )}
                {(lead.objections?.length || 0) > 0 && (
                  <div style={{ padding: "16px", background: "#fef2f2", borderRadius: "14px", border: "1px solid #fecaca" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#991b1b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Objections Raised</span>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      {lead.objections?.map((obj, idx) => (
                        <li key={idx} style={{ fontSize: "13px", color: "#b91c1c", marginBottom: "4px" }}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Outreach Timeline */}
              <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)", border: "1px solid #f0f0f0" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1f2937", margin: "0 0 20px", letterSpacing: "-0.01em" }}>Outreach Journey</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>First Outreach</span>
                    <span style={{ fontSize: "14px", color: "#1f2937", fontWeight: 500 }}>
                      {lead.first_outreach_date ? formatDate(lead.first_outreach_date) : "Not contacted yet"}
                    </span>
                  </div>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Method</span>
                    <span style={{ fontSize: "14px", color: "#1f2937", fontWeight: 500, textTransform: "capitalize" }}>
                      {lead.first_outreach_method || "N/A"}
                    </span>
                  </div>
                </div>
                <EmailTimelineView leadId={lead.id} />
              </div>

              {/* Deal Information */}
              <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)", border: "1px solid #f0f0f0" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1f2937", margin: "0 0 20px", letterSpacing: "-0.01em" }}>Deal Information</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Deal Value</span>
                    <span style={{ fontSize: "28px", fontWeight: 700, color: lead.deal_value ? "#10b981" : "#d1d5db" }}>
                      {lead.deal_value ? `$${lead.deal_value.toLocaleString()}` : "Not set"}
                    </span>
                  </div>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Expected Close</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: lead.expected_close_date ? "#1f2937" : "#d1d5db" }}>
                      {lead.expected_close_date ? new Date(lead.expected_close_date).toLocaleDateString("en-US", { timeZone: "America/New_York" }) : "Not set"}
                    </span>
                  </div>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Service Category</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                      {lead.service_category || "Not specified"}
                    </span>
                  </div>
                  <div style={{ padding: "18px", background: "#f9fafb", borderRadius: "14px" }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Decision Timeline</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                      {lead.decision_timeline || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "emails" && (
            <div style={{
              background: "#fff",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
              border: "1px solid #f0f0f0",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1f2937", margin: 0, letterSpacing: "-0.01em" }}>Email History</h3>
                <button
                  onClick={() => setShowComposer(true)}
                  style={{ padding: "7px 18px", borderRadius: "10px", border: "none", background: "#667eea", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  + Compose
                </button>
              </div>
              {emails.length === 0 ? (
                <div style={{ textAlign: "center", padding: "56px 24px", color: "#9ca3af" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.4 }}>📧</div>
                  <p style={{ margin: "0 0 20px", fontSize: "14px" }}>No emails sent yet.</p>
                  <button
                    onClick={() => setShowComposer(true)}
                    style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Send First Email
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {emails.map((email) => (
                    <div key={email.id} style={{
                      padding: "16px 18px",
                      borderRadius: "14px",
                      border: "1px solid #f3f4f6",
                      transition: "all 0.15s ease",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#f3f4f6"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>{email.subject}</span>
                        <span style={{
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: email.status === "sent" ? "#d1fae5" : email.status === "draft" ? "#f3f4f6" : "#fef3c7",
                          color: email.status === "sent" ? "#059669" : email.status === "draft" ? "#6b7280" : "#d97706",
                        }}>{email.status}</span>
                      </div>
                      <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 8px", lineHeight: 1.5 }}>
                        {email.body.substring(0, 150)}...
                      </p>
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                        {email.sent_at ? `Sent ${formatDate(email.sent_at)}` : `Created ${formatDate(email.generated_at)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Quick Actions */}
          <div style={{
            background: "#fff",
            borderRadius: "20px",
            padding: "22px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
            border: "1px solid #f0f0f0",
          }}>
            <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                { label: "Log Call", icon: "📞", bg: "#f0fdf4", hoverBg: "#dcfce7", color: "#15803d", action: () => openQuickLog("Call", "Attempted") },
                { label: "Send Email", icon: "📧", bg: "#eef2ff", hoverBg: "#e0e7ff", color: "#4338ca", action: () => setShowComposer(true) },
                { label: "Log Meeting", icon: "📅", bg: "#fffbeb", hoverBg: "#fef3c7", color: "#b45309", action: () => openQuickLog("Meeting", "Scheduled") },
                { label: "Add Note", icon: "📝", bg: "#f9fafb", hoverBg: "#f3f4f6", color: "#374151", action: () => openQuickLog("Note", "Added") },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    padding: "11px 14px",
                    borderRadius: "12px",
                    border: "none",
                    background: item.bg,
                    color: item.color,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = item.hoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.background = item.bg}
                >
                  <span style={{ fontSize: "15px" }}>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lead Stats */}
          <div style={{
            background: "#fff",
            borderRadius: "20px",
            padding: "22px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
            border: "1px solid #f0f0f0",
          }}>
            <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Lead Stats</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "Total Activities", value: lead.activity_count, color: "#667eea" },
                { label: "Emails Sent", value: emails.filter(e => e.status === "sent").length, color: "#8b5cf6" },
                { label: "Calls Made", value: logs.filter(l => l.activity_type === "Call").length, color: "#10b981" },
              ].map((stat) => (
                <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>{stat.label}</span>
                  <span style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: stat.color,
                    background: `${stat.color}12`,
                    padding: "3px 12px",
                    borderRadius: "8px",
                    minWidth: "28px",
                    textAlign: "center",
                  }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Email Composer Modal */}
      {showComposer && (
        <div
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
          <EmailComposer
            lead={lead}
            onClose={() => setShowComposer(false)}
            onSent={async () => {
              setShowComposer(false);
              // Auto-log the email send
              if (lead) {
                try {
                  const response = await fetch(`/api/leads/${lead.id}/quick-log`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activity_type: "Email", outcome: "Sent", notes: "" }),
                  });
                  if (response.ok) {
                    const newLog = await response.json();
                    setLogs((prev) => [newLog, ...prev]);
                    const updatedLead = await leadsApi.getLead(lead.id);
                    setLead(updatedLead);
                  }
                } catch { /* non-fatal */ }
              }
            }}
          />
        </div>
      )}

      {/* Quick Log Modal */}
      {quickLogModal && (
        <div
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
            if (e.target === e.currentTarget) setQuickLogModal(null);
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "28px",
            width: "100%",
            maxWidth: "460px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1f2937" }}>
                {quickLogModal.type === "Call" && "📞 Log Call"}
                {quickLogModal.type === "Meeting" && "📅 Log Meeting"}
                {quickLogModal.type === "Note" && "📝 Add Note"}
              </h3>
              <button
                onClick={() => setQuickLogModal(null)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}
              >
                x
              </button>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Lead:</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937", marginLeft: "8px" }}>{lead?.business_name}</span>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Type:</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937", marginLeft: "8px" }}>{quickLogModal.type} - {quickLogModal.outcome}</span>
            </div>

            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              Notes {quickLogModal.type === "Note" ? "(required)" : "(optional)"}
            </label>
            <textarea
              value={quickLogNotes}
              onChange={(e) => setQuickLogNotes(e.target.value)}
              placeholder={
                quickLogModal.type === "Call" ? "Call summary, who you spoke with, next steps..." :
                quickLogModal.type === "Meeting" ? "Meeting details, attendees, topics discussed..." :
                "Add your note here..."
              }
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              autoFocus
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
              <button
                onClick={() => setQuickLogModal(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#374151",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleQuickLogSubmit}
                disabled={quickLogSaving || (quickLogModal.type === "Note" && !quickLogNotes.trim())}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: quickLogSaving ? "#9ca3af" : "#16a34a",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: quickLogSaving ? "not-allowed" : "pointer",
                }}
              >
                {quickLogSaving ? "Saving..." : `Log ${quickLogModal.type}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {quickLogSuccess && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "#16a34a",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 2000,
        }}>
          {quickLogSuccess}
        </div>
      )}
    </div>
  );
}

export default LeadDetail;
