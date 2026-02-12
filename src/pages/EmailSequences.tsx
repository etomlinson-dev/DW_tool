import { useState, useEffect, useCallback } from "react";
import { templatesApi, sequencesApi, type EmailSequence as APIEmailSequence } from "../api/client";
import type { EmailTemplate } from "../types";

interface SequenceStep {
  id: number;
  templateId: number | null;
  templateName: string;
  delayDays: number;
  subject: string;
}

interface EmailSequence {
  id: number;
  name: string;
  description: string;
  status: "active" | "paused" | "draft";
  steps: SequenceStep[];
  leadsEnrolled: number;
  emailsSent: number;
  openRate: number;
  replyRate: number;
  createdAt: string;
}

// Map API sequence to UI format
const mapApiToSequence = (s: APIEmailSequence): EmailSequence => ({
  id: s.id,
  name: s.name,
  description: s.description || "",
  status: s.status as EmailSequence["status"],
  steps: s.steps.map(step => ({
    id: step.id,
    templateId: step.template_id || null,
    templateName: step.template_name || "Unknown",
    delayDays: step.delay_days,
    subject: step.subject_override || "",
  })),
  leadsEnrolled: s.leads_enrolled,
  emailsSent: s.emails_sent,
  openRate: s.open_rate,
  replyRate: s.reply_rate,
  createdAt: s.created_at?.split("T")[0] || "",
});

