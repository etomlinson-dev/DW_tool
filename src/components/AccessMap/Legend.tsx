import React from 'react';
import type { Client } from '../../types/network';

interface LegendProps {
  /** List of clients to display in legend */
  clients: Client[];
  /** Currently active (toggled on) client IDs */
  activeClientIds: string[];
  /** Callback when a client is toggled */
  onToggleClient?: (clientId: string) => void;
}

/**
 * Legend displays client colors and allows toggling clients on/off.
 */
export function Legend({
  clients,
  activeClientIds,
  onToggleClient,
}: LegendProps) {
  if (clients.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>Clients</h4>
      <div style={styles.clientList}>
        {clients.map((client) => {
          const isActive = activeClientIds.includes(client.id);
          return (
            <button
              key={client.id}
              style={{
                ...styles.clientItem,
                opacity: isActive ? 1 : 0.5,
                borderColor: isActive ? client.color : '#e5e7eb',
              }}
              onClick={() => onToggleClient?.(client.id)}
            >
              <span
                style={{
                  ...styles.colorDot,
                  backgroundColor: client.color,
                }}
              />
              <span style={styles.clientName}>{client.name}</span>
              {isActive && <span style={styles.checkmark}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Entity type legend */}
      <div style={styles.entityLegend}>
        <h5 style={styles.subtitle}>Entity Types</h5>
        <div style={styles.entityTypes}>
          <div style={styles.entityItem}>
            <span style={{ ...styles.entityDot, backgroundColor: '#667eea' }} />
            <span>Person</span>
          </div>
          <div style={styles.entityItem}>
            <span style={{ ...styles.entityDot, backgroundColor: '#10b981' }} />
            <span>Firm</span>
          </div>
          <div style={styles.entityItem}>
            <span style={{ ...styles.entityDot, backgroundColor: '#f59e0b' }} />
            <span>Fund</span>
          </div>
        </div>
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
    margin: '0 0 10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  clientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  clientItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: '#f9fafb',
    border: '2px solid',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: '12px',
    fontWeight: 500,
    color: '#374151',
  },
  colorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  clientName: {
    flex: 1,
  },
  checkmark: {
    fontSize: '14px',
    color: '#10b981',
    fontWeight: 700,
  },
  entityLegend: {
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #e5e7eb',
  },
  subtitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b7280',
    margin: '0 0 8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  entityTypes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  entityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: '#6b7280',
  },
  entityDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
};

export default Legend;
