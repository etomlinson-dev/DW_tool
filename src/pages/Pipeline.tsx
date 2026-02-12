import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { PipelineStage, Lead } from '../types';

interface PipelineData {
  [key: string]: {
    stage: PipelineStage | { id: null; name: string; color: string };
    leads: Lead[];
    count: number;
    total_value: number;
  };
}

interface PipelineMetrics {
  stages: Array<{
    stage: PipelineStage;
    leads_count: number;
    total_value: number;
    avg_duration_days: number | null;
  }>;
  total_leads: number;
  won_leads: number;
  conversion_rate: number;
  total_pipeline_value: number;
}

interface Bottleneck {
  stage: PipelineStage;
  sla_days: number;
  overdue_count: number;
  leads: Lead[];
}

export function Pipeline() {
  const navigate = useNavigate();
  const [pipelineData, setPipelineData] = useState<PipelineData>({});
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch pipeline data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [stagesRes, leadsRes, metricsRes, bottlenecksRes] = await Promise.all([
        fetch('/api/pipeline/stages'),
        fetch('/api/pipeline/leads'),
        fetch('/api/pipeline/metrics'),
        fetch('/api/pipeline/bottlenecks'),
      ]);

      if (stagesRes.ok) setStages(await stagesRes.json());
      if (leadsRes.ok) setPipelineData(await leadsRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (bottlenecksRes.ok) setBottlenecks(await bottlenecksRes.json());
    } catch (err) {
      console.error('Failed to fetch pipeline data:', err);
      setError('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle drag start
  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  // Handle drop on stage
  const handleDrop = async (stageId: number | null) => {
    if (!draggedLead || draggedLead.pipeline_stage_id === stageId) {
      setDraggedLead(null);
      return;
    }

    try {
      const response = await fetch(`/api/pipeline/leads/${draggedLead.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: stageId, changed_by: 'User' }),
      });

      if (response.ok) {
        fetchData(); // Refresh pipeline data
      }
    } catch (err) {
      console.error('Failed to move lead:', err);
    }

    setDraggedLead(null);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <span style={styles.loadingSpinner}>⏳</span>
        <p>Loading pipeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorState}>
        <span style={styles.errorIcon}>⚠️</span>
        <p>{error}</p>
        <button onClick={fetchData} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  // Order stages properly
  const orderedStages = [...stages].sort((a, b) => a.order - b.order);
  const stageColumns = orderedStages.map((stage) => ({
    ...stage,
    data: pipelineData[stage.id] || { leads: [], count: 0, total_value: 0 },
  }));

  // Add unassigned column
  const unassignedData = pipelineData['unassigned'] || { leads: [], count: 0, total_value: 0 };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🎯 Pipeline</h1>
          <p style={styles.subtitle}>
            {metrics?.total_leads || 0} leads • {formatCurrency(metrics?.total_pipeline_value || 0)} pipeline value
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => setShowSettings(!showSettings)} style={styles.settingsBtn}>
            ⚙️ Settings
          </button>
          <button onClick={fetchData} style={styles.refreshBtn}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={styles.metricsBar}>
        <div style={styles.metricCard}>
          <span style={styles.metricValue}>{metrics?.total_leads || 0}</span>
          <span style={styles.metricLabel}>Total Leads</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricValue}>{metrics?.won_leads || 0}</span>
          <span style={styles.metricLabel}>Won</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricValue}>{metrics?.conversion_rate || 0}%</span>
          <span style={styles.metricLabel}>Conversion</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricValue}>{formatCurrency(metrics?.total_pipeline_value || 0)}</span>
          <span style={styles.metricLabel}>Pipeline Value</span>
        </div>
      </div>

      {/* Bottleneck Alerts */}
      {bottlenecks.length > 0 && (
        <div style={styles.bottleneckAlert}>
          <span style={styles.alertIcon}>⚠️</span>
          <span style={styles.alertText}>
            {bottlenecks.reduce((sum, b) => sum + b.overdue_count, 0)} leads are past their SLA
          </span>
          <button style={styles.alertBtn}>View Details</button>
        </div>
      )}

      {/* Pipeline Board */}
      <div style={styles.pipelineBoard}>
        {/* Unassigned Column */}
        <div
          style={styles.stageColumn}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(null)}
        >
          <div style={{ ...styles.columnHeader, borderTopColor: '#9ca3af' }}>
            <div style={styles.columnTitle}>
              <span style={styles.columnName}>Unassigned</span>
              <span style={styles.columnCount}>{unassignedData.count}</span>
            </div>
            <span style={styles.columnValue}>{formatCurrency(unassignedData.total_value)}</span>
          </div>
          <div style={styles.columnBody}>
            {unassignedData.leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onDragStart={() => handleDragStart(lead)}
                onClick={() => navigate(`/leads/${lead.id}`)}
                isDragging={draggedLead?.id === lead.id}
              />
            ))}
          </div>
        </div>

        {/* Stage Columns */}
        {stageColumns.map((stage) => (
          <div
            key={stage.id}
            style={styles.stageColumn}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage.id)}
          >
            <div style={{ ...styles.columnHeader, borderTopColor: stage.color }}>
              <div style={styles.columnTitle}>
                <span style={styles.columnName}>{stage.name}</span>
                <span style={styles.columnCount}>{stage.data.count}</span>
              </div>
              <span style={styles.columnValue}>{formatCurrency(stage.data.total_value)}</span>
            </div>
            <div style={styles.columnBody}>
              {stage.data.leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onDragStart={() => handleDragStart(lead)}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  isDragging={draggedLead?.id === lead.id}
                  isOverdue={bottlenecks.some(b => b.stage.id === stage.id && b.leads.some(l => l.id === lead.id))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <PipelineSettings
          stages={stages}
          onClose={() => setShowSettings(false)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}

// Lead Card Component
function LeadCard({ 
  lead, 
  onDragStart, 
  onClick, 
  isDragging,
  isOverdue = false,
}: { 
  lead: Lead; 
  onDragStart: () => void; 
  onClick: () => void;
  isDragging: boolean;
  isOverdue?: boolean;
}) {
  return (
    <motion.div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        ...styles.leadCard,
        opacity: isDragging ? 0.5 : 1,
        border: isOverdue ? '2px solid #ef4444' : '1px solid #e5e7eb',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div style={styles.leadHeader}>
        <span style={styles.leadName}>{lead.business_name}</span>
        {isOverdue && <span style={styles.overdueTag}>⏰</span>}
      </div>
      <div style={styles.leadContact}>{lead.contact_name || 'No contact'}</div>
      {lead.deal_value && (
        <div style={styles.leadValue}>${lead.deal_value.toLocaleString()}</div>
      )}
      <div style={styles.leadMeta}>
        <span style={styles.leadRep}>{lead.assigned_rep || 'Unassigned'}</span>
        <span style={styles.leadStatus}>{lead.status}</span>
      </div>
    </motion.div>
  );
}

// Pipeline Settings Modal
function PipelineSettings({ 
  stages, 
  onClose, 
  onUpdate 
}: { 
  stages: PipelineStage[]; 
  onClose: () => void; 
  onUpdate: () => void;
}) {
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#667eea');

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    
    try {
      const response = await fetch('/api/pipeline/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStageName, color: newStageColor }),
      });
      
      if (response.ok) {
        setNewStageName('');
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to add stage:', err);
    }
  };

  const handleDeleteStage = async (stageId: number) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;
    
    try {
      await fetch(`/api/pipeline/stages/${stageId}`, { method: 'DELETE' });
      onUpdate();
    } catch (err) {
      console.error('Failed to delete stage:', err);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <motion.div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Pipeline Settings</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        
        <div style={styles.modalBody}>
          {/* Add new stage */}
          <div style={styles.addStageSection}>
            <h3 style={styles.sectionTitle}>Add New Stage</h3>
            <div style={styles.addStageForm}>
              <input
                type="text"
                placeholder="Stage name"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                style={styles.input}
              />
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                style={styles.colorInput}
              />
              <button onClick={handleAddStage} style={styles.addBtn}>Add</button>
            </div>
          </div>

          {/* Existing stages */}
          <div style={styles.stagesSection}>
            <h3 style={styles.sectionTitle}>Current Stages</h3>
            {stages.map((stage) => (
              <div key={stage.id} style={styles.stageRow}>
                <div style={{ ...styles.stageColor, background: stage.color }} />
                <span style={styles.stageName}>{stage.name}</span>
                <span style={styles.stageOrder}>Order: {stage.order}</span>
                <button
                  onClick={() => handleDeleteStage(stage.id)}
                  style={styles.deleteBtn}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    background: '#f9fafb',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1f2937',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '4px 0 0',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  settingsBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#667eea',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  metricsBar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
  },
  metricCard: {
    flex: 1,
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    textAlign: 'center' as const,
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1f2937',
    display: 'block',
  },
  metricLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    display: 'block',
  },
  bottleneckAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#fef3c7',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  alertIcon: {
    fontSize: '18px',
  },
  alertText: {
    flex: 1,
    fontSize: '14px',
    color: '#92400e',
  },
  alertBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    background: '#f59e0b',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },
  pipelineBoard: {
    display: 'flex',
    gap: '16px',
    overflowX: 'auto' as const,
    paddingBottom: '20px',
  },
  stageColumn: {
    minWidth: '280px',
    maxWidth: '320px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  columnHeader: {
    padding: '16px',
    borderTop: '4px solid',
    borderBottom: '1px solid #e5e7eb',
  },
  columnTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  columnName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
  },
  columnCount: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    background: '#f3f4f6',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  columnValue: {
    fontSize: '12px',
    color: '#10b981',
    fontWeight: 500,
  },
  columnBody: {
    padding: '12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    minHeight: '200px',
  },
  leadCard: {
    background: '#fff',
    borderRadius: '8px',
    padding: '12px',
    cursor: 'grab',
  },
  leadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  leadName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1f2937',
  },
  overdueTag: {
    fontSize: '12px',
  },
  leadContact: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '6px',
  },
  leadValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#10b981',
    marginBottom: '8px',
  },
  leadMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#9ca3af',
  },
  leadRep: {},
  leadStatus: {
    background: '#f3f4f6',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: '#6b7280',
  },
  loadingSpinner: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: '#dc2626',
  },
  errorIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  retryBtn: {
    marginTop: '12px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#667eea',
    color: '#fff',
    cursor: 'pointer',
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    overflow: 'auto' as const,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
  },
  closeBtn: {
    fontSize: '24px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
  },
  modalBody: {
    padding: '20px',
  },
  addStageSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '12px',
  },
  addStageForm: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
  },
  colorInput: {
    width: '48px',
    height: '42px',
    padding: '2px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
  },
  addBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#10b981',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
  },
  stagesSection: {},
  stageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  stageColor: {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
  },
  stageName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
  },
  stageOrder: {
    fontSize: '12px',
    color: '#6b7280',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  },
};

export default Pipeline;
