import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { leadsApi } from "../api/client";
import {
  LEAD_STATUS_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  SERVICE_CATEGORY_OPTIONS,
} from "../types";

interface SsoMember {
  id: number;
  name: string;
  email: string;
}

export function NewLead() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [reps, setReps] = useState<SsoMember[]>([]);

  useEffect(() => {
    fetch("/api/team/sso")
      .then((r) => r.json())
      .then(setReps)
      .catch(console.error);
  }, []);
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    contact_title: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    source: "",
    status: "Not Contacted",
    service_category: "",
    assigned_rep: "",
    notes: "",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name.trim()) {
      alert("Business name is required");
      return;
    }
    setSaving(true);
    try {
      const result = await leadsApi.createLead({
        business_name: form.business_name,
        contact_name: form.contact_name || undefined,
        contact_title: form.contact_title || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        industry: form.industry || undefined,
        source: form.source || undefined,
        status: form.status as never,
        service_category: form.service_category || undefined,
        assigned_rep: form.assigned_rep || undefined,
        notes: form.notes || undefined,
      });
      navigate(`/lead/${result.id}`);
    } catch (err) {
      console.error("Failed to create lead:", err);
      alert("Failed to create lead. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>New Lead</h2>
          <button onClick={() => navigate("/")} style={styles.cancelBtn}>
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Business Info */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Business Information</h3>
            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Business Name *</label>
                <input
                  type="text"
                  value={form.business_name}
                  onChange={(e) => update("business_name", e.target.value)}
                  placeholder="Company name"
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Industry</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                  placeholder="e.g. Technology, Healthcare"
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://example.com"
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Service Category</label>
                <select
                  value={form.service_category}
                  onChange={(e) => update("service_category", e.target.value)}
                  style={styles.select}
                >
                  <option value="">Select...</option>
                  {SERVICE_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Contact Information</h3>
            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Contact Name</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => update("contact_name", e.target.value)}
                  placeholder="Full name"
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Title / Role</label>
                <input
                  type="text"
                  value={form.contact_title}
                  onChange={(e) => update("contact_title", e.target.value)}
                  placeholder="e.g. CEO, Marketing Director"
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="email@example.com"
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Lead Details */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Lead Details</h3>
            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                  style={styles.select}
                >
                  {LEAD_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Source</label>
                <select
                  value={form.source}
                  onChange={(e) => update("source", e.target.value)}
                  style={styles.select}
                >
                  <option value="">Select...</option>
                  {LEAD_SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Assigned Rep</label>
                <select
                  value={form.assigned_rep}
                  onChange={(e) => update("assigned_rep", e.target.value)}
                  style={styles.select}
                >
                  <option value="">Select rep...</option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.name}>{rep.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ ...styles.field, marginTop: "12px" }}>
              <label style={styles.label}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Any additional notes about this lead..."
                style={styles.textarea}
              />
            </div>
          </div>

          {/* Submit */}
          <div style={styles.actions}>
            <button type="button" onClick={() => navigate("/")} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Creating..." : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  section: {
    marginBottom: "24px",
    paddingBottom: "24px",
    borderBottom: "1px solid #f3f4f6",
  },
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: "6px",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    fontFamily: "inherit",
    background: "#fff",
    outline: "none",
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    fontFamily: "inherit",
    minHeight: "80px",
    resize: "vertical" as const,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "8px",
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  submitBtn: {
    padding: "10px 24px",
    borderRadius: "8px",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

export default NewLead;
