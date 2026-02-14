import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { leadsApi, logsApi, callScriptsApi, type CallScript } from "../api/client";
import type { Lead, Log } from "../types";
import { LEAD_STATUS_OPTIONS } from "../types";

type CallOutcome = "Connected" | "Voicemail" | "No Answer" | "Busy" | "Wrong Number" | "Callback Requested";

const CALL_OUTCOMES: CallOutcome[] = [
  "Connected",
  "Voicemail",
  "No Answer",
  "Busy",
  "Wrong Number",
  "Callback Requested",
];

// Default scripts (fallback if API fails)
const DEFAULT_SCRIPTS: Record<string, string> = {
  intro: `Hi, this is [Your Name] from DW Growth & Capital. 

I'm reaching out because we help businesses like yours [specific value prop based on industry].

Do you have a quick moment to chat about how we might be able to help?`,
  
  voicemail: `Hi [Contact Name], this is [Your Name] from DW Growth & Capital.

I'm reaching out because we work with companies in [industry] to help them [value prop].

I'd love to connect briefly to see if we might be a good fit. 

You can reach me at [your phone]. Again, that's [your phone].

Looking forward to speaking with you!`,

  "follow-up": `Hi [Contact Name], it's [Your Name] from DW Growth & Capital again.

I wanted to follow up on my previous message. We've been helping companies like [similar company] achieve [specific result].

Would you have 15 minutes this week for a quick call?`,

  objection: `I completely understand your concern about [objection].

Many of our current clients felt the same way initially. What they found was [address concern with benefit].

Would it help if I shared a quick case study of how we helped [similar company]?`,
};