export function EmailSequences() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<EmailSequence | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  // New sequence form
  const [newSequence, setNewSequence] = useState({
    name: "",
    description: "",
    steps: [] as SequenceStep[],
  });

  // Fetch sequences from API
  const fetchSequences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sequencesApi.getSequences();
      setSequences(data.map(mapApiToSequence));
    } catch (err) {
      console.error("Failed to fetch sequences:", err);
      setError("Failed to load email sequences.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSequences();
    templatesApi.getTemplates().then(setTemplates).catch(console.error);
  }, [fetchSequences]);

  const handleCreateSequence = () => {
    setIsCreating(true);
    setSelectedSequence(null);
    setNewSequence({
      name: "",
      description: "",
      steps: [{ id: 1, templateId: null, templateName: "", delayDays: 0, subject: "" }],
    });
  };

  const handleAddStep = () => {
    setNewSequence((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: prev.steps.length + 1,
          templateId: null,
          templateName: "",
          delayDays: prev.steps.length > 0 ? prev.steps[prev.steps.length - 1].delayDays + 3 : 0,
          subject: "",
        },
      ],
    }));
  };

  const handleRemoveStep = (stepId: number) => {
    setNewSequence((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }));
  };

  const handleUpdateStep = (stepId: number, updates: Partial<SequenceStep>) => {
    setNewSequence((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
    }));
  };

  const handleSaveSequence = () => {
    const newSeq: EmailSequence = {
      id: sequences.length + 1,
      name: newSequence.name,
      description: newSequence.description,
      status: "draft",
      steps: newSequence.steps,
      leadsEnrolled: 0,
      emailsSent: 0,
      openRate: 0,
      replyRate: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setSequences((prev) => [...prev, newSeq]);
    setSelectedSequence(newSeq);
    setIsCreating(false);
  };

  const handleToggleStatus = (seq: EmailSequence) => {
    setSequences((prev) =>
      prev.map((s) =>
        s.id === seq.id
          ? { ...s, status: s.status === "active" ? "paused" : "active" }
          : s
      )
    );
    if (selectedSequence?.id === seq.id) {
      setSelectedSequence((prev) =>
        prev ? { ...prev, status: prev.status === "active" ? "paused" : "active" } : null
      );
    }
  };

  const getStatusStyle = (status: EmailSequence["status"]) => {
    switch (status) {
      case "active":
        return { background: "#d1fae5", color: "#059669" };
      case "paused":
        return { background: "#fef3c7", color: "#d97706" };
      case "draft":
        return { background: "#f3f4f6", color: "#6b7280" };
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Email Sequences</h1>
          <p style={styles.subtitle}>Automated drip campaigns for lead nurturing</p>
        </div>
        <button onClick={handleCreateSequence} style={styles.newBtn}>
          + New Sequence
        </button>
      </div>

      <div style={styles.content}>
        {/* Sequence List */}
        <div style={styles.listSection}>
          <div style={styles.listHeader}>
            <span style={styles.listTitle}>All Sequences</span>
            <span style={styles.listCount}>{sequences.length} sequences</span>
          </div>

          <div style={styles.sequenceList}>
            {sequences.map((seq) => (
              <div
                key={seq.id}
                onClick={() => {
                  setSelectedSequence(seq);
                  setIsCreating(false);
                }}
                style={{
                  ...styles.sequenceCard,
                  ...(selectedSequence?.id === seq.id ? styles.sequenceCardActive : {}),
                }}
              >
                <div style={styles.sequenceHeader}>
                  <span style={styles.sequenceName}>{seq.name}</span>
                  <span style={{ ...styles.statusBadge, ...getStatusStyle(seq.status) }}>
                    {seq.status}
                  </span>
                </div>
                <p style={styles.sequenceDesc}>{seq.description}</p>
                <div style={styles.sequenceStats}>
                  <span>{seq.steps.length} steps</span>
                  <span>•</span>
                  <span>{seq.leadsEnrolled} enrolled</span>
                  <span>•</span>
                  <span>{seq.openRate}% opens</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail/Editor Section */}
        <div style={styles.detailSection}>
          {isCreating ? (
            <>
              <div style={styles.detailHeader}>
                <h2 style={styles.detailTitle}>Create New Sequence</h2>
                <div style={styles.detailActions}>
                  <button
                    onClick={() => setIsCreating(false)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button onClick={handleSaveSequence} style={styles.saveBtn}>
                    Save Sequence
                  </button>
                </div>
              </div>

              <div style={styles.formSection}>
                <div style={styles.formField}>
                  <label style={styles.label}>Sequence Name</label>
                  <input
                    type="text"
                    value={newSequence.name}
                    onChange={(e) =>
                      setNewSequence({ ...newSequence, name: e.target.value })
                    }
                    placeholder="e.g., New Lead Nurture"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.label}>Description</label>
                  <input
                    type="text"
                    value={newSequence.description}
                    onChange={(e) =>
                      setNewSequence({ ...newSequence, description: e.target.value })
                    }
                    placeholder="Brief description of this sequence"
                    style={styles.input}
                  />
                </div>
              </div>

              <h3 style={styles.stepsTitle}>Sequence Steps</h3>
              <div style={styles.stepsList}>
                {newSequence.steps.map((step, index) => (
                  <div key={step.id} style={styles.stepCard}>
                    <div style={styles.stepNumber}>{index + 1}</div>
                    <div style={styles.stepContent}>
                      <div style={styles.stepRow}>
                        <div style={styles.stepField}>
                          <label style={styles.stepLabel}>Template</label>
                          <select
                            value={step.templateId || ""}
                            onChange={(e) => {
                              const template = templates.find(
                                (t) => t.id === Number(e.target.value)
                              );
                              handleUpdateStep(step.id, {
                                templateId: template?.id || null,
                                templateName: template?.name || "",
                                subject: template?.subject || "",
                              });
                            }}
                            style={styles.stepSelect}
                          >
                            <option value="">Select template...</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={styles.stepField}>
                          <label style={styles.stepLabel}>Delay (days)</label>
                          <input
                            type="number"
                            min="0"
                            value={step.delayDays}
                            onChange={(e) =>
                              handleUpdateStep(step.id, {
                                delayDays: parseInt(e.target.value) || 0,
                              })
                            }
                            style={styles.stepInput}
                          />
                        </div>
                      </div>
                      <div style={styles.stepField}>
                        <label style={styles.stepLabel}>Subject</label>
                        <input
                          type="text"
                          value={step.subject}
                          onChange={(e) =>
                            handleUpdateStep(step.id, { subject: e.target.value })
                          }
                          placeholder="Email subject line"
                          style={styles.input}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveStep(step.id)}
                      style={styles.removeStepBtn}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={handleAddStep} style={styles.addStepBtn}>
                  + Add Step
                </button>
              </div>
            </>
          ) : selectedSequence ? (
            <>
              <div style={styles.detailHeader}>
                <div>
                  <h2 style={styles.detailTitle}>{selectedSequence.name}</h2>
                  <p style={styles.detailSubtitle}>{selectedSequence.description}</p>
                </div>
                <div style={styles.detailActions}>
                  <button
                    onClick={() => handleToggleStatus(selectedSequence)}
                    style={{
                      ...styles.toggleBtn,
                      ...(selectedSequence.status === "active"
                        ? { background: "#fef3c7", color: "#d97706" }
                        : { background: "#d1fae5", color: "#059669" }),
                    }}
                  >
                    {selectedSequence.status === "active" ? "⏸ Pause" : "▶ Activate"}
                  </button>
                  <button style={styles.editBtn}>Edit</button>
                </div>
              </div>

              {/* Stats Cards */}
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <span style={styles.statValue}>{selectedSequence.leadsEnrolled}</span>
                  <span style={styles.statLabel}>Leads Enrolled</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statValue}>{selectedSequence.emailsSent}</span>
                  <span style={styles.statLabel}>Emails Sent</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statValue}>{selectedSequence.openRate}%</span>
                  <span style={styles.statLabel}>Open Rate</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statValue}>{selectedSequence.replyRate}%</span>
                  <span style={styles.statLabel}>Reply Rate</span>
                </div>
              </div>

              {/* Sequence Timeline */}
              <h3 style={styles.stepsTitle}>Sequence Steps</h3>
              <div style={styles.timeline}>
                {selectedSequence.steps.map((step, index) => (
                  <div key={step.id} style={styles.timelineStep}>
                    <div style={styles.timelineConnector}>
                      <div style={styles.timelineDot} />
                      {index < selectedSequence.steps.length - 1 && (
                        <div style={styles.timelineLine} />
                      )}
                    </div>
                    <div style={styles.timelineContent}>
                      <div style={styles.timelineHeader}>
                        <span style={styles.timelineDay}>
                          {step.delayDays === 0 ? "Immediately" : `Day ${step.delayDays}`}
                        </span>
                        <span style={styles.timelineTemplate}>{step.templateName}</span>
                      </div>
                      <p style={styles.timelineSubject}>{step.subject}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Enrolled Leads Preview */}
              <div style={styles.enrolledSection}>
                <h3 style={styles.enrolledTitle}>Recently Enrolled</h3>
                <p style={styles.enrolledEmpty}>
                  {selectedSequence.leadsEnrolled} leads are currently in this sequence.
                </p>
                <button style={styles.viewAllBtn}>View All Enrolled Leads</button>
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📧</div>
              <h3 style={styles.emptyTitle}>Select or Create a Sequence</h3>
              <p style={styles.emptyText}>
                Choose a sequence from the list or create a new one to get started with automated email campaigns.
              </p>
              <button onClick={handleCreateSequence} style={styles.createBtn}>
                + Create Sequence
              </button>
            </div>
          )}
        </div>
      </div>
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
  newBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  content: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "24px",
  },
  listSection: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  listTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  listCount: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  sequenceList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sequenceCard: {
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "12px",
    cursor: "pointer",
    border: "2px solid transparent",
    transition: "all 0.2s",
  },
  sequenceCardActive: {
    background: "#eef2ff",
    borderColor: "#667eea",
  },
  sequenceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  sequenceName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  statusBadge: {
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 500,
    textTransform: "capitalize" as const,
  },
  sequenceDesc: {
    fontSize: "13px",
    color: "#6b7280",
    margin: "0 0 8px",
  },
  sequenceStats: {
    display: "flex",
    gap: "8px",
    fontSize: "12px",
    color: "#9ca3af",
  },
  detailSection: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    paddingBottom: "20px",
    borderBottom: "1px solid #e5e7eb",
  },
  detailTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  detailSubtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  detailActions: {
    display: "flex",
    gap: "8px",
  },
  toggleBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  editBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "13px",
    cursor: "pointer",
  },
  saveBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#10b981",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "24px",
  },
  statCard: {
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "12px",
    textAlign: "center" as const,
  },
  statValue: {
    display: "block",
    fontSize: "24px",
    fontWeight: 700,
    color: "#1f2937",
  },
  statLabel: {
    fontSize: "12px",
    color: "#6b7280",
  },
  stepsTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
  },
  timelineStep: {
    display: "flex",
    gap: "16px",
  },
  timelineConnector: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "24px",
  },
  timelineDot: {
    width: "12px",
    height: "12px",
    background: "#667eea",
    borderRadius: "50%",
    flexShrink: 0,
  },
  timelineLine: {
    width: "2px",
    flex: 1,
    background: "#e5e7eb",
    margin: "4px 0",
  },
  timelineContent: {
    flex: 1,
    paddingBottom: "20px",
  },
  timelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  timelineDay: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#667eea",
  },
  timelineTemplate: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  timelineSubject: {
    fontSize: "14px",
    color: "#1f2937",
    margin: 0,
  },
  formSection: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "24px",
  },
  formField: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: "6px",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
  },
  stepsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  stepCard: {
    display: "flex",
    gap: "16px",
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "12px",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: "32px",
    height: "32px",
    background: "#667eea",
    color: "#fff",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: 600,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  stepRow: {
    display: "grid",
    gridTemplateColumns: "1fr 120px",
    gap: "12px",
  },
  stepField: {
    display: "flex",
    flexDirection: "column",
  },
  stepLabel: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "4px",
  },
  stepSelect: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
  },
  stepInput: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
  },
  removeStepBtn: {
    width: "28px",
    height: "28px",
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  addStepBtn: {
    padding: "12px",
    borderRadius: "8px",
    border: "2px dashed #e5e7eb",
    background: "transparent",
    color: "#6b7280",
    fontSize: "14px",
    cursor: "pointer",
  },
  enrolledSection: {
    marginTop: "24px",
    paddingTop: "24px",
    borderTop: "1px solid #e5e7eb",
  },
  enrolledTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 12px",
  },
  enrolledEmpty: {
    fontSize: "13px",
    color: "#6b7280",
    margin: "0 0 12px",
  },
  viewAllBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    cursor: "pointer",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px",
    textAlign: "center" as const,
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px",
  },
  emptyText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "0 0 24px",
    maxWidth: "300px",
  },
  createBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
};

export default EmailSequences;
