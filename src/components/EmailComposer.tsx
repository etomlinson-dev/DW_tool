import { useState, useEffect } from "react";
import { templatesApi, emailsApi, leadsApi } from "../api/client";
import type { EmailTemplate, Lead } from "../types";

interface EmailComposerProps {
  lead?: Lead | null;
  onClose?: () => void;
  onSent?: () => void;
}

export function EmailComposer({ lead: initialLead, onClose, onSent }: EmailComposerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [to, setTo] = useState(initialLead?.email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Lead selection state (when no lead is provided)
  const [lead, setLead] = useState<Lead | null>(initialLead || null);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  // Load templates and leads on mount
  useEffect(() => {
    templatesApi
      .getTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoadingTemplates(false));

    // Load leads for selection if no initial lead
    if (!initialLead) {
      leadsApi
        .getLeads({ per_page: 500 })
        .then((resp) => setAllLeads(resp.data))
        .catch(console.error);
    }
  }, [initialLead]);

  // Update recipient when lead changes
  useEffect(() => {
    if (lead?.email) {
      setTo(lead.email);
    }
  }, [lead]);

  // Handle lead selection
  const handleSelectLead = (selectedLead: Lead) => {
    setLead(selectedLead);
    setTo(selectedLead.email || "");
    setLeadSearch(selectedLead.business_name);
    setShowLeadDropdown(false);
  };

  const filteredLeads = allLeads.filter((l) =>
    l.business_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
    (l.contact_name?.toLowerCase().includes(leadSearch.toLowerCase()) ?? false) ||
    (l.email?.toLowerCase().includes(leadSearch.toLowerCase()) ?? false)
  );

  // Apply template
  const handleTemplateSelect = (templateId: number) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setSubject(personalizeContent(template.subject));
      setBody(personalizeContent(template.body));
    }
  };

  // Personalize content with lead data
  const personalizeContent = (content: string): string => {
    if (!lead) return content;

    return content
      .replace(/{{business_name}}/g, lead.business_name || "")
      .replace(/{{contact_name}}/g, lead.contact_name || "")
      .replace(/{{first_name}}/g, lead.contact_name?.split(" ")[0] || "")
      .replace(/{{industry}}/g, lead.industry || "")
      .replace(/{{email}}/g, lead.email || "");
  };

  // Generate AI email
  const handleGenerateEmail = async () => {
    if (!lead) {
      setError("Please select a lead to generate an email");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const generated = await emailsApi.generateEmail(
        lead.id,
        selectedTemplateId || undefined
      );
      setSubject(generated.subject);
      setBody(generated.body);
    } catch (err) {
      console.error("Failed to generate email:", err);
      setError("Failed to generate email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Submit email for review (goes to pending_review queue)
  const handleSend = async () => {
    if (!to) {
      setError("Please enter a recipient email");
      return;
    }
    if (!subject) {
      setError("Please enter a subject");
      return;
    }
    if (!body) {
      setError("Please enter a message body");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/emails/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body,
          lead_id: lead?.id,
          template_id: selectedTemplateId,
          generated_by: "Manual",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit email");
      }

      setSuccess(true);
      setTimeout(() => {
        onSent?.();
        onClose?.();
      }, 1500);
    } catch (err: unknown) {
      console.error("Failed to submit email for review:", err);
      setError(err instanceof Error ? err.message : "Failed to submit email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    setSending(true);
    setError(null);

    try {
      await fetch("/api/emails/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body,
          lead_id: lead?.id,
          template_id: selectedTemplateId,
        }),
      });
      setSuccess(true);
      setTimeout(() => onClose?.(), 1000);
    } catch (err) {
      console.error("Failed to save draft:", err);
      setError("Failed to save draft.");
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <div style={styles.successContainer}>
        <div style={styles.successIcon}>✓</div>
        <h3 style={styles.successTitle}>Email Submitted for Review!</h3>
        <p style={styles.successText}>Your email to {to} is now pending approval in the Emails tab</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Compose Email</h2>
        {onClose && (
          <button onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        )}
      </div>

      {/* Template Selection */}
      <div style={styles.templateSection}>
        <label style={styles.label}>Template</label>
        <div style={styles.templateRow}>
          <select
            value={selectedTemplateId || ""}
            onChange={(e) => handleTemplateSelect(Number(e.target.value))}
            style={styles.templateSelect}
            disabled={loadingTemplates}
          >
            <option value="">
              {loadingTemplates ? "Loading templates..." : "Choose a template..."}
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.category || "General"})
              </option>
            ))}
          </select>
          
        </div>
      </div>

      {/* Lead Selection (when no lead prop provided) */}
      {!initialLead && (
        <div style={styles.field}>
          <label style={styles.label}>Link to Lead</label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={leadSearch}
              onChange={(e) => {
                setLeadSearch(e.target.value);
                setShowLeadDropdown(true);
                if (!e.target.value) {
                  setLead(null);
                  setTo("");
                }
              }}
              onFocus={() => setShowLeadDropdown(true)}
              placeholder="Search leads by name or email..."
              style={styles.input}
            />
            {showLeadDropdown && leadSearch && filteredLeads.length > 0 && (
              <div style={styles.leadDropdown}>
                {filteredLeads.slice(0, 8).map((l) => (
                  <div
                    key={l.id}
                    onClick={() => handleSelectLead(l)}
                    style={styles.leadOption}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                  >
                    <span style={{ fontWeight: 500, color: "#1f2937" }}>{l.business_name}</span>
                    {l.email && <span style={{ fontSize: "12px", color: "#6b7280" }}>{l.email}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {lead && (
            <div style={styles.selectedLead}>
              Linked: <strong>{lead.business_name}</strong> {lead.email && `(${lead.email})`}
              <button
                onClick={() => { setLead(null); setLeadSearch(""); setTo(""); }}
                style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", marginLeft: "8px", fontSize: "12px" }}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recipient */}
      <div style={styles.field}>
        <label style={styles.label}>To</label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          style={styles.input}
        />
      </div>

      {/* Subject */}
      <div style={styles.field}>
        <label style={styles.label}>Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject..."
          style={styles.input}
        />
      </div>

      {/* Body */}
      <div style={styles.field}>
        <label style={styles.label}>Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message here..."
          style={styles.textarea}
          rows={12}
        />
      </div>

      {/* Personalization Tags Help */}
      {lead && (
        <div style={styles.tagsHelp}>
          <span style={styles.tagsTitle}>Available tags:</span>
          <code style={styles.tag}>{"{{contact_name}}"}</code>
          <code style={styles.tag}>{"{{first_name}}"}</code>
          <code style={styles.tag}>{"{{business_name}}"}</code>
          <code style={styles.tag}>{"{{industry}}"}</code>
        </div>
      )}

      {/* Error Message */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Actions */}
      <div style={styles.actions}>
        <button onClick={handleSaveDraft} style={styles.draftBtn} disabled={sending}>
          Save Draft
        </button>
        <div style={styles.rightActions}>
          {onClose && (
            <button onClick={onClose} style={styles.cancelBtn} disabled={sending}>
              Cancel
            </button>
          )}
          <button onClick={handleSend} style={styles.sendBtn} disabled={sending}>
            {sending ? "Submitting..." : "Submit for Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    maxWidth: "700px",
    margin: "0 auto",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "1px solid #e5e7eb",
  },
  title: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "20px",
    color: "#9ca3af",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "4px",
  },
  templateSection: {
    marginBottom: "16px",
  },
  templateRow: {
    display: "flex",
    gap: "8px",
  },
  templateSelect: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
  },
  generateBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  field: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
    lineHeight: 1.6,
  },
  tagsHelp: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  tagsTitle: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  tag: {
    fontSize: "11px",
    padding: "2px 6px",
    background: "#f3f4f6",
    borderRadius: "4px",
    color: "#6b7280",
  },
  error: {
    padding: "12px",
    background: "#fef2f2",
    borderRadius: "8px",
    color: "#dc2626",
    fontSize: "14px",
    marginBottom: "16px",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
  },
  rightActions: {
    display: "flex",
    gap: "8px",
  },
  draftBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "14px",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "14px",
    cursor: "pointer",
  },
  sendBtn: {
    padding: "10px 24px",
    borderRadius: "8px",
    border: "none",
    background: "#10b981",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  successContainer: {
    background: "#fff",
    borderRadius: "16px",
    padding: "48px",
    textAlign: "center" as const,
    maxWidth: "400px",
    margin: "0 auto",
  },
  successIcon: {
    width: "64px",
    height: "64px",
    background: "#10b981",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
    color: "#fff",
    margin: "0 auto 16px",
  },
  successTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px",
  },
  successText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  leadDropdown: {
    position: "absolute" as const,
    top: "100%",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    zIndex: 10,
    maxHeight: "200px",
    overflowY: "auto" as const,
    marginTop: "4px",
  },
  leadOption: {
    padding: "10px 12px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    borderBottom: "1px solid #f3f4f6",
  },
  selectedLead: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#059669",
    padding: "6px 10px",
    background: "#ecfdf5",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
  },
};

export default EmailComposer;
