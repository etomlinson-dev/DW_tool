import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Prospect, Warmth } from '../types/kyi';
import { WARMTH_LABELS, WARMTH_COLORS } from '../types/kyi';
import type { InvestorListItem } from '../api/kyiClient';

interface ConnectionsPanelProps {
  investor: InvestorListItem;
  investors: InvestorListItem[];
  prospects: Prospect[];
}

interface Connection {
  id: string;
  type: 'prospect' | 'investor';
  name: string;
  email: string | null;
  firm: string | null;
  warmth: Warmth | null;
  stage?: string;
  connectionType: 'firm' | 'warm' | 'trusted' | 'network';
  strength: number;
}

const ITEMS_PER_PAGE = 10;

/**
 * ConnectionsPanel - Scalable design for handling 100+ connections
 * Features stats overview, featured connections, and paginated list
 */
export function ConnectionsPanel({ investor, investors, prospects }: ConnectionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'trusted' | 'warm' | 'firm' | 'network'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Generate sample connections (simulating 100+ connections)
  const sampleConnections: Connection[] = useMemo(() => {
    const names = [
      'Jennifer Martinez', 'Robert Chen', 'Sarah Thompson', 'David Kim', 'Emily Watson',
      'Marcus Johnson', 'Lisa Anderson', 'Alex Rivera', 'Chris Taylor', 'Diana Park',
      'Michael Brown', 'Jessica Lee', 'Andrew Wilson', 'Rachel Green', 'James Miller',
      'Amanda Davis', 'Kevin Moore', 'Sophia Clark', 'Daniel Lewis', 'Olivia White',
      'Matthew Hall', 'Emma Young', 'Joshua King', 'Isabella Wright', 'Ethan Scott',
    ];
    const firms = [
      investor.firmName || 'Tech Ventures', 'Innovate Partners', 'Growth Equity LLC',
      'Nexus Fund', 'Seed Ventures', 'Alpha Capital', 'Beta Investments', 'Gamma Holdings',
    ];
    const types: Connection['connectionType'][] = ['trusted', 'warm', 'firm', 'network'];
    
    return names.map((name, i) => {
      const connectionType = types[i % 4];
      return {
        id: `sample-${i}`,
        type: i % 3 === 0 ? 'investor' : 'prospect',
        name,
        email: `${name.toLowerCase().replace(' ', '.')}@${firms[i % firms.length].toLowerCase().replace(/\s+/g, '')}.com`,
        firm: firms[i % firms.length],
        warmth: connectionType === 'trusted' ? 'trusted' : connectionType === 'warm' ? 'warm' : 'cold',
        connectionType,
        strength: connectionType === 'trusted' ? 5 : connectionType === 'warm' ? 4 : connectionType === 'firm' ? 3 : 2,
      };
    });
  }, [investor.firmName]);

  // Build real connections or use samples
  const allConnections = useMemo(() => {
    const results: Connection[] = [];

    prospects.forEach(prospect => {
      let connectionType: Connection['connectionType'] = 'network';
      let strength = 2;
      if (prospect.warmth === 'trusted') { connectionType = 'trusted'; strength = 5; }
      else if (prospect.warmth === 'warm') { connectionType = 'warm'; strength = 4; }
      else if (investor.firmName && prospect.firmName?.toLowerCase() === investor.firmName.toLowerCase()) {
        connectionType = 'firm'; strength = 3;
      }

      results.push({
        id: `prospect-${prospect.id}`,
        type: 'prospect',
        name: prospect.name,
        email: prospect.email,
        firm: prospect.firmName,
        warmth: prospect.warmth,
        stage: prospect.stage,
        connectionType,
        strength,
      });
    });

    investors.forEach(inv => {
      if (inv.id === investor.id) return;
      let connectionType: Connection['connectionType'] = 'network';
      let strength = 2;
      if (inv.warmth === 'trusted') { connectionType = 'trusted'; strength = 5; }
      else if (inv.warmth === 'warm') { connectionType = 'warm'; strength = 4; }
      else if (investor.firmName && inv.firmName?.toLowerCase() === investor.firmName.toLowerCase()) {
        connectionType = 'firm'; strength = 3;
      }

      results.push({
        id: `investor-${inv.id}`,
        type: 'investor',
        name: inv.legalName,
        email: inv.email,
        firm: inv.firmName,
        warmth: inv.warmth,
        connectionType,
        strength,
      });
    });

    return results.length > 0 ? results : sampleConnections;
  }, [investor, investors, prospects, sampleConnections]);

  // Stats
  const stats = useMemo(() => ({
    total: allConnections.length,
    trusted: allConnections.filter(c => c.connectionType === 'trusted').length,
    warm: allConnections.filter(c => c.connectionType === 'warm').length,
    firm: allConnections.filter(c => c.connectionType === 'firm').length,
    network: allConnections.filter(c => c.connectionType === 'network').length,
  }), [allConnections]);

  // Featured connections (top 6 by strength)
  const featuredConnections = useMemo(() => 
    [...allConnections].sort((a, b) => b.strength - a.strength).slice(0, 6),
  [allConnections]);

  // Filtered and searched connections
  const filteredConnections = useMemo(() => {
    let filtered = allConnections;
    
    if (activeFilter !== 'all') {
      filtered = filtered.filter(c => c.connectionType === activeFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.firm?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => b.strength - a.strength);
  }, [allConnections, activeFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredConnections.length / ITEMS_PER_PAGE);
  const paginatedConnections = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredConnections.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredConnections, currentPage]);

  // Reset page when filter changes
  const handleFilterChange = (filter: typeof activeFilter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const getTypeColor = (type: Connection['connectionType']) => {
    switch (type) {
      case 'trusted': return { bg: '#dcfce7', text: '#166534', accent: '#10b981' };
      case 'warm': return { bg: '#fef3c7', text: '#92400e', accent: '#f59e0b' };
      case 'firm': return { bg: '#dbeafe', text: '#1e40af', accent: '#3b82f6' };
      default: return { bg: '#f3f4f6', text: '#4b5563', accent: '#6b7280' };
    }
  };

  const getTypeIcon = (type: Connection['connectionType']) => {
    switch (type) {
      case 'trusted': return '⭐';
      case 'warm': return '🔥';
      case 'firm': return '🏢';
      default: return '📋';
    }
  };

  return (
    <div style={styles.container}>
      {/* Stats Overview */}
      <div style={styles.statsRow}>
        {[
          { key: 'all', label: 'Total', count: stats.total, color: '#667eea', icon: '👥' },
          { key: 'trusted', label: 'Trusted', count: stats.trusted, color: '#10b981', icon: '⭐' },
          { key: 'warm', label: 'Warm', count: stats.warm, color: '#f59e0b', icon: '🔥' },
          { key: 'firm', label: 'Same Firm', count: stats.firm, color: '#3b82f6', icon: '🏢' },
          { key: 'network', label: 'Network', count: stats.network, color: '#6b7280', icon: '📋' },
        ].map((stat) => (
          <motion.div
            key={stat.key}
            onClick={() => handleFilterChange(stat.key as typeof activeFilter)}
            style={{
              ...styles.statCard,
              ...(activeFilter === stat.key ? {
                borderColor: stat.color,
                boxShadow: `0 0 0 2px ${stat.color}20`,
              } : {}),
            }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <span style={styles.statIcon}>{stat.icon}</span>
            <span style={{ ...styles.statCount, color: stat.color }}>{stat.count}</span>
            <span style={styles.statLabel}>{stat.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Featured Connections */}
      {activeFilter === 'all' && !searchQuery && (
        <div style={styles.featuredSection}>
          <h3 style={styles.sectionTitle}>⭐ Top Connections</h3>
          <div style={styles.featuredGrid}>
            {featuredConnections.map((conn, i) => {
              const colors = getTypeColor(conn.connectionType);
              return (
                <motion.div
                  key={conn.id}
                  style={styles.featuredCard}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.12)' }}
                >
                  <div style={{ ...styles.featuredAccent, background: colors.accent }} />
                  <div style={styles.featuredContent}>
                    <div style={{
                      ...styles.featuredAvatar,
                      background: conn.type === 'investor'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    }}>
                      {conn.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={styles.featuredInfo}>
                      <span style={styles.featuredName}>{conn.name}</span>
                      <span style={styles.featuredFirm}>{conn.firm}</span>
                    </div>
                    <span style={{ ...styles.featuredBadge, background: colors.bg, color: colors.text }}>
                      {getTypeIcon(conn.connectionType)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search and List Section */}
      <div style={styles.listSection}>
        <div style={styles.listHeader}>
          <h3 style={styles.sectionTitle}>
            {activeFilter === 'all' ? 'All Connections' : 
             `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Connections`}
            <span style={styles.countBadge}>{filteredConnections.length}</span>
          </h3>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search by name, firm, or email..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={styles.clearBtn}>✕</button>
            )}
          </div>
        </div>

        {/* Connection List */}
        <div style={styles.listContainer}>
          <AnimatePresence mode="popLayout">
            {paginatedConnections.map((conn, i) => {
              const colors = getTypeColor(conn.connectionType);
              const isExpanded = expandedId === conn.id;
              
              return (
                <motion.div
                  key={conn.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.02 }}
                  style={{
                    ...styles.listItem,
                    ...(isExpanded ? { background: '#f8fafc' } : {}),
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : conn.id)}
                >
                  <div style={styles.listItemMain}>
                    {/* Type indicator */}
                    <div style={{ ...styles.typeIndicator, background: colors.accent }} />
                    
                    {/* Avatar */}
                    <div style={{
                      ...styles.listAvatar,
                      background: conn.type === 'investor'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    }}>
                      {conn.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>

                    {/* Info */}
                    <div style={styles.listInfo}>
                      <span style={styles.listName}>{conn.name}</span>
                      <span style={styles.listFirm}>{conn.firm || 'No firm'}</span>
                    </div>

                    {/* Badges */}
                    <div style={styles.listBadges}>
                      <span style={{
                        ...styles.typeBadge,
                        background: conn.type === 'investor' ? '#eef2ff' : '#ecfdf5',
                        color: conn.type === 'investor' ? '#667eea' : '#059669',
                      }}>
                        {conn.type === 'investor' ? '💼' : '🎯'}
                      </span>
                      <span style={{ ...styles.typeBadge, background: colors.bg, color: colors.text }}>
                        {getTypeIcon(conn.connectionType)} {conn.connectionType}
                      </span>
                    </div>

                    {/* Strength */}
                    <div style={styles.strengthContainer}>
                      {[1, 2, 3, 4, 5].map(level => (
                        <div
                          key={level}
                          style={{
                            ...styles.strengthDot,
                            background: level <= conn.strength ? colors.accent : '#e5e7eb',
                          }}
                        />
                      ))}
                    </div>

                    {/* Expand arrow */}
                    <motion.span
                      style={styles.expandArrow}
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                    >
                      ▼
                    </motion.span>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={styles.expandedContent}
                      >
                        <div style={styles.expandedGrid}>
                          <div style={styles.expandedItem}>
                            <span style={styles.expandedLabel}>Email</span>
                            <span style={styles.expandedValue}>{conn.email || 'Not available'}</span>
                          </div>
                          {conn.warmth && (
                            <div style={styles.expandedItem}>
                              <span style={styles.expandedLabel}>Warmth</span>
                              <span style={{
                                ...styles.warmthBadge,
                                background: WARMTH_COLORS[conn.warmth].bg,
                                color: WARMTH_COLORS[conn.warmth].text,
                              }}>
                                {WARMTH_LABELS[conn.warmth]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div style={styles.expandedActions}>
                          <button style={styles.actionBtn}>📧 Email</button>
                          <button style={styles.actionBtn}>📝 Add Note</button>
                          <button style={{ ...styles.actionBtn, ...styles.primaryBtn }}>View Profile →</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredConnections.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>🔍</span>
              <span style={styles.emptyText}>No connections found</span>
              <span style={styles.emptySubtext}>Try adjusting your search or filter</span>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ ...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {}) }}
            >
              ← Prev
            </button>
            
            <div style={styles.pageNumbers}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      ...styles.pageNum,
                      ...(currentPage === pageNum ? styles.pageNumActive : {}),
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ ...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {}) }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#f8fafc',
    borderRadius: '16px',
    overflow: 'hidden',
    padding: '16px',
    gap: '16px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
    flexShrink: 0,
  },
  statCard: {
    background: '#fff',
    borderRadius: '10px',
    padding: '12px 8px',
    textAlign: 'center',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  statIcon: {
    display: 'block',
    fontSize: '20px',
    marginBottom: '4px',
  },
  statCount: {
    display: 'block',
    fontSize: '24px',
    fontWeight: 700,
  },
  statLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
  },
  featuredSection: {
    background: '#fff',
    borderRadius: '10px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    flexShrink: 0,
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  countBadge: {
    background: '#f3f4f6',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#6b7280',
  },
  featuredGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '10px',
  },
  featuredCard: {
    position: 'relative',
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  featuredAccent: {
    height: '2px',
  },
  featuredContent: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    gap: '8px',
  },
  featuredAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    flexShrink: 0,
  },
  featuredInfo: {
    flex: 1,
    minWidth: 0,
  },
  featuredName: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#1f2937',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  featuredFirm: {
    display: 'block',
    fontSize: '10px',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  featuredBadge: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    flexShrink: 0,
  },
  listSection: {
    flex: 1,
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    minHeight: 0,
    overflow: 'hidden',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '16px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#f9fafb',
    borderRadius: '10px',
    padding: '8px 12px',
    gap: '8px',
    flex: 1,
    maxWidth: '320px',
    border: '1px solid #e5e7eb',
  },
  searchIcon: {
    fontSize: '14px',
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '13px',
    outline: 'none',
    color: '#374151',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    fontSize: '12px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minHeight: 0,
  },
  listItem: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  listItemMain: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    gap: '10px',
    minHeight: '56px',
  },
  typeIndicator: {
    width: '4px',
    height: '36px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  listAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
  },
  listInfo: {
    flex: 1,
    minWidth: 0,
  },
  listName: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
  },
  listFirm: {
    display: 'block',
    fontSize: '12px',
    color: '#6b7280',
  },
  listBadges: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  typeBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  strengthContainer: {
    display: 'flex',
    gap: '3px',
    flexShrink: 0,
  },
  strengthDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  expandArrow: {
    fontSize: '10px',
    color: '#9ca3af',
    flexShrink: 0,
  },
  expandedContent: {
    padding: '0 12px 12px 64px',
    overflow: 'hidden',
  },
  expandedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '12px',
  },
  expandedItem: {},
  expandedLabel: {
    display: 'block',
    fontSize: '10px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '2px',
  },
  expandedValue: {
    fontSize: '13px',
    color: '#374151',
  },
  warmthBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
  },
  expandedActions: {
    display: 'flex',
    gap: '8px',
  },
  actionBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f3f4f6',
  },
  pageBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  pageBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  pageNumbers: {
    display: 'flex',
    gap: '4px',
  },
  pageNum: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumActive: {
    background: '#667eea',
    color: '#fff',
    borderColor: '#667eea',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  emptyText: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#374151',
  },
  emptySubtext: {
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '4px',
  },
};

export default ConnectionsPanel;
