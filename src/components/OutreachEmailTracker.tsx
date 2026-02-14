import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface TrackedEmail {
  id: number;
  lead_id?: number;
  lead_name?: string;
  subject: string;
  recipient_email: string;
  category: 'introduction' | 'follow_up' | 'meeting_date' | 'contract_deal' | 'deal_closed';
  category_config?: {
    label: string;
    color: string;
    icon: string;
  };
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
}

interface EmailStats {
  total: number;
  by_category: Record<string, {
    count: number;
    label: string;
    color: string;
    icon: string;
  }>;
  last_sync?: {
    last_sync_at?: string;
    emails_synced: number;
    status: string;
  };
}

// Category configuration
const CATEGORY_CONFIG = {
  introduction: { label: 'Introduction', color: '#3b82f6', icon: '👋' },
  follow_up: { label: 'Follow Up', color: '#8b5cf6', icon: '🔄' },
  meeting_date: { label: 'Meeting Date', color: '#f59e0b', icon: '📅' },
  contract_deal: { label: 'Contract Deal', color: '#10b981', icon: '📄' },
  deal_closed: { label: 'Deal Closed', color: '#22c55e', icon: '🎉' },
};

const CATEGORIES = ['all', 'introduction', 'follow_up', 'meeting_date', 'contract_deal', 'deal_closed'] as const;

