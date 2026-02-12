import { useState, useEffect } from "react";
import { kyiApi } from "../api/kyiClient";
import type {
  InvestorProfile,
  Warmth,
  StrategicValue,
  InvestmentStructure,
} from "../types/kyi";
import {
  WARMTH_OPTIONS,
  WARMTH_LABELS,
  WARMTH_COLORS,
  STRATEGIC_VALUE_OPTIONS,
  STRATEGIC_VALUE_LABELS,
  INVESTMENT_STRUCTURE_OPTIONS,
  INVESTMENT_STRUCTURE_LABELS,
  LOOKING_FOR_OPTIONS,
  LOOKING_FOR_LABELS,
} from "../types/kyi";

type TabId = "profile" | "strategic" | "risk" | "investments" | "network";

interface Props {
  investorId: number;
  onClose: () => void;
  onUpdate?: () => void;
}

export function InvestorDetailModal({ investorId, onClose, onUpdate }: Props) {
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [strategicValue, setStrategicValue] = useState<StrategicValue | "">("");
  const [lookingFor, setLookingFor] = useState("");
  const [amountInvested, setAmountInvested] = useState("");
  const [amountCommitted, setAmountCommitted] = useState("");
  const [investmentStructure, setInvestmentStructure] = useState<InvestmentStructure | "">("");
  const [strategicNotes, setStrategicNotes] = useState("");

  const [riskScore, setRiskScore] = useState(5);
  const [strategicScore, setStrategicScore] = useState(5);
  const [riskNotes, setRiskNotes] = useState("");
  const [strategicNotesExpanded, setStrategicNotesExpanded] = useState("");

  const [warmth, setWarmth] = useState<Warmth>("cold");
  const [relationshipStrength, setRelationshipStrength] = useState(3);
  const [preferredContactMethod, setPreferredContactMethod] = useState("");

  // Load investor profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await kyiApi.investors.getFullProfile(investorId);
        setProfile(data);

        // Initialize editable fields
        setStrategicValue(data.strategicValue || "");
        setLookingFor(data.lookingFor || "");
        setAmountInvested(data.amountInvested?.toString() || "");
        setAmountCommitted(data.amountCommitted?.toString() || "");
        setInvestmentStructure(data.investmentStructure || "");
        setStrategicNotes(data.strategicNotes || "");

        setRiskScore(data.riskScore || 5);
        setStrategicScore(data.strategicScore || 5);
        setRiskNotes(data.riskNotes || "");
        setStrategicNotesExpanded(data.strategicNotesExpanded || "");

        setWarmth(data.warmth || "cold");
        setRelationshipStrength(data.relationshipStrength || 3);
        setPreferredContactMethod(data.preferredContactMethod || "");

        setError(null);
      } catch (err) {
        console.error("Failed to load investor profile:", err);
        setError("Failed to load investor profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [investorId]);

  // Save handlers
  const handleSaveStrategic = async () => {
    try {
      setSaving(true);
      await kyiApi.investors.updateStrategic(investorId, {
        strategicValue: strategicValue || undefined,
        lookingFor: lookingFor || undefined,
        amountInvested: amountInvested ? parseInt(amountInvested) : undefined,
        amountCommitted: amountCommitted ? parseInt(amountCommitted) : undefined,
        investmentStructure: investmentStructure || undefined,
        strategicNotes: strategicNotes || undefined,
      });
      onUpdate?.();
      alert("Strategic profile saved!");
    } catch (err) {
      console.error("Failed to save strategic profile:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRisk = async () => {
    try {
      setSaving(true);
      await kyiApi.investors.updateRiskAssessment(investorId, {
        riskScore,
        strategicScore,
        riskNotes: riskNotes || undefined,
        strategicNotesExpanded: strategicNotesExpanded || undefined,
      });
      onUpdate?.();
      alert("Risk assessment saved!");
    } catch (err) {
      console.error("Failed to save risk assessment:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWarmth = async () => {
    try {
      setSaving(true);
      await kyiApi.investors.updateWarmth(investorId, {
        warmth,
        relationshipStrength,
        preferredContactMethod: preferredContactMethod || undefined,
      });
      onUpdate?.();
      alert("Relationship updated!");
    } catch (err) {
      console.error("Failed to save warmth:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const warmthColor = warmth ? WARMTH_COLORS[warmth] : WARMTH_COLORS.cold;

  if (loading) {
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.loadingState}>Loading investor profile...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.errorState}>{error || "Investor not found"}</div>
          <button onClick={onClose} style={styles.closeBtn}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.headerContent}>
            <div style={styles.avatar}>
              {profile.legalName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h2 style={styles.name}>{profile.legalName}</h2>
              <p style={styles.firm}>{profile.firmName || "Independent Investor"}</p>
              <div style={styles.badges}>
                {profile.warmth && (
                  <span style={{ ...styles.badge, background: warmthColor.bg, color: warmthColor.text }}>
                    {WARMTH_LABELS[profile.warmth]}
                  </span>
                )}
                {profile.status && (
                  <span style={{ ...styles.badge, background: "#f3f4f6", color: "#6b7280" }}>
                    {profile.status}
                  </span>
                )}
                {profile.trustScore && (
                  <span style={{ ...styles.badge, background: "#dbeafe", color: "#1d4ed8" }}>
                    Trust: {profile.trustScore}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {[
            { id: "profile", label: "Profile" },
            { id: "strategic", label: "Strategic" },
            { id: "risk", label: "Risk Assessment" },
            { id: "investments", label: "Investments" },
            { id: "network", label: "Network" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={styles.modalBody}>
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Contact Information</h4>
                <div style={styles.grid}>
                  <div style={styles.field}>
                    <span style={styles.fieldLabel}>Email</span>
                    <a href={`mailto:${profile.email}`} style={styles.link}>{profile.email}</a>
                  </div>
                  {profile.phone && (
                    <div style={styles.field}>
                      <span style={styles.fieldLabel}>Phone</span>
                      <a href={`tel:${profile.phone}`} style={styles.link}>{profile.phone}</a>
                    </div>
                  )}
                  {profile.country && (
                    <div style={styles.field}>
                      <span style={styles.fieldLabel}>Location</span>
                      <span style={styles.fieldValue}>{profile.country}</span>
                    </div>
                  )}
                  {profile.preferredContactMethod && (
                    <div style={styles.field}>
                      <span style={styles.fieldLabel}>Preferred Contact</span>
                      <span style={styles.fieldValue}>{profile.preferredContactMethod}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Investment Preferences</h4>
                <div style={styles.grid}>
                  {profile.sectors && (
                    <div style={styles.field}>
                      <span style={styles.fieldLabel}>Sectors</span>
                      <span style={styles.fieldValue}>{profile.sectors}</span>
                    </div>
                  )}
                  {profile.stages && (
                    <div style={styles.field}>
                      <span style={styles.fieldLabel}>Stages</span>
                      <span style={styles.fieldValue}>{profile.stages}</span>
                    </div>
                  )}
                  {(profile.checkMin || profile.checkMax) && (
                    <div style={styles.field}>
                      <span style={styles.fieldLabel}>Check Size</span>
                      <span style={styles.fieldValue}>
                        ${(profile.checkMin || 0).toLocaleString()} - ${(profile.checkMax || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {profile.horizon && (
                    <div style={styles.field}>
                      <span style={styles.fieldLabel}>Investment Horizon</span>
                      <span style={styles.fieldValue}>{profile.horizon}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Relationship</h4>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Warmth Level</label>
                  <div style={styles.radioGroup}>
                    {WARMTH_OPTIONS.map((w) => (
                      <label key={w} style={styles.radioLabel}>
                        <input
                          type="radio"
                          name="warmth"
                          value={w}
                          checked={warmth === w}
                          onChange={() => setWarmth(w)}
                        />
                        <span style={{ marginLeft: "6px" }}>{WARMTH_LABELS[w]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Relationship Strength (1-5)</label>
                  <div style={styles.sliderRow}>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={relationshipStrength}
                      onChange={(e) => setRelationshipStrength(parseInt(e.target.value))}
                      style={styles.slider}
                    />
                    <span style={styles.sliderValue}>{relationshipStrength}</span>
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Preferred Contact Method</label>
                  <select
                    value={preferredContactMethod}
                    onChange={(e) => setPreferredContactMethod(e.target.value)}
                    style={styles.select}
                  >
                    <option value="">Select...</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="in_person">In Person</option>
                    <option value="text">Text Message</option>
                  </select>
                </div>
                <button onClick={handleSaveWarmth} disabled={saving} style={styles.saveBtn}>
                  {saving ? "Saving..." : "Save Relationship"}
                </button>
              </div>
            </div>
          )}

          {/* Strategic Tab */}
          {activeTab === "strategic" && (
            <div>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Strategic Value Classification</h4>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Strategic Value Type</label>
                  <select
                    value={strategicValue}
                    onChange={(e) => setStrategicValue(e.target.value as StrategicValue)}
                    style={styles.select}
                  >
                    <option value="">Select...</option>
                    {STRATEGIC_VALUE_OPTIONS.map((sv) => (
                      <option key={sv} value={sv}>{STRATEGIC_VALUE_LABELS[sv]}</option>
                    ))}
                  </select>
                  <p style={styles.helpText}>
                    Capital Only = Pure financial investor | Operator = Hands-on experience |
                    Advisor = Strategic guidance | Network Connector = Valuable introductions
                  </p>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>What They're Looking For</label>
                  <select
                    value={lookingFor}
                    onChange={(e) => setLookingFor(e.target.value)}
                    style={styles.select}
                  >
                    <option value="">Select...</option>
                    {LOOKING_FOR_OPTIONS.map((lf) => (
                      <option key={lf} value={lf}>{LOOKING_FOR_LABELS[lf]}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Investment Structure</label>
                  <select
                    value={investmentStructure}
                    onChange={(e) => setInvestmentStructure(e.target.value as InvestmentStructure)}
                    style={styles.select}
                  >
                    <option value="">Select...</option>
                    {INVESTMENT_STRUCTURE_OPTIONS.map((is) => (
                      <option key={is} value={is}>{INVESTMENT_STRUCTURE_LABELS[is]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Investment Amounts</h4>
                <div style={styles.grid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Amount Invested ($)</label>
                    <input
                      type="number"
                      value={amountInvested}
                      onChange={(e) => setAmountInvested(e.target.value)}
                      style={styles.input}
                      placeholder="Total invested"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Amount Committed ($)</label>
                    <input
                      type="number"
                      value={amountCommitted}
                      onChange={(e) => setAmountCommitted(e.target.value)}
                      style={styles.input}
                      placeholder="Total committed"
                    />
                  </div>
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Strategic Notes</label>
                  <textarea
                    value={strategicNotes}
                    onChange={(e) => setStrategicNotes(e.target.value)}
                    style={styles.textarea}
                    placeholder="Domain expertise, rolodex value, brand credibility..."
                  />
                </div>
                <button onClick={handleSaveStrategic} disabled={saving} style={styles.saveBtn}>
                  {saving ? "Saving..." : "Save Strategic Profile"}
                </button>
              </div>
            </div>
          )}

          {/* Risk Assessment Tab */}
          {activeTab === "risk" && (
            <div>
              <div style={styles.scoreCards}>
                <div style={styles.scoreCard}>
                  <div style={styles.scoreHeader}>
                    <span style={styles.scoreLabel}>Risk Score</span>
                    <span style={{ ...styles.scoreValue, color: riskScore >= 7 ? "#dc2626" : riskScore >= 4 ? "#f59e0b" : "#16a34a" }}>
                      {riskScore}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={riskScore}
                    onChange={(e) => setRiskScore(parseInt(e.target.value))}
                    style={styles.scoreSlider}
                  />
                  <div style={styles.scoreScale}>
                    <span>Low Risk</span>
                    <span>High Risk</span>
                  </div>
                </div>

                <div style={styles.scoreCard}>
                  <div style={styles.scoreHeader}>
                    <span style={styles.scoreLabel}>Strategic Score</span>
                    <span style={{ ...styles.scoreValue, color: strategicScore >= 7 ? "#16a34a" : strategicScore >= 4 ? "#f59e0b" : "#dc2626" }}>
                      {strategicScore}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={strategicScore}
                    onChange={(e) => setStrategicScore(parseInt(e.target.value))}
                    style={styles.scoreSlider}
                  />
                  <div style={styles.scoreScale}>
                    <span>Low Value</span>
                    <span>High Value</span>
                  </div>
                </div>
              </div>

              <div style={styles.assessmentSummary}>
                {riskScore >= 7 && strategicScore >= 7 && (
                  <div style={{ ...styles.summaryBadge, background: "#fef3c7", color: "#92400e" }}>
                    ⚠️ High Capital, High Risk — Proceed Carefully
                  </div>
                )}
                {riskScore <= 3 && strategicScore >= 7 && (
                  <div style={{ ...styles.summaryBadge, background: "#dcfce7", color: "#166534" }}>
                    ✅ Low Risk, High Strategic Value — Prioritize
                  </div>
                )}
                {riskScore <= 3 && strategicScore <= 3 && (
                  <div style={{ ...styles.summaryBadge, background: "#f3f4f6", color: "#6b7280" }}>
                    📊 Low Risk, Low Value — Standard Engagement
                  </div>
                )}
                {riskScore >= 7 && strategicScore <= 3 && (
                  <div style={{ ...styles.summaryBadge, background: "#fee2e2", color: "#dc2626" }}>
                    🚨 High Risk, Low Value — Reconsider Engagement
                  </div>
                )}
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Risk Assessment Details</h4>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Risk Notes</label>
                  <textarea
                    value={riskNotes}
                    onChange={(e) => setRiskNotes(e.target.value)}
                    style={styles.textarea}
                    placeholder="Overbearing tendencies? Misaligned expectations? Capital reliability concerns?"
                  />
                </div>
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Strategic Value Details</h4>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Strategic Notes (Expanded)</label>
                  <textarea
                    value={strategicNotesExpanded}
                    onChange={(e) => setStrategicNotesExpanded(e.target.value)}
                    style={styles.textarea}
                    placeholder="Domain expertise, rolodex value, brand credibility, unique access..."
                  />
                </div>
                <button onClick={handleSaveRisk} disabled={saving} style={styles.saveBtn}>
                  {saving ? "Saving..." : "Save Risk Assessment"}
                </button>
              </div>
            </div>
          )}

          {/* Investments Tab */}
          {activeTab === "investments" && (
            <div>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Investment Summary</h4>
                <div style={styles.summaryCards}>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryValue}>
                      ${(profile.amountInvested || 0).toLocaleString()}
                    </span>
                    <span style={styles.summaryLabel}>Total Invested</span>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryValue}>
                      ${(profile.amountCommitted || 0).toLocaleString()}
                    </span>
                    <span style={styles.summaryLabel}>Total Committed</span>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryValue}>{profile.investments.length}</span>
                    <span style={styles.summaryLabel}>Investments</span>
                  </div>
                </div>
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Investment History</h4>
                {profile.investments.length > 0 ? (
                  <div style={styles.investmentList}>
                    {profile.investments.map((inv) => (
                      <div key={inv.id} style={styles.investmentItem}>
                        <div style={styles.investmentHeader}>
                          <span style={styles.investmentCompany}>{inv.company}</span>
                          {inv.round && <span style={styles.investmentRound}>{inv.round}</span>}
                        </div>
                        <div style={styles.investmentMeta}>
                          {inv.amountUsd && (
                            <span style={styles.investmentAmount}>
                              ${inv.amountUsd.toLocaleString()}
                            </span>
                          )}
                          {inv.date && (
                            <span style={styles.investmentDate}>
                              {new Date(inv.date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {inv.notes && <p style={styles.investmentNotes}>{inv.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No investments recorded</div>
                )}
              </div>
            </div>
          )}

          {/* Network Tab */}
          {activeTab === "network" && (
            <div>
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Network Summary</h4>
                <div style={styles.summaryCards}>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryValue}>{profile.connectionCount}</span>
                    <span style={styles.summaryLabel}>Connections</span>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryValue}>{profile.socialProfiles.length}</span>
                    <span style={styles.summaryLabel}>Social Profiles</span>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryValue}>{profile.recentInteractions.length}</span>
                    <span style={styles.summaryLabel}>Recent Interactions</span>
                  </div>
                </div>
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Social Profiles</h4>
                {profile.socialProfiles.length > 0 ? (
                  <div style={styles.socialList}>
                    {profile.socialProfiles.map((sp) => (
                      <div key={sp.id} style={styles.socialItem}>
                        <span style={styles.socialPlatform}>{sp.platform}</span>
                        {sp.url && (
                          <a href={sp.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                            View Profile
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No social profiles linked</div>
                )}
              </div>

              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Recent Interactions</h4>
                {profile.recentInteractions.length > 0 ? (
                  <div style={styles.interactionList}>
                    {profile.recentInteractions.map((int) => (
                      <div key={int.id} style={styles.interactionItem}>
                        <div style={styles.interactionHeader}>
                          {int.channel && <span style={styles.interactionChannel}>{int.channel}</span>}
                          {int.when && (
                            <span style={styles.interactionDate}>
                              {new Date(int.when).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {int.summary && <p style={styles.interactionSummary}>{int.summary}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No recent interactions</div>
                )}
              </div>

              <div style={styles.graphPlaceholder}>
                <span style={styles.graphIcon}>🕸️</span>
                <p style={styles.graphText}>Graph visualization coming soon</p>
                <p style={styles.graphSubtext}>
                  View relationship connections, warm paths, and network clusters
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: "fixed",
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
    maxHeight: "90vh",
    overflow: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px",
    borderBottom: "1px solid #e5e7eb",
  },
  headerContent: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
  },
  avatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: 600,
  },
  name: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  firm: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 8px",
  },
  badges: {
    display: "flex",
    gap: "8px",
  },
  badge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
  },
  closeBtn: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "22px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 24px",
    gap: "4px",
    overflowX: "auto",
  },
  tab: {
    padding: "12px 16px",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: "-1px",
    whiteSpace: "nowrap",
  },
  tabActive: {
    color: "#667eea",
    borderBottomColor: "#667eea",
  },
  modalBody: {
    padding: "24px",
  },
  section: {
    marginBottom: "28px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "16px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  fieldLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: "14px",
    color: "#1f2937",
  },
  link: {
    fontSize: "14px",
    color: "#667eea",
    textDecoration: "none",
  },
  formGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
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
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    minHeight: "100px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  helpText: {
    fontSize: "12px",
    color: "#9ca3af",
    marginTop: "6px",
    lineHeight: 1.4,
  },
  radioGroup: {
    display: "flex",
    gap: "24px",
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    fontSize: "14px",
  },
  sliderRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  slider: {
    flex: 1,
  },
  sliderValue: {
    fontWeight: 600,
    color: "#1f2937",
    minWidth: "24px",
    textAlign: "center",
  },
  saveBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  scoreCards: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "24px",
  },
  scoreCard: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "20px",
  },
  scoreHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  scoreLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#374151",
  },
  scoreValue: {
    fontSize: "28px",
    fontWeight: 700,
  },
  scoreSlider: {
    width: "100%",
    marginBottom: "8px",
  },
  scoreScale: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "#9ca3af",
  },
  assessmentSummary: {
    marginBottom: "24px",
  },
  summaryBadge: {
    padding: "12px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 600,
    textAlign: "center",
  },
  summaryCards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
  },
  summaryCard: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
  },
  summaryValue: {
    display: "block",
    fontSize: "24px",
    fontWeight: 700,
    color: "#1f2937",
    marginBottom: "4px",
  },
  summaryLabel: {
    fontSize: "12px",
    color: "#6b7280",
  },
  investmentList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  investmentItem: {
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "14px",
  },
  investmentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  investmentCompany: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1f2937",
  },
  investmentRound: {
    padding: "3px 8px",
    borderRadius: "6px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "11px",
    fontWeight: 600,
  },
  investmentMeta: {
    display: "flex",
    gap: "16px",
  },
  investmentAmount: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#16a34a",
  },
  investmentDate: {
    fontSize: "13px",
    color: "#6b7280",
  },
  investmentNotes: {
    fontSize: "13px",
    color: "#4b5563",
    marginTop: "8px",
    margin: "8px 0 0",
  },
  socialList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  socialItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "#f9fafb",
    borderRadius: "8px",
  },
  socialPlatform: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1f2937",
    textTransform: "capitalize",
  },
  interactionList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  interactionItem: {
    padding: "12px 14px",
    background: "#f9fafb",
    borderRadius: "8px",
  },
  interactionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  interactionChannel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    textTransform: "capitalize",
  },
  interactionDate: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  interactionSummary: {
    fontSize: "13px",
    color: "#4b5563",
    margin: 0,
    lineHeight: 1.4,
  },
  graphPlaceholder: {
    padding: "40px",
    background: "#f9fafb",
    borderRadius: "12px",
    textAlign: "center",
    border: "2px dashed #e5e7eb",
  },
  graphIcon: {
    fontSize: "40px",
    display: "block",
    marginBottom: "12px",
  },
  graphText: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 6px",
  },
  graphSubtext: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: 0,
  },
  emptyState: {
    padding: "24px",
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "14px",
  },
  loadingState: {
    padding: "60px",
    textAlign: "center",
    color: "#6b7280",
  },
  errorState: {
    padding: "60px",
    textAlign: "center",
    color: "#dc2626",
  },
};

export default InvestorDetailModal;
