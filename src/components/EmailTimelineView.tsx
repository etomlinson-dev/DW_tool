import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TrackedEmail {
  id: number;
  subject: string;
  category: string;
  category_config?: {
    label: string;
    color: string;
    icon: string;
  };
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
}

interface EmailTimelineViewProps {
  leadId: number;
  leadName?: string;
}

// Category configuration
const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  introduction: { label: 'Intro', color: '#3b82f6', icon: '👋' },
  follow_up: { label: 'Follow Up', color: '#8b5cf6', icon: '🔄' },
  meeting_date: { label: 'Meeting', color: '#f59e0b', icon: '📅' },
  contract_deal: { label: 'Contract', color: '#10b981', icon: '📄' },
  deal_closed: { label: 'Closed', color: '#22c55e', icon: '🎉' },
};

export function EmailTimelineView({ leadId, leadName }: EmailTimelineViewProps) {
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/emails/tracked/${leadId}`);
        if (response.ok) {
          const data = await response.json();
          setEmails(data);
        }
      } catch (err) {
        console.error('Failed to fetch lead emails:', err);
        setError('Failed to load email timeline');
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, [leadId]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getConfig = (category: string) => {
    return CATEGORY_CONFIG[category] || { label: category, color: '#6b7280', icon: '📧' };
  };

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <span>Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorState}>
        <span>⚠️ {error}</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>📭</span>
        <p style={styles.emptyText}>No tracked emails for this lead</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      {leadName && (
        <div style={styles.header}>
          <h3 style={styles.title}>{leadName} - Outreach Journey</h3>
        </div>
      )}

      {/* Timeline visualization */}
      <div style={styles.timeline}>
        {emails.map((email, index) => {
          const config = getConfig(email.category);
          const isLast = index === emails.length - 1;

          return (
            <motion.div
              key={email.id}
              style={styles.timelineItem}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Timeline dot and line */}
              <div style={styles.timelineLine}>
                <div style={{
                  ...styles.timelineDot,
                  background: config.color,
                }}>
                  <span style={styles.dotIcon}>{config.icon}</span>
                </div>
                {!isLast && <div style={styles.connector} />}
              </div>

              {/* Content */}
              <div style={styles.timelineContent}>
                <div style={styles.contentHeader}>
                  <span style={{ ...styles.categoryLabel, color: config.color }}>
                    {config.label}
                  </span>
                  <span style={styles.dateLabel}>{formatDate(email.sent_at)}</span>
                </div>
                <p style={styles.subject}>{email.subject}</p>
                <span style={{
                  ...styles.status,
                  color: email.clicked_at ? '#2563eb' : email.opened_at ? '#16a34a' : '#9ca3af',
                }}>
                  {email.clicked_at ? '✓ Clicked' : email.opened_at ? '✓ Opened' : '○ Sent'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar visualization */}
      <div style={styles.progressBar}>
        {['introduction', 'follow_up', 'meeting_date', 'contract_deal', 'deal_closed'].map((stage, index) => {
          const config = CATEGORY_CONFIG[stage];
          const hasEmail = emails.some(e => e.category === stage);
          
          return (
            <div key={stage} style={styles.progressStep}>
              <div style={{
                ...styles.progressDot,
                background: hasEmail ? config.color : '#e5e7eb',
              }}>
                {hasEmail && <span style={styles.progressIcon}>{config.icon}</span>}
              </div>
              {index < 4 && (
                <div style={{
                  ...styles.progressLine,
                  background: hasEmail ? config.color : '#e5e7eb',
                }} />
              )}
              <span style={{
                ...styles.progressLabel,
                color: hasEmail ? config.color : '#9ca3af',
              }}>
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
  },
  header: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
    marginBottom: '24px',
  },
  timelineItem: {
    display: 'flex',
    gap: '16px',
    position: 'relative' as const,
  },
  timelineLine: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: '32px',
  },
  timelineDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotIcon: {
    fontSize: '14px',
  },
  connector: {
    width: '2px',
    height: '40px',
    background: '#e5e7eb',
    margin: '4px 0',
  },
  timelineContent: {
    flex: 1,
    paddingBottom: '16px',
  },
  contentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  categoryLabel: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  dateLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  subject: {
    fontSize: '13px',
    color: '#374151',
    margin: '0 0 4px',
    lineHeight: 1.4,
  },
  status: {
    fontSize: '11px',
    fontWeight: 500,
  },
  progressBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderTop: '1px solid #e5e7eb',
  },
  progressStep: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    position: 'relative' as const,
    flex: 1,
  },
  progressDot: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
    zIndex: 1,
  },
  progressIcon: {
    fontSize: '12px',
  },
  progressLine: {
    position: 'absolute' as const,
    top: '14px',
    left: '50%',
    width: '100%',
    height: '2px',
    zIndex: 0,
  },
  progressLabel: {
    fontSize: '10px',
    fontWeight: 500,
    textAlign: 'center' as const,
  },
  loadingState: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#6b7280',
  },
  errorState: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#dc2626',
  },
  emptyState: {
    padding: '30px',
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#6b7280',
    margin: 0,
  },
};

export default EmailTimelineView;