export function Dialer() {
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get("lead_id");

  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [leadQueue, setLeadQueue] = useState<Lead[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Call scripts from API
  const [callScripts, setCallScripts] = useState<Record<string, string>>(DEFAULT_SCRIPTS);

  // Call state
  const [callActive, setCallActive] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | "">("");
  const [callNotes, setCallNotes] = useState("");
  const [activeScript, setActiveScript] = useState<string>("intro");

  // Recent logs for current lead
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);

  // Fetch call scripts from API
  useEffect(() => {
    const loadScripts = async () => {
      try {
        const scripts = await callScriptsApi.getScripts();
        const scriptMap: Record<string, string> = {};
        scripts.forEach((s: CallScript) => {
          scriptMap[s.script_type] = s.content;
        });
        if (Object.keys(scriptMap).length > 0) {
          setCallScripts({ ...DEFAULT_SCRIPTS, ...scriptMap });
        }
      } catch (err) {
        console.error("Failed to load call scripts:", err);
        // Keep default scripts
      }
    };
    loadScripts();
  }, []);

  // Load leads
  useEffect(() => {
    const loadLeads = async () => {
      setLoading(true);
      try {
        // Get leads that need calling (Not Contacted or Attempted)
        const response = await leadsApi.getLeads({
          status: "Not Contacted",
          per_page: 50,
        });
        
        let queue = response.data;
        
        // Also get Attempted leads
        const attemptedResponse = await leadsApi.getLeads({
          status: "Attempted",
          per_page: 50,
        });
        queue = [...queue, ...attemptedResponse.data];

        setLeadQueue(queue);

        // If specific lead requested, find it
        if (leadIdParam) {
          const specificLead = queue.find(l => l.id === parseInt(leadIdParam));
          if (specificLead) {
            setCurrentLead(specificLead);
            setQueueIndex(queue.indexOf(specificLead));
          } else {
            // Fetch the specific lead
            const lead = await leadsApi.getLead(parseInt(leadIdParam));
            setCurrentLead(lead);
            setLeadQueue([lead, ...queue]);
          }
        } else if (queue.length > 0) {
          setCurrentLead(queue[0]);
        }
      } catch (err) {
        console.error("Failed to load leads:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLeads();
  }, [leadIdParam]);

  // Load recent logs for current lead
  useEffect(() => {
    if (!currentLead) return;
    
    logsApi.getLogsForLead(currentLead.id)
      .then(logs => setRecentLogs(logs.slice(0, 5)))
      .catch(console.error);
  }, [currentLead]);

  // Call timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callActive && callStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive, callStartTime]);

  const startCall = () => {
    setCallActive(true);
    setCallStartTime(new Date());
    setCallDuration(0);
    setSelectedOutcome("");
    setCallNotes("");
  };

  const endCall = () => {
    setCallActive(false);
  };

  const logCall = async () => {
    if (!currentLead || !selectedOutcome) return;

    try {
      await logsApi.createLog(currentLead.id, {
        activity_type: "Call",
        outcome: selectedOutcome,
        call_duration: callDuration,
        call_notes: callNotes,
        notes: callNotes,
      });

      // Update lead status if connected
      if (selectedOutcome === "Connected") {
        await leadsApi.updateLeadStatus(currentLead.id, "Connected");
      } else if (selectedOutcome !== "Connected" && currentLead.status === "Not Contacted") {
        await leadsApi.updateLeadStatus(currentLead.id, "Attempted");
      }

      // Move to next lead
      nextLead();
    } catch (err) {
      console.error("Failed to log call:", err);
    }
  };

  const nextLead = () => {
    const nextIndex = queueIndex + 1;
    if (nextIndex < leadQueue.length) {
      setQueueIndex(nextIndex);
      setCurrentLead(leadQueue[nextIndex]);
      setCallActive(false);
      setCallDuration(0);
      setSelectedOutcome("");
      setCallNotes("");
    }
  };

  const prevLead = () => {
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      setQueueIndex(prevIndex);
      setCurrentLead(leadQueue[prevIndex]);
      setCallActive(false);
      setCallDuration(0);
      setSelectedOutcome("");
      setCallNotes("");
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", { timeZone: "America/New_York" });
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div>Loading dialer...</div>
      </div>
    );
  }

  if (!currentLead) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📞</div>
          <h2 style={styles.emptyTitle}>No Leads to Call</h2>
          <p style={styles.emptyText}>
            There are no leads in the queue. Add some leads or adjust your filters.
          </p>
          <Link to="/" style={styles.backBtn}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Link to="/" style={styles.backLink}>← Back</Link>
          <h1 style={styles.title}>Power Dialer</h1>
        </div>
        <div style={styles.queueInfo}>
          <span style={styles.queueLabel}>Queue:</span>
          <span style={styles.queueCount}>{queueIndex + 1} of {leadQueue.length}</span>
          <div style={styles.queueNav}>
            <button onClick={prevLead} disabled={queueIndex === 0} style={styles.navBtn}>←</button>
            <button onClick={nextLead} disabled={queueIndex >= leadQueue.length - 1} style={styles.navBtn}>→</button>
          </div>
        </div>
      </div>

      <div style={styles.content}>
        {/* Main Dialer Panel */}
        <div style={styles.dialerPanel}>
          {/* Lead Info Card */}
          <div style={styles.leadCard}>
            <div style={styles.leadHeader}>
              <div>
                <h2 style={styles.leadName}>{currentLead.business_name}</h2>
                <p style={styles.leadContact}>{currentLead.contact_name || "No contact name"}</p>
              </div>
              <span style={{
                ...styles.statusBadge,
                background: currentLead.status === "Not Contacted" ? "#fee2e2" : "#fef3c7",
                color: currentLead.status === "Not Contacted" ? "#dc2626" : "#d97706",
              }}>
                {currentLead.status}
              </span>
            </div>

            <div style={styles.leadDetails}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Phone</span>
                <a href={`tel:${currentLead.phone}`} style={styles.phoneNumber}>
                  {currentLead.phone || "No phone"}
                </a>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Email</span>
                <span style={styles.detailValue}>{currentLead.email || "N/A"}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Industry</span>
                <span style={styles.detailValue}>{currentLead.industry || "N/A"}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Last Activity</span>
                <span style={styles.detailValue}>{formatDate(currentLead.last_activity)}</span>
              </div>
            </div>

            {currentLead.notes && (
              <div style={styles.notesSection}>
                <span style={styles.notesLabel}>Notes:</span>
                <p style={styles.notesText}>{currentLead.notes}</p>
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div style={styles.callControls}>
            {!callActive ? (
              <button onClick={startCall} style={styles.startCallBtn}>
                📞 Start Call
              </button>
            ) : (
              <div style={styles.activeCall}>
                <div style={styles.callTimer}>
                  <span style={styles.timerLabel}>Call Duration</span>
                  <span style={styles.timerValue}>{formatDuration(callDuration)}</span>
                </div>
                <button onClick={endCall} style={styles.endCallBtn}>
                  End Call
                </button>
              </div>
            )}
          </div>

          {/* Call Outcome */}
          <div style={styles.outcomeSection}>
            <h3 style={styles.sectionTitle}>Call Outcome</h3>
            <div style={styles.outcomeGrid}>
              {CALL_OUTCOMES.map((outcome) => (
                <button
                  key={outcome}
                  onClick={() => setSelectedOutcome(outcome)}
                  style={{
                    ...styles.outcomeBtn,
                    ...(selectedOutcome === outcome ? styles.outcomeBtnActive : {}),
                  }}
                >
                  {outcome}
                </button>
              ))}
            </div>
          </div>

          {/* Call Notes */}
          <div style={styles.notesInputSection}>
            <h3 style={styles.sectionTitle}>Call Notes</h3>
            <textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Enter call notes here..."
              style={styles.notesInput}
              rows={4}
            />
          </div>

          {/* Action Buttons */}
          <div style={styles.actionButtons}>
            <button
              onClick={logCall}
              disabled={!selectedOutcome}
              style={{
                ...styles.logBtn,
                opacity: selectedOutcome ? 1 : 0.5,
              }}
            >
              ✓ Log Call & Next
            </button>
            <button onClick={nextLead} style={styles.skipBtn}>
              Skip →
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={styles.sidebar}>
          {/* Call Scripts */}
          <div style={styles.scriptsCard}>
            <h3 style={styles.cardTitle}>Call Scripts</h3>
            <div style={styles.scriptTabs}>
              {Object.keys(callScripts).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveScript(key)}
                  style={{
                    ...styles.scriptTab,
                    ...(activeScript === key ? styles.scriptTabActive : {}),
                  }}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, " ").replace(/([A-Z])/g, " $1")}
                </button>
              ))}
            </div>
            <div style={styles.scriptContent}>
              <pre style={styles.scriptText}>
                {(callScripts[activeScript] || "")
                  .replace(/\[Contact Name\]/g, currentLead.contact_name || "[Contact]")
                  .replace(/\[industry\]/g, currentLead.industry || "your industry")}
              </pre>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={styles.activityCard}>
            <h3 style={styles.cardTitle}>Recent Activity</h3>
            {recentLogs.length === 0 ? (
              <p style={styles.noActivity}>No recent activity</p>
            ) : (
              <div style={styles.activityList}>
                {recentLogs.map((log) => (
                  <div key={log.id} style={styles.activityItem}>
                    <div style={styles.activityHeader}>
                      <span style={styles.activityType}>{log.activity_type}</span>
                      <span style={styles.activityDate}>{formatDate(log.timestamp)}</span>
                    </div>
                    <span style={styles.activityOutcome}>{log.outcome}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Status Update */}
          <div style={styles.statusCard}>
            <h3 style={styles.cardTitle}>Update Status</h3>
            <select
              value={currentLead.status}
              onChange={async (e) => {
                const newStatus = e.target.value as typeof LEAD_STATUS_OPTIONS[number];
                await leadsApi.updateLeadStatus(currentLead.id, newStatus);
                setCurrentLead({ ...currentLead, status: newStatus });
              }}
              style={styles.statusSelect}
            >
              {LEAD_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
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
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "400px",
    color: "#9ca3af",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "64px",
    marginBottom: "24px",
  },
  emptyTitle: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 12px",
  },
  emptyText: {
    fontSize: "16px",
    color: "#6b7280",
    margin: "0 0 24px",
  },
  backBtn: {
    padding: "12px 24px",
    borderRadius: "8px",
    background: "#667eea",
    color: "#fff",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 500,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  backLink: {
    color: "#6b7280",
    textDecoration: "none",
    fontSize: "14px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  queueInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  queueLabel: {
    fontSize: "14px",
    color: "#6b7280",
  },
  queueCount: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
  },
  queueNav: {
    display: "flex",
    gap: "4px",
  },
  navBtn: {
    width: "32px",
    height: "32px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  content: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: "24px",
  },
  dialerPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  leadCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  leadHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  leadName: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  leadContact: {
    fontSize: "16px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  statusBadge: {
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 500,
  },
  leadDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },
  detailItem: {
    padding: "12px",
    background: "#f9fafb",
    borderRadius: "8px",
  },
  detailLabel: {
    display: "block",
    fontSize: "12px",
    color: "#9ca3af",
    marginBottom: "4px",
  },
  detailValue: {
    fontSize: "14px",
    color: "#1f2937",
  },
  phoneNumber: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#667eea",
    textDecoration: "none",
  },
  notesSection: {
    marginTop: "16px",
    padding: "12px",
    background: "#fffbeb",
    borderRadius: "8px",
  },
  notesLabel: {
    fontSize: "12px",
    color: "#92400e",
    fontWeight: 500,
  },
  notesText: {
    fontSize: "14px",
    color: "#78350f",
    margin: "4px 0 0",
  },
  callControls: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    textAlign: "center",
  },
  startCallBtn: {
    padding: "16px 48px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff",
    fontSize: "18px",
    fontWeight: 600,
    cursor: "pointer",
  },
  activeCall: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "24px",
  },
  callTimer: {
    textAlign: "center",
  },
  timerLabel: {
    display: "block",
    fontSize: "12px",
    color: "#6b7280",
  },
  timerValue: {
    fontSize: "32px",
    fontWeight: 700,
    color: "#10b981",
  },
  endCallBtn: {
    padding: "12px 32px",
    borderRadius: "8px",
    border: "none",
    background: "#dc2626",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 500,
    cursor: "pointer",
  },
  outcomeSection: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 16px",
  },
  outcomeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  outcomeBtn: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  outcomeBtnActive: {
    background: "#667eea",
    borderColor: "#667eea",
    color: "#fff",
  },
  notesInputSection: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  notesInput: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  actionButtons: {
    display: "flex",
    gap: "12px",
  },
  logBtn: {
    flex: 1,
    padding: "16px",
    borderRadius: "12px",
    border: "none",
    background: "#10b981",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  skipBtn: {
    padding: "16px 32px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "16px",
    fontWeight: 500,
    cursor: "pointer",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  scriptsCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 12px",
  },
  scriptTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "12px",
  },
  scriptTab: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "12px",
    cursor: "pointer",
  },
  scriptTabActive: {
    background: "#667eea",
    color: "#fff",
  },
  scriptContent: {
    background: "#f9fafb",
    borderRadius: "8px",
    padding: "12px",
    maxHeight: "200px",
    overflow: "auto",
  },
  scriptText: {
    fontSize: "13px",
    color: "#374151",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    margin: 0,
    fontFamily: "inherit",
  },
  activityCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  noActivity: {
    fontSize: "13px",
    color: "#9ca3af",
    textAlign: "center",
    padding: "24px",
    margin: 0,
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  activityItem: {
    padding: "10px",
    background: "#f9fafb",
    borderRadius: "8px",
  },
  activityHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  activityType: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#667eea",
  },
  activityDate: {
    fontSize: "11px",
    color: "#9ca3af",
  },
  activityOutcome: {
    fontSize: "12px",
    color: "#6b7280",
  },
  statusCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  statusSelect: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
  },
};

export default Dialer;
