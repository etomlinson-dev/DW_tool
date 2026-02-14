import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { teamApi, type TeamMember } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

interface UserSettings {
  name: string;
  email: string;
  role: string;
  avatar: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  leadAssignment: boolean;
  proposalUpdates: boolean;
  investorActivity: boolean;
}

interface IntegrationSettings {
  microsoftConnected: boolean;
}

interface AppSettings {
  defaultView: "dashboard" | "workflow" | "calendar";
  leadsPerPage: number;
  autoSaveInterval: number;
  timezone: string;
  dateFormat: string;
  currency: string;
}

export function Settings() {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "notifications" | "integrations" | "preferences" | "team">("profile");
  
  const [user, setUser] = useState<UserSettings>({
    name: authUser?.name || "",
    email: authUser?.email || "",
    role: authUser?.role || "",
    avatar: authUser?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "",
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    dailyDigest: true,
    weeklyReport: true,
    leadAssignment: true,
    proposalUpdates: true,
    investorActivity: false,
  });

  const [integrations, setIntegrations] = useState<IntegrationSettings>({
    microsoftConnected: false,
  });

  const [appSettings, setAppSettings] = useState<AppSettings>({
    defaultView: "dashboard",
    leadsPerPage: 50,
    autoSaveInterval: 5,
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
  });

  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string; email: string; role: string; status: string }[]>([]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Invite Member modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "rep" });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Edit Member modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{ id: number; name: string; email: string; role: string }>({ id: 0, name: "", email: "", role: "rep" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Remove member state
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Update user state when authUser changes
  useEffect(() => {
    if (authUser) {
      setUser({
        name: authUser.name || "",
        email: authUser.email || "",
        role: authUser.role || "",
        avatar: authUser.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "",
      });
    }
  }, [authUser]);

  // Fetch team data from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch team members
      const teamData = await teamApi.getTeam();
      setTeamMembers(teamData.map((m: TeamMember) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role === "admin" ? "Admin" : m.role === "manager" ? "Manager" : "Sales Rep",
        status: m.is_active ? "Active" : "Inactive",
      })));
      
      // Check Microsoft connection status
      try {
        const msStatus = await fetch("/api/auth/microsoft/status");
        if (msStatus.ok) {
          const data = await msStatus.json();
          setIntegrations(prev => ({ ...prev, microsoftConnected: data.connected }));
        }
      } catch {
        // Microsoft auth not configured yet
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  };

  const handleInviteMember = async () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      setInviteError("Name and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email)) {
      setInviteError("Please enter a valid email address.");
      return;
    }
    setInviting(true);
    setInviteError("");
    try {
      const newMember = await teamApi.createMember({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        is_active: true,
      });
      setTeamMembers((prev) => [
        ...prev,
        {
          id: newMember.id,
          name: newMember.name,
          email: newMember.email,
          role: newMember.role === "admin" ? "Admin" : newMember.role === "manager" ? "Manager" : "Sales Rep",
          status: newMember.is_active ? "Active" : "Inactive",
        },
      ]);
      setShowInviteModal(false);
      setInviteForm({ name: "", email: "", role: "rep" });
    } catch (err: unknown) {
      console.error("Failed to invite member:", err);
      let msg = "Failed to invite member. Please try again.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        if (axiosErr.response?.data?.error) {
          msg = axiosErr.response.data.error;
        }
      }
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleEditMember = (member: { id: number; name: string; email: string; role: string }) => {
    const roleMap: Record<string, string> = { "Admin": "admin", "Manager": "manager", "Sales Rep": "rep" };
    setEditForm({
      id: member.id,
      name: member.name,
      email: member.email,
      role: roleMap[member.role] || "rep",
    });
    setEditError("");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError("Name and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      setEditError("Please enter a valid email address.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await teamApi.updateMember(editForm.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      });
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === editForm.id
            ? {
                ...m,
                name: updated.name,
                email: updated.email,
                role: updated.role === "admin" ? "Admin" : updated.role === "manager" ? "Manager" : "Sales Rep",
              }
            : m
        )
      );
      setShowEditModal(false);
    } catch (err: unknown) {
      console.error("Failed to update member:", err);
      let msg = "Failed to update member. Please try again.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        if (axiosErr.response?.data?.error) {
          msg = axiosErr.response.data.error;
        }
      }
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return;
    }
    setRemovingId(memberId);
    try {
      await teamApi.deleteMember(memberId);
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: unknown) {
      console.error("Failed to remove member:", err);
      let msg = "Failed to remove member. Please try again.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        if (axiosErr.response?.data?.error) {
          msg = axiosErr.response.data.error;
        }
      }
      alert(msg);
    } finally {
      setRemovingId(null);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "integrations", label: "Integrations", icon: "🔗" },
    { id: "preferences", label: "Preferences", icon: "⚙️" },
    { id: "team", label: "Team", icon: "👥" },
  ];

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
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>Manage your account and application preferences</p>
        </div>
        <motion.button
          onClick={handleSave}
          style={{
            ...styles.saveBtn,
            background: saveStatus === "saved" ? "#10b981" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
          disabled={saveStatus === "saving"}
          whileHover={{ scale: 1.05, boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)" }}
          whileTap={{ scale: 0.95 }}
        >
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "✓ Saved" : "Save Changes"}
        </motion.button>
      </motion.div>

      <motion.div 
        style={styles.layout}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Sidebar */}
        <div style={styles.sidebar}>
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                ...styles.tabBtn,
                ...(activeTab === tab.id ? styles.tabBtnActive : {}),
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              whileHover={{ scale: 1.02, x: 5 }}
            >
              <span style={styles.tabIcon}>{tab.icon}</span>
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <motion.div 
          style={styles.content}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {activeTab === "profile" && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Profile Settings</h2>
              <p style={styles.sectionDesc}>Your account information from Microsoft 365</p>

              <div style={styles.profileHeader}>
                <div style={styles.avatarLarge}>
                  {user.avatar}
                </div>
                <div style={styles.profileInfo}>
                  <h3 style={styles.profileName}>{user.name}</h3>
                  <p style={styles.profileEmail}>{user.email}</p>
                  <span style={styles.microsoftBadge}>
                    <svg style={{ width: '14px', height: '14px', marginRight: '6px' }} viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                    </svg>
                    Connected via Microsoft
                  </span>
                </div>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    value={user.name}
                    disabled
                    style={{ ...styles.input, background: "#f9fafb", cursor: "not-allowed" }}
                  />
                  <span style={styles.fieldHint}>Managed by Microsoft 365</span>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email Address</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    style={{ ...styles.input, background: "#f9fafb", cursor: "not-allowed" }}
                  />
                  <span style={styles.fieldHint}>Managed by Microsoft 365</span>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Role</label>
                  <input
                    type="text"
                    value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    disabled
                    style={{ ...styles.input, background: "#f9fafb", cursor: "not-allowed" }}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>User ID</label>
                  <input
                    type="text"
                    value={authUser?.id?.toString() || ""}
                    disabled
                    style={{ ...styles.input, background: "#f9fafb", cursor: "not-allowed" }}
                  />
                </div>
              </div>

              <div style={styles.divider} />

              <div style={styles.accountActions}>
                <h3 style={styles.subsectionTitle}>Account Actions</h3>
                <p style={styles.sectionDesc}>Your account is managed through Microsoft 365. To change your password or profile photo, please use your Microsoft account settings.</p>
                <a 
                  href="https://myaccount.microsoft.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={styles.microsoftAccountLink}
                >
                  Open Microsoft Account Settings →
                </a>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Notification Preferences</h2>
              <p style={styles.sectionDesc}>Control how you receive notifications</p>

              <div style={styles.toggleGroup}>
                <div style={styles.toggleRow}>
                  <div>
                    <span style={styles.toggleLabel}>Email Notifications</span>
                    <span style={styles.toggleDesc}>Receive notifications via email</span>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, emailNotifications: !notifications.emailNotifications })}
                    style={{
                      ...styles.toggle,
                      ...(notifications.emailNotifications ? styles.toggleOn : {}),
                    }}
                  >
                    <span style={{
                      ...styles.toggleKnob,
                      ...(notifications.emailNotifications ? styles.toggleKnobOn : {}),
                    }} />
                  </button>
                </div>

                <div style={styles.toggleRow}>
                  <div>
                    <span style={styles.toggleLabel}>Push Notifications</span>
                    <span style={styles.toggleDesc}>Browser push notifications</span>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, pushNotifications: !notifications.pushNotifications })}
                    style={{
                      ...styles.toggle,
                      ...(notifications.pushNotifications ? styles.toggleOn : {}),
                    }}
                  >
                    <span style={{
                      ...styles.toggleKnob,
                      ...(notifications.pushNotifications ? styles.toggleKnobOn : {}),
                    }} />
                  </button>
                </div>

                <div style={styles.divider} />

                <div style={styles.toggleRow}>
                  <div>
                    <span style={styles.toggleLabel}>Daily Digest</span>
                    <span style={styles.toggleDesc}>Summary of daily activity every morning</span>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, dailyDigest: !notifications.dailyDigest })}
                    style={{
                      ...styles.toggle,
                      ...(notifications.dailyDigest ? styles.toggleOn : {}),
                    }}
                  >
                    <span style={{
                      ...styles.toggleKnob,
                      ...(notifications.dailyDigest ? styles.toggleKnobOn : {}),
                    }} />
                  </button>
                </div>

                <div style={styles.toggleRow}>
                  <div>
                    <span style={styles.toggleLabel}>Weekly Report</span>
                    <span style={styles.toggleDesc}>Weekly performance summary</span>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, weeklyReport: !notifications.weeklyReport })}
                    style={{
                      ...styles.toggle,
                      ...(notifications.weeklyReport ? styles.toggleOn : {}),
                    }}
                  >
                    <span style={{
                      ...styles.toggleKnob,
                      ...(notifications.weeklyReport ? styles.toggleKnobOn : {}),
                    }} />
                  </button>
                </div>

                <div style={styles.divider} />

                <div style={styles.toggleRow}>
                  <div>
                    <span style={styles.toggleLabel}>Lead Assignment</span>
                    <span style={styles.toggleDesc}>When a new lead is assigned to you</span>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, leadAssignment: !notifications.leadAssignment })}
                    style={{
                      ...styles.toggle,
                      ...(notifications.leadAssignment ? styles.toggleOn : {}),
                    }}
                  >
                    <span style={{
                      ...styles.toggleKnob,
                      ...(notifications.leadAssignment ? styles.toggleKnobOn : {}),
                    }} />
                  </button>
                </div>

                <div style={styles.toggleRow}>
                  <div>
                    <span style={styles.toggleLabel}>Proposal Updates</span>
                    <span style={styles.toggleDesc}>When proposals are viewed or accepted</span>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, proposalUpdates: !notifications.proposalUpdates })}
                    style={{
                      ...styles.toggle,
                      ...(notifications.proposalUpdates ? styles.toggleOn : {}),
                    }}
                  >
                    <span style={{
                      ...styles.toggleKnob,
                      ...(notifications.proposalUpdates ? styles.toggleKnobOn : {}),
                    }} />
                  </button>
                </div>

                <div style={styles.toggleRow}>
                  <div>
                    <span style={styles.toggleLabel}>Investor Activity</span>
                    <span style={styles.toggleDesc}>Updates from KYI investor tracking</span>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, investorActivity: !notifications.investorActivity })}
                    style={{
                      ...styles.toggle,
                      ...(notifications.investorActivity ? styles.toggleOn : {}),
                    }}
                  >
                    <span style={{
                      ...styles.toggleKnob,
                      ...(notifications.investorActivity ? styles.toggleKnobOn : {}),
                    }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Connected Integrations</h2>
              <p style={styles.sectionDesc}>Manage third-party connections</p>

              <div style={styles.integrationsList}>
                <div style={styles.integrationCard}>
                  <div style={styles.integrationIcon}>
                    <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                    </svg>
                  </div>
                  <div style={styles.integrationInfo}>
                    <span style={styles.integrationName}>Microsoft 365</span>
                    <span style={styles.integrationDesc}>Email, Calendar, and Contacts sync</span>
                  </div>
                  {integrations.microsoftConnected ? (
                    <div style={styles.integrationStatus}>
                      <span style={styles.connectedBadge}>Connected</span>
                      <button style={styles.disconnectBtn}>Disconnect</button>
                    </div>
                  ) : (
                    <button style={styles.connectBtn}>Connect</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Application Preferences</h2>
              <p style={styles.sectionDesc}>Customize your experience</p>

              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Default View</label>
                  <select
                    value={appSettings.defaultView}
                    onChange={(e) => setAppSettings({ ...appSettings, defaultView: e.target.value as AppSettings["defaultView"] })}
                    style={styles.select}
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="workflow">Workflow</option>
                    <option value="calendar">Calendar</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Leads Per Page</label>
                  <select
                    value={appSettings.leadsPerPage}
                    onChange={(e) => setAppSettings({ ...appSettings, leadsPerPage: Number(e.target.value) })}
                    style={styles.select}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Auto-save Interval (minutes)</label>
                  <select
                    value={appSettings.autoSaveInterval}
                    onChange={(e) => setAppSettings({ ...appSettings, autoSaveInterval: Number(e.target.value) })}
                    style={styles.select}
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Timezone</label>
                  <select
                    value={appSettings.timezone}
                    onChange={(e) => setAppSettings({ ...appSettings, timezone: e.target.value })}
                    style={styles.select}
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Date Format</label>
                  <select
                    value={appSettings.dateFormat}
                    onChange={(e) => setAppSettings({ ...appSettings, dateFormat: e.target.value })}
                    style={styles.select}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Currency</label>
                  <select
                    value={appSettings.currency}
                    onChange={(e) => setAppSettings({ ...appSettings, currency: e.target.value })}
                    style={styles.select}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div style={styles.section}>
              <div style={styles.teamHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Team Members</h2>
                  <p style={styles.sectionDesc}>Manage your team and permissions</p>
                </div>
                <button style={styles.inviteBtn} onClick={() => { setShowInviteModal(true); setInviteError(""); }}>+ Invite Member</button>
              </div>

              <div style={styles.teamTable}>
                <div style={styles.teamTableHeader}>
                  <span style={{ flex: 2 }}>Member</span>
                  <span style={{ flex: 1 }}>Role</span>
                  <span style={{ flex: 1, textAlign: "center" }}>Status</span>
                  <span style={{ flex: 1, textAlign: "right" }}>Actions</span>
                </div>
                {teamMembers.map((member) => (
                  <div key={member.id} style={styles.teamTableRow}>
                    <div style={{ flex: 2, display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={styles.memberAvatar}>
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <span style={styles.memberName}>{member.name}</span>
                        <span style={styles.memberEmail}>{member.email}</span>
                      </div>
                    </div>
                    <span style={{ flex: 1 }}>
                      <span style={{
                        ...styles.roleBadge,
                        background: member.role === "Admin" ? "#fef3c7" : "#f3f4f6",
                        color: member.role === "Admin" ? "#92400e" : "#6b7280",
                      }}>
                        {member.role}
                      </span>
                    </span>
                    <span style={{ flex: 1, textAlign: "center" }}>
                      <span style={{
                        ...styles.statusDot,
                        background: member.status === "Active" ? "#10b981" : "#9ca3af",
                      }} />
                      <span style={{ color: member.status === "Active" ? "#059669" : "#9ca3af" }}>
                        {member.status}
                      </span>
                    </span>
                    <span style={{ flex: 1, textAlign: "right" }}>
                      <button style={styles.editBtn} onClick={() => handleEditMember(member)}>Edit</button>
                      <button
                        style={{ ...styles.removeMemberBtn, opacity: removingId === member.id ? 0.5 : 1 }}
                        onClick={() => handleRemoveMember(member.id, member.name)}
                        disabled={removingId === member.id}
                      >
                        {removingId === member.id ? "..." : "Remove"}
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              {/* Edit Member Modal */}
              {showEditModal && (
                <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
                  <motion.div
                    style={styles.modalContent}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div style={styles.modalHeader}>
                      <h3 style={styles.modalTitle}>Edit Team Member</h3>
                      <button style={styles.modalCloseBtn} onClick={() => setShowEditModal(false)}>✕</button>
                    </div>

                    <div style={styles.modalBody}>
                      {editError && (
                        <div style={styles.errorBanner}>{editError}</div>
                      )}

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Full Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          style={styles.input}
                          autoFocus
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Email Address</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          style={styles.input}
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Role</label>
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          style={styles.select}
                        >
                          <option value="rep">Sales Rep</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    <div style={styles.modalFooter}>
                      <button
                        style={styles.modalCancelBtn}
                        onClick={() => setShowEditModal(false)}
                        disabled={editSaving}
                      >
                        Cancel
                      </button>
                      <button
                        style={{ ...styles.inviteBtn, opacity: editSaving ? 0.7 : 1 }}
                        onClick={handleSaveEdit}
                        disabled={editSaving}
                      >
                        {editSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Invite Member Modal */}
              {showInviteModal && (
                <div style={styles.modalOverlay} onClick={() => setShowInviteModal(false)}>
                  <motion.div
                    style={styles.modalContent}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div style={styles.modalHeader}>
                      <h3 style={styles.modalTitle}>Invite Team Member</h3>
                      <button style={styles.modalCloseBtn} onClick={() => setShowInviteModal(false)}>✕</button>
                    </div>

                    <div style={styles.modalBody}>
                      {inviteError && (
                        <div style={styles.errorBanner}>{inviteError}</div>
                      )}

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Full Name</label>
                        <input
                          type="text"
                          placeholder="e.g. John Smith"
                          value={inviteForm.name}
                          onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                          style={styles.input}
                          autoFocus
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Email Address</label>
                        <input
                          type="email"
                          placeholder="e.g. john@company.com"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                          style={styles.input}
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Role</label>
                        <select
                          value={inviteForm.role}
                          onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                          style={styles.select}
                        >
                          <option value="rep">Sales Rep</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    <div style={styles.modalFooter}>
                      <button
                        style={styles.modalCancelBtn}
                        onClick={() => setShowInviteModal(false)}
                        disabled={inviting}
                      >
                        Cancel
                      </button>
                      <button
                        style={{ ...styles.inviteBtn, opacity: inviting ? 0.7 : 1 }}
                        onClick={handleInviteMember}
                        disabled={inviting}
                      >
                        {inviting ? "Inviting..." : "Invite Member"}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
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
    marginBottom: "32px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-color)",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--bg-cream)",
    margin: "4px 0 0",
  },
  saveBtn: {
    padding: "12px 24px",
    borderRadius: "8px",
    border: "none",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: "32px",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "var(--bg-cream)",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
  },
  tabBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },
  tabIcon: {
    fontSize: "18px",
  },
  content: {
    background: "#fff",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
  },
  section: {},
  sectionTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 4px",
  },
  sectionDesc: {
    fontSize: "14px",
    color: "var(--bg-cream)",
    margin: "0 0 24px",
  },
  subsectionTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px",
  },
  profileHeader: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    marginBottom: "32px",
  },
  avatarLarge: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)",
    color: "#f8f5f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(18, 44, 33, 0.25)",
  },
  profileInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  profileName: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  profileEmail: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  microsoftBadge: {
    display: "inline-flex",
    alignItems: "center",
    marginTop: "8px",
    padding: "6px 12px",
    borderRadius: "20px",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 500,
  },
  fieldHint: {
    fontSize: "11px",
    color: "#9ca3af",
    marginTop: "4px",
  },
  accountActions: {
    marginTop: "8px",
  },
  microsoftAccountLink: {
    display: "inline-flex",
    alignItems: "center",
    marginTop: "12px",
    padding: "10px 16px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)",
    color: "#f8f5f0",
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
  },
  changeAvatarBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "20px",
    marginBottom: "24px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
  },
  select: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
  },
  divider: {
    height: "1px",
    background: "#e5e7eb",
    margin: "24px 0",
  },
  toggleGroup: {},
  toggleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  toggleLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    color: "#1f2937",
  },
  toggleDesc: {
    display: "block",
    fontSize: "13px",
    color: "#9ca3af",
    marginTop: "2px",
  },
  toggle: {
    width: "48px",
    height: "28px",
    borderRadius: "14px",
    border: "none",
    background: "#e5e7eb",
    cursor: "pointer",
    position: "relative",
    transition: "all 0.2s",
  },
  toggleOn: {
    background: "#667eea",
  },
  toggleKnob: {
    position: "absolute",
    top: "3px",
    left: "3px",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "#fff",
    transition: "all 0.2s",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
  },
  toggleKnobOn: {
    left: "23px",
  },
  integrationsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  integrationCard: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px 20px",
    background: "#f9fafb",
    borderRadius: "12px",
  },
  integrationIcon: {
    fontSize: "24px",
  },
  integrationInfo: {
    flex: 1,
  },
  integrationName: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  integrationDesc: {
    fontSize: "13px",
    color: "#6b7280",
  },
  integrationStatus: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  connectedBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 500,
  },
  connectBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  disconnectBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "13px",
    cursor: "pointer",
  },
  teamHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  inviteBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  teamTable: {},
  teamTableHeader: {
    display: "flex",
    padding: "12px 16px",
    background: "#f9fafb",
    borderRadius: "8px 8px 0 0",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  teamTableRow: {
    display: "flex",
    alignItems: "center",
    padding: "16px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "14px",
    color: "#1f2937",
  },
  memberAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)",
    color: "#f8f5f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: 600,
  },
  memberName: {
    display: "block",
    fontWeight: 500,
  },
  memberEmail: {
    display: "block",
    fontSize: "13px",
    color: "#6b7280",
  },
  roleBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 500,
  },
  statusDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    marginRight: "6px",
  },
  editBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "12px",
    cursor: "pointer",
    marginRight: "8px",
  },
  removeMemberBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: "12px",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    background: "#fff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "480px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #f3f4f6",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  modalCloseBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "16px 24px",
    borderTop: "1px solid #f3f4f6",
    background: "#f9fafb",
  },
  modalCancelBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  errorBanner: {
    padding: "12px 16px",
    borderRadius: "8px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    fontSize: "13px",
    fontWeight: 500,
  },
};

export default Settings;
