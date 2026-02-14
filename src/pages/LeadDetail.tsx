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
    return new Date(utc).toLocaleString();
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

  const tabStyles = {
    container: {
      display: "flex",
      gap: "4px",
      marginBottom: "24px",
      background: "#f3f4f6",
      padding: "4px",
      borderRadius: "12px",
      width: "fit-content",
    } as React.CSSProperties,
    tab: {
      padding: "10px 20px",
      border: "none",
      background: "transparent",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: 500,
      color: "#6b7280",
      cursor: "pointer",
    } as React.CSSProperties,
    activeTab: {
      background: "#fff",
      color: "#1f2937",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    } as React.CSSProperties,
  };

  return (
    <div className="lead-detail" style={{ padding: "24px", maxWidth: "1344px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => navigate(-1)}
            style={{ color: "#6b7280", textDecoration: "none", fontSize: "14px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1f2937", margin: 0 }}>
            {lead.business_name}
          </h1>
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
              background: "#fff",
            }}
          >
            {LEAD_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowComposer(true)}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          ✉️ Send Email
        </button>
      </div>

      {/* Tabs */}
      <div style={tabStyles.container}>
        {(["info", "activity", "outreach", "emails"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...tabStyles.tab,
              ...(activeTab === tab ? tabStyles.activeTab : {}),
            }}
          >
            {tab === "info" && "📋 Info"}
            {tab === "activity" && "📊 Activity"}
            {tab === "outreach" && "🎯 Outreach"}
            {tab === "emails" && `📧 Emails (${emails.length})`}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
        {/* Main Content */}
        <div>
          {activeTab === "info" && (
            <div className="card" style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", margin: 0 }}>Lead Information</h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{ padding: "6px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "13px", cursor: "pointer" }}
                  >
                    Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleSave}
                      style={{ padding: "6px 16px", borderRadius: "8px", border: "none", background: "#10b981", color: "#fff", fontSize: "13px", cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setIsEditing(false); setEditForm(lead); }}
                      style={{ padding: "6px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "13px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {[
                    { label: "Business Name", key: "business_name", type: "text" },
                    { label: "Contact Name", key: "contact_name", type: "text" },
                    { label: "Contact Title", key: "contact_title", type: "text" },
                    { label: "Email", key: "email", type: "email" },
                    { label: "Phone", key: "phone", type: "tel" },
                    { label: "Website", key: "website", type: "url" },
                    { label: "Industry", key: "industry", type: "text" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{ display: "block", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>{field.label}</label>
                      <input
                        type={field.type}
                        value={(editForm as Record<string, string>)[field.key] || ""}
                        onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "14px", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>Source</label>
                    <select
                      value={editForm.source || ""}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "14px" }}
                    >
                      <option value="">Select Source</option>
                      {LEAD_SOURCE_OPTIONS.map((source) => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>Service Category</label>
                    <select
                      value={editForm.service_category || ""}
                      onChange={(e) => setEditForm({ ...editForm, service_category: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "14px" }}
                    >
                      <option value="">Select Category</option>
                      {SERVICE_CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>Assigned Rep</label>
                    <select
                      value={editForm.assigned_rep || ""}
                      onChange={(e) => setEditForm({ ...editForm, assigned_rep: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "14px" }}
                    >
                      <option value="">Unassigned</option>
                      {reps.map((rep) => (
                        <option key={rep.id} value={rep.name}>{rep.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>Notes</label>
                    <textarea
                      value={editForm.notes || ""}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={4}
                      style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {[
                    { label: "Contact", value: lead.contact_name ? `${lead.contact_name}${lead.contact_title ? ` (${lead.contact_title})` : ''}` : null },
                    { label: "Email", value: lead.email, link: lead.email ? `mailto:${lead.email}` : undefined },
                    { label: "Phone", value: lead.phone, link: lead.phone ? `tel:${lead.phone}` : undefined },
                    { label: "Website", value: lead.website, link: lead.website || undefined },
                    { label: "Industry", value: lead.industry },
                    { label: "Service Category", value: lead.service_category },
                    { label: "Source", value: lead.source },
                    { label: "Assigned Rep", value: lead.assigned_rep || "Unassigned" },
                    { label: "Activities", value: lead.activity_count.toString() },
                    { label: "Last Activity", value: formatDate(lead.last_activity) },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
                      <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>{item.label}</span>
                      {item.link ? (
                        <a href={item.link} target={item.label === "Website" ? "_blank" : undefined} rel="noopener noreferrer" style={{ fontSize: "14px", color: "#667eea", textDecoration: "none" }}>{item.value || "N/A"}</a>
                      ) : (
                        <span style={{ fontSize: "14px", color: "#1f2937" }}>{item.value || "N/A"}</span>
                      )}
                    </div>
                  ))}
                  {/* Multiple emails */}
                  {(lead.emails?.length || 0) > 0 && (
                    <div style={{ gridColumn: "1 / -1", padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
                      <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "8px" }}>Additional Emails</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {lead.emails?.map((e, idx) => (
                          <a key={idx} href={`mailto:${e.email}`} style={{ padding: "4px 10px", background: "#eef2ff", color: "#4f46e5", borderRadius: "6px", fontSize: "13px", textDecoration: "none" }}>
                            {e.label}: {e.email}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Multiple phones */}
                  {(lead.phones?.length || 0) > 0 && (
                    <div style={{ gridColumn: "1 / -1", padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
                      <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "8px" }}>Additional Phones</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {lead.phones?.map((p, idx) => (
                          <a key={idx} href={`tel:${p.phone}`} style={{ padding: "4px 10px", background: "#f0fdf4", color: "#15803d", borderRadius: "6px", fontSize: "13px", textDecoration: "none" }}>
                            {p.label}: {p.phone}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {lead.notes && (
                    <div style={{ gridColumn: "1 / -1", padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
                      <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Notes</span>
                      <span style={{ fontSize: "14px", color: "#1f2937" }}>{lead.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="card" style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", margin: "0 0 20px" }}>Activity Log</h3>
              {logs.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px" }}>No activities logged yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {logs.map((log) => (
                    <div key={log.id} style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ padding: "4px 8px", background: "#667eea", color: "#fff", borderRadius: "6px", fontSize: "12px" }}>{log.activity_type}</span>
                          <span style={{ padding: "4px 8px", background: "#e5e7eb", borderRadius: "6px", fontSize: "12px" }}>{log.outcome}</span>
                        </div>
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>{formatDate(log.timestamp)}</span>
                      </div>
                      {log.notes && <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>{log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "outreach" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Response Tracking */}
              <div className="card" style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", margin: "0 0 20px" }}>Response Tracking</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Response Status</span>
                    <select
                      value={lead.response_status || "no_response"}
                      onChange={async (e) => {
                        const updated = await leadsApi.updateLead(lead.id, { 
                          response_status: e.target.value as ResponseStatus 
                        });
                        setLead(updated);
                      }}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    >
                      {RESPONSE_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{RESPONSE_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Follow-ups Sent</span>
                    <span style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937" }}>{lead.follow_up_count || 0}</span>
                  </div>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Next Follow-up</span>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: lead.next_follow_up_date ? "#1f2937" : "#9ca3af" }}>
                      {lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toLocaleDateString() : "Not scheduled"}
                    </span>
                  </div>
                </div>
                {lead.response_summary && (
                  <div style={{ padding: "16px", background: "#fef3c7", borderRadius: "12px", marginBottom: "16px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#92400e", marginBottom: "4px" }}>Response Summary</span>
                    <p style={{ fontSize: "14px", color: "#78350f", margin: 0 }}>{lead.response_summary}</p>
                  </div>
                )}
                {(lead.objections?.length || 0) > 0 && (
                  <div style={{ padding: "16px", background: "#fee2e2", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#991b1b", marginBottom: "8px" }}>Objections Raised</span>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      {lead.objections?.map((obj, idx) => (
                        <li key={idx} style={{ fontSize: "13px", color: "#b91c1c", marginBottom: "4px" }}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Outreach Timeline */}
              <div className="card" style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", margin: "0 0 20px" }}>Outreach Journey</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>First Outreach</span>
                    <span style={{ fontSize: "14px", color: "#1f2937" }}>
                      {lead.first_outreach_date ? formatDate(lead.first_outreach_date) : "Not contacted yet"}
                    </span>
                  </div>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Method</span>
                    <span style={{ fontSize: "14px", color: "#1f2937", textTransform: "capitalize" }}>
                      {lead.first_outreach_method || "N/A"}
                    </span>
                  </div>
                </div>
                {/* Email Timeline from Microsoft Integration */}
                <EmailTimelineView leadId={lead.id} />
              </div>

              {/* Deal Information */}
              <div className="card" style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", margin: "0 0 20px" }}>Deal Information</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Deal Value</span>
                    <span style={{ fontSize: "24px", fontWeight: 600, color: lead.deal_value ? "#10b981" : "#9ca3af" }}>
                      {lead.deal_value ? `$${lead.deal_value.toLocaleString()}` : "Not set"}
                    </span>
                  </div>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Expected Close</span>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: lead.expected_close_date ? "#1f2937" : "#9ca3af" }}>
                      {lead.expected_close_date ? new Date(lead.expected_close_date).toLocaleDateString() : "Not set"}
                    </span>
                  </div>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Service Category</span>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                      {lead.service_category || "Not specified"}
                    </span>
                  </div>
                  <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                    <span style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Decision Timeline</span>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                      {lead.decision_timeline || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "emails" && (
            <div className="card" style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", margin: 0 }}>Email History</h3>
                <button
                  onClick={() => setShowComposer(true)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#667eea", color: "#fff", fontSize: "13px", cursor: "pointer" }}
                >
                  + Compose
                </button>
              </div>
              {emails.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px", color: "#9ca3af" }}>
                  <p style={{ margin: "0 0 16px" }}>No emails sent yet.</p>
                  <button
                    onClick={() => setShowComposer(true)}
                    style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#667eea", color: "#fff", fontSize: "14px", cursor: "pointer" }}
                  >
                    Send First Email
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {emails.map((email) => (
                    <div key={email.id} style={{ padding: "16px", background: "#f9fafb", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>{email.subject}</span>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 500,
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

        {/* Sidebar - Quick Actions */}
        <div>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", margin: "0 0 16px" }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => openQuickLog("Call", "Attempted")}
                style={{ padding: "12px", borderRadius: "8px", border: "none", background: "#f0fdf4", color: "#15803d", fontSize: "13px", fontWeight: 500, cursor: "pointer", textAlign: "left" }}
              >
                📞 Log Call
              </button>
              <button
                onClick={() => setShowComposer(true)}
                style={{ padding: "12px", borderRadius: "8px", border: "none", background: "#eef2ff", color: "#4338ca", fontSize: "13px", fontWeight: 500, cursor: "pointer", textAlign: "left" }}
              >
                📧 Send Email
              </button>
              <button
                onClick={() => openQuickLog("Meeting", "Scheduled")}
                style={{ padding: "12px", borderRadius: "8px", border: "none", background: "#fef3c7", color: "#b45309", fontSize: "13px", fontWeight: 500, cursor: "pointer", textAlign: "left" }}
              >
                📅 Log Meeting
              </button>
              <button
                onClick={() => openQuickLog("Note", "Added")}
                style={{ padding: "12px", borderRadius: "8px", border: "none", background: "#f3f4f6", color: "#374151", fontSize: "13px", fontWeight: 500, cursor: "pointer", textAlign: "left" }}
              >
                📝 Add Note
              </button>
            </div>
          </div>

          {/* Lead Stats */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", margin: "0 0 16px" }}>Lead Stats</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>Total Activities</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>{lead.activity_count}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>Emails Sent</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>{emails.filter(e => e.status === "sent").length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>Calls Made</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>{logs.filter(l => l.activity_type === "Call").length}</span>
              </div>
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
