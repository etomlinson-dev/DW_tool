import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { kyiApi, type InvestorListItem } from "../api/kyiClient";
import { ConnectionsPanel } from "../components/ConnectionsPanel";
import type {
  Prospect,
  ProspectStage,
  Warmth,
  ProspectStats,
  InvestorProfile,
} from "../types/kyi";
import {
  PROSPECT_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  WARMTH_LABELS,
  WARMTH_COLORS,
  WARMTH_OPTIONS,
} from "../types/kyi";

// ============================================================================
// INVESTOR LIST VIEW (Main KYI Screen)
// ============================================================================

function InvestorListView({
  investors,
  loading,
  searchQuery,
  onSearchChange,
  onSelectInvestor,
  onAddInvestor,
}: {
  investors: InvestorListItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectInvestor: (investor: InvestorListItem) => void;
  onAddInvestor: () => void;
}) {
  const totalInvested = investors.reduce((sum, inv) => sum + (inv.amountInvested || 0), 0);
  const totalCommitted = investors.reduce((sum, inv) => sum + (inv.amountCommitted || 0), 0);

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
          <h1 style={styles.title}>Know Your Investor</h1>
          <p style={styles.subtitle}>Select an investor to view their complete profile</p>
        </div>
        <div style={styles.headerActions}>
          <motion.button 
            onClick={onAddInvestor} 
            style={styles.primaryBtn}
            whileHover={{ scale: 1.05, boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)" }}
            whileTap={{ scale: 0.95 }}
          >
            + Add Investor
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div 
        style={styles.statsRow}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {[
          { value: investors.length, label: "Total Investors" },
          { value: `$${(totalInvested / 1000000).toFixed(1)}M`, label: "Total Invested" },
          { value: `$${(totalCommitted / 1000000).toFixed(1)}M`, label: "Total Committed" },
          { value: investors.filter((i) => i.warmth === "trusted").length, label: "Trusted Relationships" },
        ].map((stat, index) => (
          <motion.div 
            key={stat.label}
            style={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ scale: 1.02, boxShadow: "0 8px 25px rgba(0, 0, 0, 0.1)" }}
          >
            <span style={styles.statValue}>{stat.value}</span>
            <span style={styles.statLabel}>{stat.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div 
        style={styles.controls}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <input
          type="text"
          placeholder="Search investors..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={styles.searchInput}
        />
      </motion.div>

      {/* Investor Grid */}
      {loading ? (
        <motion.div 
          style={styles.loadingState}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Loading investors...
        </motion.div>
      ) : investors.length === 0 ? (
        <motion.div 
          style={styles.emptyState}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span style={styles.emptyIcon}>👥</span>
          <span style={styles.emptyText}>No investors found</span>
          <span style={styles.emptySubtext}>Convert prospects from the pipeline to see them here</span>
        </motion.div>
      ) : (
        <motion.div 
          style={styles.investorGrid}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {investors.map((investor, index) => (
            <InvestorCard
              key={investor.id}
              investor={investor}
              onClick={() => onSelectInvestor(investor)}
              index={index}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

function InvestorCard({
  investor,
  onClick,
  index = 0,
}: {
  investor: InvestorListItem;
  onClick: () => void;
  index?: number;
}) {
  const warmthColor = investor.warmth ? WARMTH_COLORS[investor.warmth] : WARMTH_COLORS.cold;
  const initials = investor.legalName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div 
      style={styles.investorCard} 
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      whileHover={{ 
        scale: 1.02, 
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div style={styles.cardTop}>
        <motion.div 
          style={styles.cardAvatar}
          whileHover={{ scale: 1.1 }}
        >
          {initials}
        </motion.div>
        <div style={styles.cardInfo}>
          <span style={styles.cardName}>{investor.legalName}</span>
          {investor.firmName && <span style={styles.cardFirm}>{investor.firmName}</span>}
        </div>
        {investor.warmth && (
          <motion.span
            style={{
              ...styles.warmthBadge,
              background: warmthColor.bg,
              color: warmthColor.text,
            }}
            whileHover={{ scale: 1.1 }}
          >
            {WARMTH_LABELS[investor.warmth]}
          </motion.span>
        )}
      </div>

      <div style={styles.cardStats}>
        <div style={styles.cardStat}>
          <span style={styles.cardStatLabel}>Invested</span>
          <span style={styles.cardStatValue}>
            ${((investor.amountInvested || 0) / 1000).toFixed(0)}K
          </span>
        </div>
        <div style={styles.cardStat}>
          <span style={styles.cardStatLabel}>Committed</span>
          <span style={styles.cardStatValue}>
            ${((investor.amountCommitted || 0) / 1000).toFixed(0)}K
          </span>
        </div>
        <div style={styles.cardStat}>
          <span style={styles.cardStatLabel}>Strength</span>
          <span style={styles.cardStatValue}>{investor.relationshipStrength || 0}/5</span>
        </div>
      </div>

      <div style={styles.cardFooter}>
        <span style={styles.cardEmail}>{investor.email}</span>
        {investor.lastContact && (
          <span style={styles.cardLastContact}>
            Last contact: {new Date(investor.lastContact).toLocaleDateString()}
          </span>
        )}
      </div>

      <motion.div 
        style={styles.cardAction}
        whileHover={{ x: 5 }}
      >
        <span style={styles.viewProfileBtn}>View Profile →</span>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// INVESTOR DETAIL VIEW (Know Your Investor Screen)
// ============================================================================

function InvestorDetailView({
  investor,
  investors,
  profile,
  prospects,
  stats,
  loading,
  onBack,
}: {
  investor: InvestorListItem;
  investors: InvestorListItem[];
  profile: InvestorProfile | null;
  prospects: Prospect[];
  stats: ProspectStats | null;
  loading: boolean;
  onBack: () => void;
}) {
  const [viewMode, setViewMode] = useState<"pipeline" | "list" | "accessmap">("pipeline");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  // Group prospects by stage
  const prospectsByStage = PROSPECT_STAGES.reduce((acc, stage) => {
    acc[stage] = prospects.filter((p) => p.stage === stage);
    return acc;
  }, {} as Record<ProspectStage, Prospect[]>);

  const warmthColor = investor.warmth ? WARMTH_COLORS[investor.warmth] : WARMTH_COLORS.cold;

  return (
    <div style={styles.container}>
      {/* Header with Back Button */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onBack} style={styles.backBtn}>
            ← Back to Investors
          </button>
          <div style={styles.headerProfile}>
            <div style={styles.headerAvatar}>
              {investor.legalName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h1 style={styles.title}>{investor.legalName}</h1>
              <p style={styles.subtitle}>
                {investor.firmName || "Independent Investor"} •{" "}
                {investor.warmth && (
                  <span
                    style={{
                      ...styles.warmthBadgeInline,
                      background: warmthColor.bg,
                      color: warmthColor.text,
                    }}
                  >
                    {WARMTH_LABELS[investor.warmth]}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Investor Profile Summary */}
      {profile && (
        <div style={styles.profileSummary}>
          <div style={styles.profileCard}>
            <span style={styles.profileLabel}>Invested</span>
            <span style={styles.profileValue}>
              ${((profile.amountInvested || 0) / 1000).toFixed(0)}K
            </span>
          </div>
          <div style={styles.profileCard}>
            <span style={styles.profileLabel}>Committed</span>
            <span style={styles.profileValue}>
              ${((profile.amountCommitted || 0) / 1000).toFixed(0)}K
            </span>
          </div>
          <div style={styles.profileCard}>
            <span style={styles.profileLabel}>Check Size</span>
            <span style={styles.profileValue}>
              ${((profile.checkMin || 0) / 1000).toFixed(0)}K - ${((profile.checkMax || 0) / 1000).toFixed(0)}K
            </span>
          </div>
          <div style={styles.profileCard}>
            <span style={styles.profileLabel}>Sectors</span>
            <span style={styles.profileValue}>{profile.sectors || "N/A"}</span>
          </div>
          <div style={styles.profileCard}>
            <span style={styles.profileLabel}>Strategic Value</span>
            <span style={styles.profileValue}>
              {profile.strategicValue?.replace("_", " ") || "N/A"}
            </span>
          </div>
          <div style={styles.profileCard}>
            <span style={styles.profileLabel}>Connections</span>
            <span style={styles.profileValue}>{profile.connectionCount}</span>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div style={styles.controls}>
        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode("pipeline")}
            style={{
              ...styles.toggleBtn,
              ...(viewMode === "pipeline" ? styles.toggleBtnActive : {}),
            }}
          >
            Pipeline
          </button>
          <button
            onClick={() => setViewMode("list")}
            style={{
              ...styles.toggleBtn,
              ...(viewMode === "list" ? styles.toggleBtnActive : {}),
            }}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("accessmap")}
            style={{
              ...styles.toggleBtn,
              ...(viewMode === "accessmap" ? styles.toggleBtnActive : {}),
            }}
          >
            Connections
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={styles.loadingState}>Loading data...</div>
      ) : viewMode === "accessmap" ? (
        <div style={styles.accessMapContainer}>
          <ConnectionsPanel investor={investor} investors={investors} prospects={prospects} />
        </div>
      ) : viewMode === "pipeline" ? (
        <div style={styles.pipeline}>
          {PROSPECT_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              prospects={prospectsByStage[stage]}
              count={stats?.stageCounts[stage] || prospectsByStage[stage].length}
              onProspectClick={setSelectedProspect}
            />
          ))}
        </div>
      ) : (
        <div style={styles.listView}>
          <div style={styles.listHeader}>
            <div style={styles.listHeaderCell}>Name</div>
            <div style={styles.listHeaderCell}>Firm</div>
            <div style={styles.listHeaderCell}>Email</div>
            <div style={styles.listHeaderCell}>Stage</div>
          </div>
          {prospects.map((prospect) => (
            <div
              key={prospect.id}
              style={styles.listRow}
              onClick={() => setSelectedProspect(prospect)}
            >
              <div style={styles.listName}>{prospect.name}</div>
              <div style={styles.listFirm}>{prospect.firmName || "-"}</div>
              <div style={styles.listEmail}>{prospect.email || "-"}</div>
              <div style={styles.listStage}>
                <span
                  style={{
                    ...styles.stageBadgeSmall,
                    background: STAGE_COLORS[prospect.stage].bg,
                    color: STAGE_COLORS[prospect.stage].text,
                  }}
                >
                  {STAGE_LABELS[prospect.stage]}
                </span>
              </div>
            </div>
          ))}
          {prospects.length === 0 && (
            <div style={styles.emptyList}>No prospects in the pipeline</div>
          )}
        </div>
      )}

      {/* Prospect Detail Modal */}
      {selectedProspect && (
        <ProspectDetailModal
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// PIPELINE COMPONENTS
// ============================================================================

function PipelineColumn({
  stage,
  prospects,
  count,
  onProspectClick,
}: {
  stage: ProspectStage;
  prospects: Prospect[];
  count: number;
  onProspectClick: (prospect: Prospect) => void;
}) {
  const colors = STAGE_COLORS[stage];

  return (
    <div style={styles.column}>
      <div
        style={{
          ...styles.columnHeader,
          background: colors.bg,
          borderColor: colors.border,
        }}
      >
        <span style={{ ...styles.columnTitle, color: colors.text }}>
          {STAGE_LABELS[stage]}
        </span>
        <span
          style={{
            ...styles.columnCount,
            background: colors.border,
            color: colors.text,
          }}
        >
          {count}
        </span>
      </div>
      <div style={styles.columnContent}>
        {prospects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            onClick={() => onProspectClick(prospect)}
          />
        ))}
        {prospects.length === 0 && (
          <div style={styles.emptyColumn}>
            <span style={styles.emptyText}>No prospects</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProspectCard({
  prospect,
  onClick,
}: {
  prospect: Prospect;
  onClick: () => void;
}) {
  const warmthColor = prospect.warmth
    ? WARMTH_COLORS[prospect.warmth]
    : WARMTH_COLORS.cold;

  return (
    <div style={styles.card} onClick={onClick}>
      <div style={styles.cardHeader}>
        <div style={styles.prospectAvatar}>
          {prospect.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div style={styles.prospectInfo}>
          <span style={styles.prospectName}>{prospect.name}</span>
          {prospect.firmName && (
            <span style={styles.prospectFirm}>{prospect.firmName}</span>
          )}
        </div>
      </div>

      <div style={styles.cardMeta}>
        {prospect.warmth && (
          <span
            style={{
              ...styles.warmthBadgeSmall,
              background: warmthColor.bg,
              color: warmthColor.text,
            }}
          >
            {WARMTH_LABELS[prospect.warmth]}
          </span>
        )}
        {prospect.source && (
          <span style={styles.sourceBadge}>{prospect.source}</span>
        )}
      </div>

      {prospect.email && (
        <div style={styles.cardEmail}>
          <span style={styles.emailText}>{prospect.email}</span>
        </div>
      )}
    </div>
  );
}

function ProspectDetailModal({
  prospect,
  onClose,
}: {
  prospect: Prospect;
  onClose: () => void;
}) {
  const warmthColor = prospect.warmth
    ? WARMTH_COLORS[prospect.warmth]
    : WARMTH_COLORS.cold;
  const stageColor = STAGE_COLORS[prospect.stage];

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div
        style={{ ...styles.modal, maxWidth: "600px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div style={styles.detailHeader}>
            <div style={styles.detailAvatar}>
              {prospect.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h2 style={styles.modalTitle}>{prospect.name}</h2>
              {prospect.firmName && (
                <p style={styles.detailFirm}>{prospect.firmName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            ×
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.badgeRow}>
            <span
              style={{
                ...styles.stageBadge,
                background: stageColor.bg,
                color: stageColor.text,
                borderColor: stageColor.border,
              }}
            >
              {STAGE_LABELS[prospect.stage]}
            </span>
            {prospect.warmth && (
              <span
                style={{
                  ...styles.warmthBadgeLarge,
                  background: warmthColor.bg,
                  color: warmthColor.text,
                }}
              >
                {WARMTH_LABELS[prospect.warmth]}
              </span>
            )}
          </div>

          <div style={styles.detailSection}>
            <h4 style={styles.sectionTitle}>Contact Information</h4>
            <div style={styles.detailGrid}>
              {prospect.email && (
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Email</span>
                  <a href={`mailto:${prospect.email}`} style={styles.detailLink}>
                    {prospect.email}
                  </a>
                </div>
              )}
              {prospect.phone && (
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Phone</span>
                  <span style={styles.detailValue}>{prospect.phone}</span>
                </div>
              )}
              {prospect.location && (
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Location</span>
                  <span style={styles.detailValue}>{prospect.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.secondaryBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADD INVESTOR MODAL
// ============================================================================

function AddInvestorModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    legalName: string;
    email: string;
    phone?: string;
    firmName?: string;
    warmth?: Warmth;
    amountInvested?: number;
    amountCommitted?: number;
  }) => void;
}) {
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firmName, setFirmName] = useState("");
  const [warmth, setWarmth] = useState<Warmth>("cold");
  const [amountInvested, setAmountInvested] = useState("");
  const [amountCommitted, setAmountCommitted] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim() || !email.trim()) return;

    onSave({
      legalName: legalName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      firmName: firmName.trim() || undefined,
      warmth,
      amountInvested: amountInvested ? parseFloat(amountInvested) : undefined,
      amountCommitted: amountCommitted ? parseFloat(amountCommitted) : undefined,
    });
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: "550px" }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Add New Investor</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={styles.modalBody}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name *</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                style={styles.input}
                placeholder="Enter investor's full name"
                required
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Firm / Company</label>
              <input
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                style={styles.input}
                placeholder="Investment firm or company name"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Relationship Warmth</label>
              <div style={styles.warmthSelector}>
                {WARMTH_OPTIONS.map((w) => {
                  const colors = WARMTH_COLORS[w];
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWarmth(w)}
                      style={{
                        ...styles.warmthOption,
                        background: warmth === w ? colors.bg : "#f9fafb",
                        color: warmth === w ? colors.text : "#6b7280",
                        borderColor: warmth === w ? colors.text : "#e5e7eb",
                      }}
                    >
                      {WARMTH_LABELS[w]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Amount Invested ($)</label>
                <input
                  type="number"
                  value={amountInvested}
                  onChange={(e) => setAmountInvested(e.target.value)}
                  style={styles.input}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Amount Committed ($)</label>
                <input
                  type="number"
                  value={amountCommitted}
                  onChange={(e) => setAmountCommitted(e.target.value)}
                  style={styles.input}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          </div>
          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.secondaryBtn}>
              Cancel
            </button>
            <button type="submit" style={styles.primaryBtn}>
              Add Investor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN KYI COMPONENT
// ============================================================================

export function KYI() {
  const [investors, setInvestors] = useState<InvestorListItem[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<InvestorListItem | null>(null);
  const [investorProfile, setInvestorProfile] = useState<InvestorProfile | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<ProspectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Load investors list
  const loadInvestors = useCallback(async () => {
    try {
      setLoading(true);
      const response = await kyiApi.investors.getInvestors({
        search: searchQuery || undefined,
      });
      setInvestors(response.investors);
    } catch (err) {
      console.error("Failed to load investors:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Load investor detail data
  const loadInvestorDetail = useCallback(async (investorId: number) => {
    try {
      setLoading(true);
      const [profile, prospectsRes, statsRes] = await Promise.all([
        kyiApi.investors.getFullProfile(investorId),
        kyiApi.prospects.getProspects({ perPage: 200 }),
        kyiApi.prospects.getStats(),
      ]);
      setInvestorProfile(profile);
      setProspects(prospectsRes.prospects);
      setStats(statsRes);
    } catch (err) {
      console.error("Failed to load investor detail:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedInvestor) {
      loadInvestorDetail(selectedInvestor.id);
    } else {
      loadInvestors();
    }
  }, [selectedInvestor, loadInvestors, loadInvestorDetail]);

  const handleSelectInvestor = (investor: InvestorListItem) => {
    setSelectedInvestor(investor);
  };

  const handleBack = () => {
    setSelectedInvestor(null);
    setInvestorProfile(null);
    setProspects([]);
    setStats(null);
  };

  const handleAddInvestor = (data: {
    legalName: string;
    email: string;
    phone?: string;
    firmName?: string;
    warmth?: Warmth;
    amountInvested?: number;
    amountCommitted?: number;
  }) => {
    // Create a new investor and add to the list
    const newInvestor: InvestorListItem = {
      id: Date.now(), // temporary ID
      legalName: data.legalName,
      email: data.email,
      firmName: data.firmName || null,
      warmth: data.warmth || null,
      relationshipStrength: data.warmth === "trusted" ? 5 : data.warmth === "warm" ? 3 : 1,
      amountInvested: data.amountInvested || null,
      amountCommitted: data.amountCommitted || null,
      strategicValue: null,
      status: "active",
      lastContact: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString().split("T")[0],
    };
    setInvestors((prev) => [newInvestor, ...prev]);
    setShowAddModal(false);
  };

  // Show detail view if investor is selected
  if (selectedInvestor) {
    return (
      <InvestorDetailView
        investor={selectedInvestor}
        investors={investors}
        profile={investorProfile}
        prospects={prospects}
        stats={stats}
        loading={loading}
        onBack={handleBack}
      />
    );
  }

  // Show investor list
  return (
    <>
      <InvestorListView
        investors={investors}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectInvestor={handleSelectInvestor}
        onAddInvestor={() => setShowAddModal(true)}
      />
      {showAddModal && (
        <AddInvestorModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddInvestor}
        />
      )}
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px",
    width: "100%",
    maxWidth: "1344px",
    margin: "0 auto",
    minHeight: "calc(100vh - 80px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxSizing: "border-box" as const,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  headerProfile: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  headerAvatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: 600,
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  backBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "16px",
    flexShrink: 0,
  },
  statCard: {
    background: "#fff",
    borderRadius: "10px",
    padding: "12px 16px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  statValue: {
    display: "block",
    fontSize: "22px",
    fontWeight: 700,
    color: "#1f2937",
  },
  statLabel: {
    fontSize: "12px",
    color: "#6b7280",
  },
  controls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "12px",
    flexShrink: 0,
  },
  searchInput: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    width: "300px",
  },
  viewToggle: {
    display: "flex",
    gap: "4px",
    background: "#f3f4f6",
    padding: "4px",
    borderRadius: "10px",
  },
  toggleBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  toggleBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  // Investor Grid
  investorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px",
    flex: 1,
    width: "100%",
    overflowY: "auto",
    padding: "4px",
    boxSizing: "border-box" as const,
  },
  investorCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
    cursor: "pointer",
    transition: "all 0.2s",
    border: "1px solid #f3f4f6",
  },
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
  },
  cardAvatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: 600,
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    display: "block",
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
  },
  cardFirm: {
    display: "block",
    fontSize: "13px",
    color: "#6b7280",
    marginTop: "2px",
  },
  warmthBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    flexShrink: 0,
  },
  warmthBadgeInline: {
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: 600,
  },
  cardStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    padding: "12px 0",
    borderTop: "1px solid #f3f4f6",
    borderBottom: "1px solid #f3f4f6",
    marginBottom: "12px",
  },
  cardStat: {
    textAlign: "center",
  },
  cardStatLabel: {
    display: "block",
    fontSize: "11px",
    color: "#9ca3af",
    marginBottom: "2px",
  },
  cardStatValue: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  cardFooter: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "12px",
  },
  cardEmail: {
    fontSize: "13px",
    color: "#6b7280",
  },
  cardLastContact: {
    fontSize: "12px",
    color: "#9ca3af",
  },
  cardAction: {
    textAlign: "right",
  },
  viewProfileBtn: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#667eea",
    cursor: "pointer",
  },
  // Profile Summary
  profileSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "12px",
    marginBottom: "16px",
    flexShrink: 0,
  },
  profileCard: {
    background: "#fff",
    borderRadius: "10px",
    padding: "12px 16px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  profileLabel: {
    display: "block",
    fontSize: "11px",
    color: "#9ca3af",
    marginBottom: "4px",
    textTransform: "uppercase",
  },
  profileValue: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  // Pipeline
  pipeline: {
    display: "flex",
    gap: "12px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  column: {
    flex: 1,
    minWidth: "180px",
    display: "flex",
    flexDirection: "column",
    maxHeight: "100%",
  },
  columnHeader: {
    padding: "10px 12px",
    borderRadius: "8px 8px 0 0",
    borderBottom: "2px solid",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  columnTitle: {
    fontSize: "13px",
    fontWeight: 600,
  },
  columnCount: {
    padding: "2px 6px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600,
  },
  columnContent: {
    flex: 1,
    background: "#f9fafb",
    borderRadius: "0 0 10px 10px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
    minHeight: 0,
  },
  emptyColumn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: "80px",
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: "13px",
  },
  // Prospect Card
  card: {
    background: "#fff",
    borderRadius: "8px",
    padding: "12px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
    cursor: "pointer",
    flexShrink: 0,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  prospectAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 600,
    flexShrink: 0,
  },
  prospectInfo: {
    flex: 1,
    minWidth: 0,
  },
  prospectName: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  prospectFirm: {
    display: "block",
    fontSize: "12px",
    color: "#6b7280",
  },
  cardMeta: {
    display: "flex",
    gap: "6px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  warmthBadgeSmall: {
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "10px",
    fontWeight: 600,
  },
  sourceBadge: {
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "10px",
    fontWeight: 500,
    background: "#f3f4f6",
    color: "#6b7280",
  },
  emailText: {
    fontSize: "11px",
    color: "#6b7280",
  },
  // List View
  listView: {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
    flex: 1,
    overflowY: "auto",
    minHeight: 0,
  },
  listHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1.5fr 2fr 1fr",
    padding: "12px 20px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 600,
    fontSize: "12px",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  listHeaderCell: {},
  listRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1.5fr 2fr 1fr",
    padding: "14px 20px",
    borderBottom: "1px solid #f3f4f6",
    cursor: "pointer",
  },
  listName: {
    fontWeight: 600,
    color: "#1f2937",
  },
  listFirm: {
    color: "#6b7280",
  },
  listEmail: {
    color: "#6b7280",
    fontSize: "13px",
  },
  listStage: {},
  stageBadgeSmall: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
  },
  emptyList: {
    padding: "40px",
    textAlign: "center",
    color: "#9ca3af",
  },
  // Access Map
  accessMapContainer: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  // States
  loadingState: {
    padding: "60px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "16px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 40px",
    textAlign: "center",
    flex: 1,
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  emptySubtext: {
    fontSize: "14px",
    color: "#9ca3af",
    marginTop: "8px",
  },
  // Modal
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
    maxWidth: "500px",
    maxHeight: "90vh",
    overflow: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  closeBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "20px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "24px",
  },
  modalFooter: {
    display: "flex",
    gap: "12px",
    padding: "16px 24px",
    borderTop: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: "0 0 16px 16px",
  },
  secondaryBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  // Detail Modal
  detailHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  detailAvatar: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: 600,
  },
  detailFirm: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  badgeRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  stageBadge: {
    padding: "6px 14px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: 600,
    border: "1px solid",
  },
  warmthBadgeLarge: {
    padding: "6px 14px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: 600,
  },
  detailSection: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  detailItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  detailLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: "14px",
    color: "#1f2937",
  },
  detailLink: {
    fontSize: "14px",
    color: "#667eea",
    textDecoration: "none",
  },
  // Header Actions
  headerActions: {
    display: "flex",
    gap: "12px",
  },
  primaryBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  // Form Styles
  formGroup: {
    marginBottom: "16px",
    flex: 1,
  },
  formRow: {
    display: "flex",
    gap: "16px",
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
  warmthSelector: {
    display: "flex",
    gap: "8px",
  },
  warmthOption: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
};

export default KYI;