export function OutreachEmailTracker() {
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [microsoftConnected, setMicrosoftConnected] = useState(false);

  // Check Microsoft connection status
  const checkMicrosoftStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/microsoft/status');
      if (response.ok) {
        const data = await response.json();
        setMicrosoftConnected(data.connected);
      }
    } catch (err) {
      console.error('Failed to check Microsoft status:', err);
    }
  }, []);

  // Fetch tracked emails
  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      const params = activeCategory !== 'all' ? `?category=${activeCategory}` : '';
      const response = await fetch(`/api/emails/tracked${params}`);
      if (response.ok) {
        const data = await response.json();
        setEmails(data);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      setError('Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  // Fetch email stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/emails/tracked/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch email stats:', err);
    }
  }, []);

  // Sync emails from Microsoft
  const syncEmails = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/emails/sync', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        alert(`Synced ${data.emails_synced} new emails`);
        fetchEmails();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to sync emails');
      }
    } catch (err) {
      console.error('Failed to sync emails:', err);
      alert('Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  };

  // Connect Microsoft account
  const connectMicrosoft = async () => {
    try {
      const response = await fetch('/api/auth/microsoft/login', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.auth_url) {
          window.location.href = data.auth_url;
        }
      }
    } catch (err) {
      console.error('Failed to initiate Microsoft login:', err);
    }
  };

  useEffect(() => {
    checkMicrosoftStatus();
    fetchStats();
  }, [checkMicrosoftStatus, fetchStats]);

  useEffect(() => {
    if (microsoftConnected) {
      fetchEmails();
    }
  }, [microsoftConnected, fetchEmails]);

  // Format relative time
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Get category config
  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || { label: category, color: '#6b7280', icon: '📧' };
  };

  // Group emails by category for display
  const groupedEmails = emails.reduce((acc, email) => {
    const cat = email.category || 'unknown';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(email);
    return acc;
  }, {} as Record<string, TrackedEmail[]>);

  if (!microsoftConnected) {
    return (
      <div style={styles.container}>
        <div style={styles.connectCard}>
          <span style={styles.connectIcon}>📧</span>
          <h2 style={styles.connectTitle}>Connect Microsoft 365</h2>
          <p style={styles.connectText}>
            Connect your Microsoft account to automatically track outreach emails
            and organize them by category.
          </p>
          <motion.button
            onClick={connectMicrosoft}
            style={styles.connectBtn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🔗 Connect Microsoft Account
          </motion.button>
        </div>
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
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📧 Outreach Emails</h2>
          {stats?.last_sync && (
            <p style={styles.syncInfo}>
              🔄 Last synced: {formatRelativeTime(stats.last_sync.last_sync_at)} • 
              {stats.total} emails tracked
            </p>
          )}
        </div>
        <motion.button
          onClick={syncEmails}
          style={styles.syncBtn}
          disabled={syncing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
        </motion.button>
      </div>

      {/* Category Tabs */}
      <div style={styles.tabs}>
        {CATEGORIES.map((cat) => {
          const config = cat === 'all' 
            ? { label: 'All', icon: '📋', color: '#6b7280' }
            : getCategoryConfig(cat);
          const count = cat === 'all' 
            ? stats?.total || 0 
            : stats?.by_category[cat]?.count || 0;
          
          return (
            <motion.button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                ...styles.tab,
                ...(activeCategory === cat ? {
                  background: config.color + '15',
                  borderColor: config.color,
                  color: config.color,
                } : {}),
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {config.icon} {config.label} ({count})
            </motion.button>
          );
        })}
      </div>

      {/* Email List */}
      {loading ? (
        <div style={styles.loadingState}>
          <span style={styles.loadingSpinner}>⏳</span>
          <p>Loading emails...</p>
        </div>
      ) : error ? (
        <div style={styles.errorState}>
          <span style={styles.errorIcon}>⚠️</span>
          <p>{error}</p>
        </div>
      ) : emails.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📭</span>
          <h3 style={styles.emptyTitle}>No emails found</h3>
          <p style={styles.emptyText}>
            {activeCategory === 'all' 
              ? 'Sync your emails to start tracking outreach'
              : `No ${getCategoryConfig(activeCategory).label} emails yet`}
          </p>
        </div>
      ) : activeCategory === 'all' ? (
        // Grouped view for "All"
        <div style={styles.groupedList}>
          {Object.entries(groupedEmails).map(([category, categoryEmails]) => {
            const config = getCategoryConfig(category);
            return (
              <div key={category} style={styles.categorySection}>
                <div style={styles.categoryHeader}>
                  <span style={{ color: config.color }}>
                    {config.icon} {config.label.toUpperCase()}
                  </span>
                  <span style={styles.categoryCount}>
                    ({categoryEmails.length} emails)
                  </span>
                </div>
                {categoryEmails.slice(0, 3).map((email) => (
                  <EmailCard key={email.id} email={email} config={config} />
                ))}
                {categoryEmails.length > 3 && (
                  <button
                    onClick={() => setActiveCategory(category)}
                    style={styles.viewMoreBtn}
                  >
                    View {categoryEmails.length - 3} more →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Flat list for specific category
        <div style={styles.emailList}>
          {emails.map((email) => (
            <EmailCard 
              key={email.id} 
              email={email} 
              config={getCategoryConfig(email.category)} 
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Email Card Component
function EmailCard({ email, config }: { email: TrackedEmail; config: { label: string; color: string; icon: string } }) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <motion.div
      style={{
        ...styles.emailCard,
        borderLeft: `3px solid ${config.color}`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      <div style={styles.emailHeader}>
        <span style={styles.emailLead}>
          {email.lead_name || email.recipient_email}
        </span>
        <span style={styles.emailDate}>{formatDate(email.sent_at)}</span>
      </div>
      <div style={styles.emailSubject}>{email.subject}</div>
      <div style={styles.emailFooter}>
        <span style={styles.emailRecipient}>
          To: {email.recipient_email}
        </span>
        <span style={{
          ...styles.emailStatus,
          color: email.opened_at ? '#16a34a' : email.clicked_at ? '#2563eb' : '#6b7280',
        }}>
          {email.clicked_at ? '✓ Clicked' : email.opened_at ? '✓ Opened' : '○ Not opened'}
        </span>
      </div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
  },
  syncInfo: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '4px 0 0',
  },
  syncBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#667eea',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  tab: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#6b7280',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  groupedList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  categorySection: {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: 600,
  },
  categoryCount: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 400,
  },
  emailList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  emailCard: {
    background: '#fff',
    borderRadius: '8px',
    padding: '14px 16px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
    marginBottom: '8px',
  },
  emailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  emailLead: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
  },
  emailDate: {
    fontSize: '12px',
    color: '#6b7280',
  },
  emailSubject: {
    fontSize: '13px',
    color: '#374151',
    marginBottom: '8px',
  },
  emailFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emailRecipient: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  emailStatus: {
    fontSize: '12px',
    fontWeight: 500,
  },
  viewMoreBtn: {
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    border: '1px dashed #e5e7eb',
    background: 'transparent',
    color: '#667eea',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  connectCard: {
    textAlign: 'center' as const,
    padding: '60px 40px',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  },
  connectIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  connectTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#1f2937',
    margin: '0 0 12px',
  },
  connectText: {
    fontSize: '14px',
    color: '#6b7280',
    maxWidth: '400px',
    margin: '0 auto 24px',
    lineHeight: 1.6,
  },
  connectBtn: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loadingState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
  },
  loadingSpinner: {
    fontSize: '32px',
    marginBottom: '12px',
    display: 'block',
  },
  errorState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#dc2626',
  },
  errorIcon: {
    fontSize: '32px',
    marginBottom: '12px',
    display: 'block',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    background: '#fff',
    borderRadius: '12px',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '12px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    margin: '0 0 8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
};

export default OutreachEmailTracker;
