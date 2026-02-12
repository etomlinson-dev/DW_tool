import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { leadsApi, proposalsApi } from "../api/client";
import type { Lead } from "../types";

// Proposal configuration types
interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
}

interface ProposalConfig {
  clientName: string;
  leadId: number | null;
  services: ServiceItem[];
  discount: number;
  validDays: number;
  notes: string;
  terms: string;
}

// Available services catalog
const SERVICE_CATALOG: Omit<ServiceItem, "quantity">[] = [
  {
    id: "growth-strategy",
    name: "Growth Strategy Consulting",
    description: "Comprehensive growth strategy development and implementation roadmap",
    price: 15000,
    category: "Consulting",
  },
  {
    id: "capital-advisory",
    name: "Capital Advisory Services",
    description: "Strategic capital raising and investor relations support",
    price: 25000,
    category: "Advisory",
  },
  {
    id: "market-analysis",
    name: "Market Analysis Report",
    description: "In-depth market research and competitive landscape analysis",
    price: 8000,
    category: "Research",
  },
  {
    id: "investor-intro",
    name: "Investor Introduction Package",
    description: "Curated introductions to qualified investors in your sector",
    price: 12000,
    category: "Advisory",
  },
  {
    id: "pitch-deck",
    name: "Pitch Deck Development",
    description: "Professional pitch deck design and narrative development",
    price: 5000,
    category: "Creative",
  },
  {
    id: "financial-model",
    name: "Financial Model Creation",
    description: "Comprehensive financial projections and scenario modeling",
    price: 7500,
    category: "Consulting",
  },
  {
    id: "due-diligence",
    name: "Due Diligence Support",
    description: "End-to-end due diligence preparation and management",
    price: 18000,
    category: "Advisory",
  },
  {
    id: "board-advisory",
    name: "Board Advisory Retainer",
    description: "Monthly board advisory and strategic guidance (per month)",
    price: 3500,
    category: "Consulting",
  },
];

const CATEGORIES = ["All", "Consulting", "Advisory", "Research", "Creative"];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Consulting: { bg: "#dbeafe", text: "#1d4ed8" },
  Advisory: { bg: "#dcfce7", text: "#166534" },
  Research: { bg: "#fef3c7", text: "#92400e" },
  Creative: { bg: "#f3e8ff", text: "#7c3aed" },
};

