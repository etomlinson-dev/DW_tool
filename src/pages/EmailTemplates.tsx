import { useState, useEffect } from "react";
import { templatesApi } from "../api/client";
import type { EmailTemplate } from "../types";

export function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    subject: "",
    body: "",
    is_default: false,
  });

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await templatesApi.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category || "",
      subject: template.subject,
      body: template.body,
      is_default: template.is_default,
    });
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: "",
      category: "",
      subject: "",
      body: "",
      is_default: false,
    });
    setIsCreating(true);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        const newTemplate = await templatesApi.createTemplate(formData);
        setTemplates((prev) => [...prev, newTemplate]);
        setSelectedTemplate(newTemplate);
      } else if (selectedTemplate) {
        const updated = await templatesApi.updateTemplate(selectedTemplate.id, formData);
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSelectedTemplate(updated);
      }
      setIsEditing(false);
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (!confirm(`Delete template "${selectedTemplate.name}"?`)) return;

    try {
      await templatesApi.deleteTemplate(selectedTemplate.id);
      setTemplates((prev) => prev.filter((t) => t.id !== selectedTemplate.id));
      setSelectedTemplate(null);
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))];

  return (
    <div style={styles.container}>
      {/* Sidebar - Template List */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Email Templates</h2>
          <button onClick={handleCreate} style={styles.newBtn}>
            + New
          </button>
        </div>

        {/* Category Filter */}
        <div style={styles.categoryTabs}>
          <button style={{ ...styles.categoryTab, ...styles.categoryTabActive }}>
            All ({templates.length})
          </button>
          {categories.map((cat) => (
            <button key={cat} style={styles.categoryTab}>
              {cat} ({templates.filter((t) => t.category === cat).length})
            </button>
          ))}
        </div>

        {/* Template List */}
        <div style={styles.templateList}>
          {loading ? (
            <div style={styles.loading}>Loading templates...</div>
          ) : templates.length === 0 ? (
            <div style={styles.empty}>
              <p>No templates yet.</p>
              <button onClick={handleCreate} style={styles.createFirstBtn}>
                Create your first template
              </button>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                style={{
                  ...styles.templateItem,
                  ...(selectedTemplate?.id === template.id
                    ? styles.templateItemActive
                    : {}),
                }}
              >
                <div style={styles.templateItemHeader}>
                  <span style={styles.templateName}>{template.name}</span>
                  {template.is_default && <span style={styles.defaultBadge}>Default</span>}
                </div>
                <div style={styles.templateMeta}>
                  <span style={styles.templateCategory}>{template.category || "General"}</span>
                  <span style={styles.templateUsage}>{template.usage_count} uses</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Template Editor */}
      <div style={styles.main}>
        {selectedTemplate || isCreating ? (
          <>
            <div style={styles.editorHeader}>
              <div>
                <h3 style={styles.editorTitle}>
                  {isCreating ? "New Template" : selectedTemplate?.name}
                </h3>
                {!isCreating && selectedTemplate && (
                  <span style={styles.editorMeta}>
                    Last updated:{" "}
                    {new Date(selectedTemplate.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div style={styles.editorActions}>
                {!isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(true)} style={styles.editBtn}>
                      Edit
                    </button>
                    <button onClick={handleDelete} style={styles.deleteBtn}>
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setIsCreating(false);
                        if (!selectedTemplate) {
                          setFormData({
                            name: "",
                            category: "",
                            subject: "",
                            body: "",
                            is_default: false,
                          });
                        }
                      }}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                    <button onClick={handleSave} style={styles.saveBtn}>
                      Save Template
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={styles.editorContent}>
              {/* Name & Category Row */}
              <div style={styles.formRow}>
                <div style={styles.formField}>
                  <label style={styles.label}>Template Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    style={styles.input}
                    placeholder="e.g., Initial Outreach"
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.label}>Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    disabled={!isEditing}
                    style={styles.input}
                    placeholder="e.g., Follow-up, Introduction"
                  />
                </div>
              </div>

              {/* Subject */}
              <div style={styles.formField}>
                <label style={styles.label}>Subject Line</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  disabled={!isEditing}
                  style={styles.input}
                  placeholder="Email subject with {{contact_name}} variables"
                />
              </div>

              {/* Body */}
              <div style={styles.formField}>
                <label style={styles.label}>Email Body</label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  disabled={!isEditing}
                  style={styles.textarea}
                  rows={15}
                  placeholder="Write your email template here. Use {{contact_name}}, {{business_name}}, {{industry}} for personalization."
                />
              </div>

              {/* Default Checkbox */}
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) =>
                    setFormData({ ...formData, is_default: e.target.checked })
                  }
                  disabled={!isEditing}
                  style={styles.checkbox}
                />
                <span>Set as default template</span>
              </label>

              {/* Variable Reference */}
              <div style={styles.variableRef}>
                <h4 style={styles.variableRefTitle}>Available Variables</h4>
                <div style={styles.variableList}>
                  <code style={styles.variable}>{"{{contact_name}}"}</code>
                  <code style={styles.variable}>{"{{first_name}}"}</code>
                  <code style={styles.variable}>{"{{business_name}}"}</code>
                  <code style={styles.variable}>{"{{industry}}"}</code>
                  <code style={styles.variable}>{"{{email}}"}</code>
                  <code style={styles.variable}>{"{{phone}}"}</code>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📧</div>
            <h3 style={styles.emptyTitle}>Select or Create a Template</h3>
            <p style={styles.emptyText}>
              Choose a template from the list or create a new one to get started.
            </p>
            <button onClick={handleCreate} style={styles.createBtn}>
              + Create Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    height: "calc(100vh - 80px)",
    background: "#f9fafb",
  },
  sidebar: {
    width: "320px",
    background: "#fff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px",
    borderBottom: "1px solid #e5e7eb",
  },
  sidebarTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  newBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  categoryTabs: {
    display: "flex",
    gap: "4px",
    padding: "12px 16px",
    overflowX: "auto",
    borderBottom: "1px solid #e5e7eb",
  },
  categoryTab: {
    padding: "6px 12px",
    borderRadius: "16px",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  categoryTabActive: {
    background: "#667eea",
    color: "#fff",
  },
  templateList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px",
  },
  loading: {
    padding: "24px",
    textAlign: "center" as const,
    color: "#9ca3af",
  },
  empty: {
    padding: "24px",
    textAlign: "center" as const,
  },
  createFirstBtn: {
    marginTop: "12px",
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "13px",
    cursor: "pointer",
  },
  templateItem: {
    padding: "12px",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "4px",
  },
  templateItemActive: {
    background: "#eef2ff",
    border: "1px solid #667eea",
  },
  templateItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  templateName: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1f2937",
  },
  defaultBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    background: "#10b981",
    color: "#fff",
    borderRadius: "4px",
  },
  templateMeta: {
    display: "flex",
    justifyContent: "space-between",
  },
  templateCategory: {
    fontSize: "12px",
    color: "#6b7280",
  },
  templateUsage: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  editorTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  editorMeta: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  editorActions: {
    display: "flex",
    gap: "8px",
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
  deleteBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
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
  editorContent: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  formField: {
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
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#374151",
    marginBottom: "24px",
  },
  checkbox: {
    width: "16px",
    height: "16px",
  },
  variableRef: {
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "8px",
    marginTop: "16px",
  },
  variableRefTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 12px",
  },
  variableList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  variable: {
    fontSize: "12px",
    padding: "4px 8px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "4px",
    color: "#667eea",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px",
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

export default EmailTemplates;
