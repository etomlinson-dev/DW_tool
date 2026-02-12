import React from 'react';
import type { OverlapMetrics } from '../../types/network';

interface MetricsPanelProps {
  /** Calculated overlap metrics */
  metrics: OverlapMetrics;
  /** Whether metrics are currently loading */
  loading?: boolean;
}

/**
 * MetricsPanel displays real-time network overlap statistics.
 */
export function MetricsPanel({
  metrics,
  loading = false,
}: MetricsPanelProps) {
  if (loading || !metrics) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Calculating metrics...</div>
      </div>
    );
  }

  const formatDelta = (delta: number): string => {
    if (delta === 0) return '0';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}`;
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>Network Metrics</h4>
      
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricValue}>{metrics.totalEntities}</span>
          <span style={styles.metricLabel}>Total Entities</span>
        </div>
        
        <div style={styles.metricCard}>
          <span style={styles.metricValue}>{metrics.uniqueEntities}</span>
          <span style={styles.metricLabel}>Unique Entities</span>
        </div>
        
        <div style={styles.metricCard}>
          <span style={{ ...styles.metricValue, color: '#667eea' }}>
            {metrics.overlappingEntities}
          </span>
          <span style={styles.metricLabel}>Overlapping</span>
        </div>
        
        <div style={styles.metricCard}>
          <span style={{ ...styles.metricValue, color: '#10b981' }}>
            {metrics.overlapPercentage.toFixed(1)}%
          </span>
          <span style={styles.metricLabel}>Overlap Rate</span>
        </div>
      </div>

      {/* Network growth indicator */}
      <div style={styles.growthSection}>
        <span style={styles.growthLabel}>Network Growth</span>
        <span
          style={{
            ...styles.growthValue,
            color: metrics.networkGrowthDelta >= 0 ? '#10b981' : '#ef4444',
          }}
        >
          {formatDelta(metrics.networkGrowthDelta)}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff',
    borderRadius: '10px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#374151',
    margin: '0 0 12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '12px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  metricCard: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center',
  },
  metricValue: {
    display: 'block',
    fontSize: '20px',
    fontWeight: 700,
    color: '#1f2937',
  },
  metricLabel: {
    fontSize: '10px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  growthSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e5e7eb',
  },
  growthLabel: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: 500,
  },
  growthValue: {
    fontSize: '16px',
    fontWeight: 700,
  },
};

export default MetricsPanel;