export function Orbit() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [addedServiceId, setAddedServiceId] = useState<string | null>(null);
  
  const [proposal, setProposal] = useState<ProposalConfig>({
    clientName: "",
    leadId: null,
    services: [],
    discount: 0,
    validDays: 30,
    notes: "",
    terms: "Payment terms: 50% upfront, 50% upon completion.\nThis proposal is valid for the specified number of days from the date of issue.",
  });

  const [savedProposals, setSavedProposals] = useState<
    { id: number; clientName: string; total: number; date: string; status: string }[]
  >([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load leads - all leads so proposals can target any
        const leadsResponse = await leadsApi.getLeads({ per_page: 200 });
        setLeads(leadsResponse.data);
        
        // Load proposals from API
        const proposalsResponse = await fetch("/api/proposals");
        if (proposalsResponse.ok) {
          const proposalsData = await proposalsResponse.json();
          setSavedProposals(proposalsData.map((p: { id: number; lead_name?: string; total_price?: number; created_at?: string; status?: string }) => ({
            id: p.id,
            clientName: p.lead_name || "Unknown",
            total: p.total_price || 0,
            date: p.created_at?.split("T")[0] || "",
            status: p.status || "draft",
          })));
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredServices = SERVICE_CATALOG.filter((service) => {
    const matchesCategory = activeCategory === "All" || service.category === activeCategory;
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addService = (service: Omit<ServiceItem, "quantity">) => {
    setAddedServiceId(service.id);
    setTimeout(() => setAddedServiceId(null), 600);
    
    const existing = proposal.services.find((s) => s.id === service.id);
    if (existing) {
      setProposal({
        ...proposal,
        services: proposal.services.map((s) =>
          s.id === service.id ? { ...s, quantity: s.quantity + 1 } : s
        ),
      });
    } else {
      setProposal({
        ...proposal,
        services: [...proposal.services, { ...service, quantity: 1 }],
      });
    }
  };

  const removeService = (serviceId: string) => {
    setProposal({
      ...proposal,
      services: proposal.services.filter((s) => s.id !== serviceId),
    });
  };

  const updateServiceQuantity = (serviceId: string, quantity: number) => {
    if (quantity < 1) {
      removeService(serviceId);
      return;
    }
    setProposal({
      ...proposal,
      services: proposal.services.map((s) =>
        s.id === serviceId ? { ...s, quantity } : s
      ),
    });
  };

  const subtotal = proposal.services.reduce(
    (sum, service) => sum + service.price * service.quantity,
    0
  );
  const discountAmount = (subtotal * proposal.discount) / 100;
  const total = subtotal - discountAmount;

  const handleLeadSelect = (leadId: number) => {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setProposal({
        ...proposal,
        leadId,
        clientName: lead.business_name,
      });
    }
  };

  const handleSaveProposal = async () => {
    if (!proposal.clientName) {
      alert("Please select a client or enter a client name");
      return;
    }
    setSaving(true);
    try {
      const result = await proposalsApi.createProposal({
        lead_id: proposal.leadId || undefined,
        title: `Proposal for ${proposal.clientName}`,
        total_price: total,
        discount: proposal.discount,
        validity_days: proposal.validDays,
        notes: proposal.notes,
        status: "draft",
        configuration: {
          services: proposal.services,
          discount: proposal.discount,
          validDays: proposal.validDays,
          notes: proposal.notes,
          terms: proposal.terms,
        },
      });
      setSavedProposals([{
        id: result.id,
        clientName: proposal.clientName,
        total,
        date: new Date().toISOString().split("T")[0],
        status: "Draft",
      }, ...savedProposals]);
      alert("Proposal saved as draft!");
    } catch (err) {
      console.error("Failed to save proposal:", err);
      alert("Failed to save proposal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendProposal = async () => {
    if (proposal.services.length === 0) {
      alert("Please add at least one service to the proposal");
      return;
    }
    if (!proposal.leadId) {
      alert("Please select a lead from the dropdown.\nA lead with an email address is required to send the proposal.");
      return;
    }
    
    setSending(true);
    try {
      // 1. Save proposal to database first
      const savedResult = await proposalsApi.createProposal({
        lead_id: proposal.leadId,
        title: `Proposal for ${proposal.clientName}`,
        total_price: total,
        discount: proposal.discount,
        validity_days: proposal.validDays,
        notes: proposal.notes,
        status: "draft",
        configuration: {
          services: proposal.services,
          discount: proposal.discount,
          validDays: proposal.validDays,
          notes: proposal.notes,
          terms: proposal.terms,
        },
      });
      
      // 2. Queue the proposal email for review
      const queueResult = await proposalsApi.queueProposalEmail(savedResult.id);
      
      setSavedProposals([{
        id: savedResult.id,
        clientName: proposal.clientName,
        total,
        date: new Date().toISOString().split("T")[0],
        status: "Pending Review",
      }, ...savedProposals]);
      
      // 3. Ask user if they want to go to the emails tab
      const goToEmails = confirm(
        `${queueResult.message}\n\nWould you like to go to the Emails tab to review and send it?`
      );
      if (goToEmails) {
        navigate("/pending-emails");
      }
    } catch (err: unknown) {
      console.error("Failed to send proposal:", err);
      let errorMsg = "Unknown error";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        errorMsg = axiosErr.response?.data?.error || errorMsg;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      alert(`Failed to queue proposal: ${errorMsg}`);
    } finally {
      setSending(false);
    }
  };

  const clearProposal = () => {
    setProposal({
      clientName: "",
      leadId: null,
      services: [],
      discount: 0,
      validDays: 30,
      notes: "",
      terms: proposal.terms,
    });
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={styles.spinner}
        />
        <span>Loading Orbit...</span>
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
          <h1 style={styles.title}>Orbit - Proposal Builder</h1>
          <p style={styles.subtitle}>Create and manage client proposals</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={clearProposal} style={styles.secondaryBtn}>
            Clear All
          </button>
          <button onClick={handleSaveProposal} style={{ ...styles.secondaryBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving ? "Saving..." : "💾 Save Draft"}
          </button>
          <button onClick={() => setShowPreview(!showPreview)} style={styles.previewBtn}>
            {showPreview ? "✏️ Edit" : "👁️ Preview"}
          </button>
          <button onClick={handleSendProposal} style={{ ...styles.primaryBtn, opacity: sending ? 0.7 : 1 }} disabled={sending}>
            {sending ? "⏳ Queuing..." : "📤 Send Proposal"}
          </button>
        </div>
      </motion.div>

      <div style={styles.mainGrid}>
        {/* Left Column - Service Catalog */}
        <motion.div 
          style={styles.catalogSection}
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              <span style={styles.cardIcon}>📦</span>
              Service Catalog
            </h3>
            
            {/* Search and Filter Bar */}
            <div style={styles.catalogToolbar}>
              <div style={styles.searchBox}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={styles.clearSearch}
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                style={styles.categorySelect}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Services Table */}
            <div style={styles.servicesTableWrapper}>
              <table style={styles.servicesTable}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.thService}>Service</th>
                    <th style={styles.thCategory}>Category</th>
                    <th style={styles.thPrice}>Price</th>
                    <th style={styles.thAction}></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filteredServices.map((service, index) => {
                      const inProposal = proposal.services.some(s => s.id === service.id);
                      const catColors = CATEGORY_COLORS[service.category] || { bg: "#f3f4f6", text: "#374151" };
                      
                      return (
                        <motion.tr
                          key={service.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          style={{
                            ...styles.tableRow,
                            ...(inProposal ? styles.tableRowAdded : {}),
                          }}
                          whileHover={{ backgroundColor: inProposal ? "#dcfce7" : "#f3f4f6" }}
                        >
                          <td style={styles.tdService}>
                            <div style={styles.serviceName}>{service.name}</div>
                            <div style={styles.serviceDescription}>{service.description}</div>
                          </td>
                          <td style={styles.tdCategory}>
                            <motion.span 
                              style={{
                                ...styles.categoryBadge,
                                background: catColors.bg,
                                color: catColors.text,
                              }}
                              whileHover={{ scale: 1.05 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              {service.category}
                            </motion.span>
                          </td>
                          <td style={styles.tdPrice}>
                            ${service.price.toLocaleString()}
                          </td>
                          <td style={styles.tdAction}>
                            <AnimatePresence mode="wait">
                              {inProposal ? (
                                <motion.span 
                                  key="check"
                                  style={styles.addedIndicator}
                                  initial={{ scale: 0, rotate: -180 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  exit={{ scale: 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  ✓
                                </motion.span>
                              ) : (
                                <motion.button
                                  key="add"
                                  onClick={() => addService(service)}
                                  style={styles.addBtnCompact}
                                  whileHover={{ scale: 1.15 }}
                                  whileTap={{ scale: 0.9 }}
                                  transition={{ type: "spring", stiffness: 400 }}
                                >
                                  +
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {filteredServices.length === 0 && (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <td colSpan={4} style={styles.emptyRow}>
                        No services found
                      </td>
                    </motion.tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Proposals */}
          <motion.div 
            style={styles.card}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 style={styles.cardTitle}>
              <span style={styles.cardIcon}>📋</span>
              Recent Proposals
            </h3>
            <div style={styles.recentList}>
              {savedProposals.slice(0, 5).map((p, index) => (
                <motion.div 
                  key={p.id} 
                  style={styles.recentItem}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  whileHover={{ 
                    backgroundColor: "#f9fafb",
                    x: 4,
                    transition: { duration: 0.2 }
                  }}
                >
                  <div>
                    <span style={styles.recentClient}>{p.clientName}</span>
                    <span style={styles.recentDate}>{p.date}</span>
                  </div>
                  <div style={styles.recentRight}>
                    <span style={styles.recentTotal}>
                      ${p.total.toLocaleString()}
                    </span>
                    <motion.span
                      style={{
                        ...styles.recentStatus,
                        background:
                          p.status === "Accepted" ? "#dcfce7" :
                          p.status === "Sent" ? "#dbeafe" : "#f3f4f6",
                        color:
                          p.status === "Accepted" ? "#166534" :
                          p.status === "Sent" ? "#1d4ed8" : "#6b7280",
                      }}
                      whileHover={{ scale: 1.05 }}
                    >
                      {p.status}
                    </motion.span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column - Proposal Builder */}
        <motion.div 
          style={styles.builderSection}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {!showPreview ? (
              <motion.div 
                key="builder"
                style={styles.card}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <h3 style={styles.cardTitle}>
                  <span style={styles.cardIcon}>🛠️</span>
                  Build Proposal
                </h3>

                {/* Client Selection */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Client / Lead</label>
                  <select
                    value={proposal.leadId || ""}
                    onChange={(e) =>
                      e.target.value
                        ? handleLeadSelect(Number(e.target.value))
                        : setProposal({ ...proposal, leadId: null, clientName: "" })
                    }
                    style={styles.select}
                  >
                    <option value="">Select a lead...</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.business_name} {lead.contact_name ? `(${lead.contact_name})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or enter client name manually"
                    value={proposal.clientName}
                    onChange={(e) =>
                      setProposal({ ...proposal, clientName: e.target.value })
                    }
                    style={{ ...styles.input, marginTop: "8px" }}
                  />
                </div>

                {/* Selected Services */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Selected Services 
                    <motion.span 
                      style={styles.serviceCount}
                      key={proposal.services.length}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                    >
                      {proposal.services.length}
                    </motion.span>
                  </label>
                  
                  <AnimatePresence mode="wait">
                    {proposal.services.length === 0 ? (
                      <motion.div 
                        key="empty"
                        style={styles.emptyServices}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <span style={styles.emptyIcon}>📭</span>
                        <p>No services added yet</p>
                        <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                          Browse the catalog and click "Add"
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="services"
                        style={styles.selectedServices}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {proposal.services.map((service) => (
                          <motion.div 
                            key={service.id} 
                            style={styles.selectedItem}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div style={styles.selectedInfo}>
                              <span style={styles.selectedName}>{service.name}</span>
                              <div style={styles.selectedControls}>
                                <button
                                  onClick={() => updateServiceQuantity(service.id, service.quantity - 1)}
                                  style={styles.qtyBtn}
                                >
                                  -
                                </button>
                                <span style={styles.qtyValue}>
                                  {service.quantity}
                                </span>
                                <button
                                  onClick={() => updateServiceQuantity(service.id, service.quantity + 1)}
                                  style={styles.qtyBtn}
                                >
                                  +
                                </button>
                                <span style={styles.times}>×</span>
                                <span style={styles.unitPrice}>
                                  ${service.price.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div style={styles.selectedRight}>
                              <span style={styles.selectedTotal}>
                                ${(service.price * service.quantity).toLocaleString()}
                              </span>
                              <button
                                onClick={() => removeService(service.id)}
                                style={styles.removeBtn}
                              >
                                ×
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Discount & Validity */}
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={proposal.discount}
                      onChange={(e) =>
                        setProposal({ ...proposal, discount: Number(e.target.value) })
                      }
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Valid for (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={proposal.validDays}
                      onChange={(e) =>
                        setProposal({ ...proposal, validDays: Number(e.target.value) })
                      }
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Additional Notes</label>
                  <textarea
                    value={proposal.notes}
                    onChange={(e) => setProposal({ ...proposal, notes: e.target.value })}
                    placeholder="Any additional notes for the client..."
                    style={styles.textarea}
                  />
                </div>

                {/* Totals */}
                <div style={styles.totalsSection}>
                  <div style={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                  {proposal.discount > 0 && (
                    <div style={{ ...styles.totalRow, color: "#16a34a" }}>
                      <span>Discount ({proposal.discount}%)</span>
                      <span>-${discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={styles.grandTotal}>
                    <span>Total</span>
                    <span>${total.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Proposal Preview */
              <motion.div 
                key="preview"
                style={styles.previewCard}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div style={styles.previewHeader}>
                  <div style={styles.previewLogo}>
                    <span style={styles.logoText}>DW</span>
                    <span style={styles.logoSubtitle}>GROWTH & CAPITAL</span>
                  </div>
                  <div style={styles.previewTitle}>PROPOSAL</div>
                </div>

                <div style={styles.previewBody}>
                  <div style={styles.previewClient}>
                    <strong>Prepared for:</strong>
                    <div style={styles.clientName}>
                      {proposal.clientName || "Client Name"}
                    </div>
                    <div style={styles.previewDate}>
                      Date: {new Date().toLocaleDateString()}
                    </div>
                    <div style={styles.previewValid}>
                      Valid until:{" "}
                      {new Date(
                        Date.now() + proposal.validDays * 24 * 60 * 60 * 1000
                      ).toLocaleDateString()}
                    </div>
                  </div>

                  <h4 style={styles.previewSectionTitle}>Proposed Services</h4>
                  <table style={styles.previewTable}>
                    <thead>
                      <tr>
                        <th style={styles.previewTh}>Service</th>
                        <th style={{ ...styles.previewTh, textAlign: "center" }}>Qty</th>
                        <th style={{ ...styles.previewTh, textAlign: "right" }}>Price</th>
                        <th style={{ ...styles.previewTh, textAlign: "right" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.services.map((service) => (
                        <tr key={service.id}>
                          <td style={styles.previewTd}>
                            <strong>{service.name}</strong>
                            <br />
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>
                              {service.description}
                            </span>
                          </td>
                          <td style={{ ...styles.previewTd, textAlign: "center" }}>
                            {service.quantity}
                          </td>
                          <td style={{ ...styles.previewTd, textAlign: "right" }}>
                            ${service.price.toLocaleString()}
                          </td>
                          <td style={{ ...styles.previewTd, textAlign: "right" }}>
                            ${(service.price * service.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={styles.previewTotals}>
                    <div style={styles.previewTotalRow}>
                      <span>Subtotal</span>
                      <span>${subtotal.toLocaleString()}</span>
                    </div>
                    {proposal.discount > 0 && (
                      <div style={{ ...styles.previewTotalRow, color: "#16a34a" }}>
                        <span>Discount ({proposal.discount}%)</span>
                        <span>-${discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={styles.previewGrandTotal}>
                      <span>Total Investment</span>
                      <span>${total.toLocaleString()}</span>
                    </div>
                  </div>

                  {proposal.notes && (
                    <div>
                      <h4 style={styles.previewSectionTitle}>Notes</h4>
                      <p style={styles.previewNotes}>{proposal.notes}</p>
                    </div>
                  )}

                  <div>
                    <h4 style={styles.previewSectionTitle}>Terms & Conditions</h4>
                    <p style={styles.previewTerms}>{proposal.terms}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px",
    maxWidth: "1344px",
    margin: "0 auto",
    minHeight: "calc(100vh - 80px)",
    overflow: "hidden",
    boxSizing: "border-box",
    width: "100%",
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
    borderTopColor: "#667eea",
    borderRadius: "50%",
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
    gap: "12px",
    alignItems: "center",
  },
  primaryBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
  },
  secondaryBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  previewBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    background: "#10b981",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    overflow: "hidden",
    width: "100%",
    boxSizing: "border-box",
  },
  catalogSection: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    overflow: "hidden",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  builderSection: {
    overflow: "hidden",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "1px solid #f3f4f6",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  cardIcon: {
    fontSize: "20px",
  },
  catalogToolbar: {
    display: "flex",
    gap: "12px",
    marginBottom: "16px",
    alignItems: "center",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    background: "#f9fafb",
    borderRadius: "8px",
    padding: "8px 12px",
    gap: "8px",
    border: "1px solid #e5e7eb",
    flex: 1,
  },
  searchIcon: {
    fontSize: "14px",
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    fontSize: "13px",
    outline: "none",
    color: "#374151",
    minWidth: 0,
  },
  clearSearch: {
    background: "#e5e7eb",
    border: "none",
    borderRadius: "50%",
    width: "18px",
    height: "18px",
    fontSize: "11px",
    cursor: "pointer",
    color: "#6b7280",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  categorySelect: {
    padding: "8px 16px",
    paddingRight: "36px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center, #fff`,
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    cursor: "pointer",
    outline: "none",
    minWidth: "120px",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  servicesTableWrapper: {
    height: "360px",
    overflowY: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  servicesTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  tableHeader: {
    background: "#f9fafb",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  thService: {
    textAlign: "left",
    padding: "12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    width: "45%",
    borderBottom: "1px solid #e5e7eb",
  },
  thCategory: {
    textAlign: "left",
    padding: "12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    width: "20%",
    borderBottom: "1px solid #e5e7eb",
  },
  thPrice: {
    textAlign: "right",
    padding: "12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    width: "20%",
    borderBottom: "1px solid #e5e7eb",
  },
  thAction: {
    textAlign: "center",
    padding: "12px",
    width: "15%",
    borderBottom: "1px solid #e5e7eb",
  },
  tableRow: {
    borderBottom: "1px solid #f3f4f6",
    transition: "background 0.15s",
  },
  tableRowAdded: {
    background: "#f0fdf4",
  },
  tdService: {
    padding: "12px",
    verticalAlign: "top",
  },
  tdCategory: {
    padding: "12px",
    verticalAlign: "middle",
  },
  tdPrice: {
    padding: "12px",
    textAlign: "right",
    fontWeight: 600,
    color: "#667eea",
    fontSize: "14px",
    verticalAlign: "middle",
  },
  tdAction: {
    padding: "12px",
    textAlign: "center",
    verticalAlign: "middle",
  },
  categoryBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 500,
  },
  addBtnCompact: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
  },
  addedIndicator: {
    color: "#22c55e",
    fontSize: "16px",
    fontWeight: 600,
  },
  emptyRow: {
    padding: "40px",
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "14px",
  },
  serviceName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1f2937",
    marginBottom: "2px",
  },
  addedBadge: {
    fontSize: "10px",
    padding: "2px 8px",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "10px",
    fontWeight: 600,
  },
  serviceDescription: {
    fontSize: "11px",
    color: "#9ca3af",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    lineHeight: 1.4,
  },
  addBtn: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    marginLeft: "16px",
    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
  },
  recentList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  recentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px",
    background: "#f9fafb",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  recentClient: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    display: "block",
  },
  recentDate: {
    fontSize: "12px",
    color: "#9ca3af",
    display: "block",
    marginTop: "2px",
  },
  recentRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  recentTotal: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#1f2937",
  },
  recentStatus: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "6px",
  },
  formGroup: {
    marginBottom: "20px",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "20px",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "8px",
  },
  serviceCount: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "#667eea",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    transition: "border-color 0.2s",
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    minHeight: "80px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  emptyServices: {
    padding: "40px",
    textAlign: "center",
    background: "#f9fafb",
    borderRadius: "12px",
    color: "#6b7280",
  },
  emptyIcon: {
    fontSize: "40px",
    display: "block",
    marginBottom: "12px",
  },
  selectedServices: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  selectedItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px",
    background: "#f9fafb",
    borderRadius: "10px",
    overflow: "hidden",
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    display: "block",
    marginBottom: "8px",
  },
  selectedControls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  qtyBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    fontSize: "14px",
    fontWeight: 600,
    minWidth: "24px",
    textAlign: "center",
  },
  times: {
    color: "#9ca3af",
    margin: "0 4px",
  },
  unitPrice: {
    fontSize: "13px",
    color: "#6b7280",
  },
  selectedRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  selectedTotal: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#1f2937",
  },
  removeBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  totalsSection: {
    borderTop: "2px solid #f3f4f6",
    paddingTop: "16px",
    marginTop: "8px",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    color: "#6b7280",
    marginBottom: "8px",
  },
  grandTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "22px",
    fontWeight: 700,
    color: "#1f2937",
    paddingTop: "12px",
    borderTop: "1px solid #e5e7eb",
  },
  // Preview styles
  previewCard: {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
  },
  previewHeader: {
    background: "linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)",
    padding: "32px",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLogo: {
    display: "flex",
    flexDirection: "column",
  },
  logoText: {
    fontSize: "32px",
    fontWeight: 700,
    fontFamily: "Georgia, serif",
    letterSpacing: "0.1em",
  },
  logoSubtitle: {
    fontSize: "10px",
    letterSpacing: "0.2em",
    opacity: 0.8,
  },
  previewTitle: {
    fontSize: "24px",
    fontWeight: 300,
    letterSpacing: "0.3em",
  },
  previewBody: {
    padding: "32px",
  },
  previewClient: {
    marginBottom: "32px",
  },
  clientName: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#1f2937",
    marginTop: "8px",
  },
  previewDate: {
    fontSize: "13px",
    color: "#6b7280",
    marginTop: "8px",
  },
  previewValid: {
    fontSize: "13px",
    color: "#6b7280",
  },
  previewSectionTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "24px 0 12px",
    paddingBottom: "8px",
    borderBottom: "1px solid #e5e7eb",
  },
  previewTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  previewTh: {
    padding: "12px",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    borderBottom: "2px solid #e5e7eb",
  },
  previewTd: {
    padding: "16px 12px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "14px",
    color: "#1f2937",
    verticalAlign: "top",
  },
  previewTotals: {
    marginTop: "24px",
    marginLeft: "auto",
    maxWidth: "300px",
  },
  previewTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    color: "#6b7280",
    padding: "8px 0",
  },
  previewGrandTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "18px",
    fontWeight: 700,
    color: "#1f2937",
    padding: "12px 0",
    borderTop: "2px solid #1f2937",
    marginTop: "8px",
  },
  previewNotes: {
    fontSize: "14px",
    color: "#4b5563",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  previewTerms: {
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
};

export default Orbit;
