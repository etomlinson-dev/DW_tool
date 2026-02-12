import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useNetworkGraph } from '../../hooks/useNetworkGraph';
import { useOverlapMetrics } from '../../hooks/useOverlapMetrics';
import type { Entity } from '../../types/network';

// ============================================
// TYPES
// ============================================
interface NodeData {
  id: string;
  name: string;
  type: Entity['type'];
  x: number;
  y: number;
  isOverlapping: boolean;
  overlapCount: number;
  clientIds: string[];
}

interface LinkData {
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isOverlapping: boolean;
  overlapCount: number;
}

// ============================================
// THEME CONFIGURATION
// ============================================
const THEME = {
  colors: {
    person: { 
      primary: '#8B5CF6', 
      secondary: '#A78BFA', 
      glow: 'rgba(139, 92, 246, 0.6)' 
    },
    firm: { 
      primary: '#10B981', 
      secondary: '#34D399', 
      glow: 'rgba(16, 185, 129, 0.6)' 
    },
    fund: { 
      primary: '#F59E0B', 
      secondary: '#FBBF24', 
      glow: 'rgba(245, 158, 11, 0.6)' 
    },
    overlap: {
      primary: '#EC4899',
      secondary: '#F472B6',
      glow: 'rgba(236, 72, 153, 0.8)'
    }
  },
  sizes: {
    person: 20,
    firm: 28,
    fund: 24,
  }
};

// ============================================
// ANIMATED BACKGROUND PARTICLES
// ============================================
const BackgroundParticles = ({ width, height }: { width: number; height: number }) => {
  const particles = useMemo(() => 
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    })), [width, height]
  );

  return (
    <g className="particles">
      {particles.map(p => (
        <motion.circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={p.size}
          fill="#fff"
          initial={{ opacity: 0.1 }}
          animate={{ 
            opacity: [0.1, 0.4, 0.1],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </g>
  );
};

// ============================================
// ANIMATED EDGE COMPONENT
// ============================================
const AnimatedEdge = ({ link, index }: { link: LinkData; index: number }) => {
  const pathLength = Math.sqrt(
    Math.pow(link.targetX - link.sourceX, 2) + 
    Math.pow(link.targetY - link.sourceY, 2)
  );

  return (
    <g>
      {/* Glow effect */}
      {link.isOverlapping && (
        <motion.line
          x1={link.sourceX}
          y1={link.sourceY}
          x2={link.targetX}
          y2={link.targetY}
          stroke={THEME.colors.overlap.glow}
          strokeWidth={6 + link.overlapCount}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      
      {/* Main line */}
      <motion.line
        x1={link.sourceX}
        y1={link.sourceY}
        x2={link.targetX}
        y2={link.targetY}
        stroke={link.isOverlapping ? THEME.colors.overlap.primary : 'rgba(148, 163, 184, 0.3)'}
        strokeWidth={link.isOverlapping ? 2 + link.overlapCount * 0.5 : 1}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: index * 0.02 }}
      />

      {/* Animated particle along edge for overlapping */}
      {link.isOverlapping && (
        <motion.circle
          r={3}
          fill={THEME.colors.overlap.secondary}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 0],
            cx: [link.sourceX, link.targetX],
            cy: [link.sourceY, link.targetY],
          }}
          transition={{
            duration: 2 + Math.random(),
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      )}
    </g>
  );
};

// ============================================
// ANIMATED NODE COMPONENT
// ============================================
const AnimatedNode = ({ 
  node, 
  isHovered, 
  isSelected, 
  onHover, 
  onClick,
  index 
}: { 
  node: NodeData; 
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (node: NodeData) => void;
  index: number;
}) => {
  const colors = node.isOverlapping ? THEME.colors.overlap : THEME.colors[node.type];
  const baseSize = THEME.sizes[node.type];
  const size = node.isOverlapping ? baseSize * (1 + node.overlapCount * 0.08) : baseSize;

  return (
    <motion.g
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node)}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 20,
        delay: 0.3 + index * 0.03 
      }}
    >
      {/* Outer glow ring for overlapping */}
      {node.isOverlapping && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={size + 15}
          fill="none"
          stroke={colors.glow}
          strokeWidth={2}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [1, 1.2, 1], 
            opacity: [0.3, 0.6, 0.3] 
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Pulsing background glow */}
      <motion.circle
        cx={node.x}
        cy={node.y}
        r={size + 8}
        fill={colors.glow}
        initial={{ opacity: 0.2 }}
        animate={{ 
          opacity: isHovered || isSelected ? 0.6 : node.isOverlapping ? 0.4 : 0.2,
          scale: isHovered ? 1.1 : 1
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Selection ring */}
      {isSelected && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={size + 6}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeDasharray="6 3"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${node.x}px ${node.y}px` }}
        />
      )}

      {/* Main node with gradient */}
      <defs>
        <radialGradient id={`gradient-${node.id}`} cx="30%" cy="30%">
          <stop offset="0%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.primary} />
        </radialGradient>
      </defs>

      <motion.circle
        cx={node.x}
        cy={node.y}
        r={size}
        fill={`url(#gradient-${node.id})`}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={2}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
      />

      {/* Type icon */}
      <text
        x={node.x}
        y={node.y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.9)"
        fontSize={size * 0.6}
        fontWeight={600}
        style={{ pointerEvents: 'none' }}
      >
        {node.type === 'person' ? '👤' : node.type === 'firm' ? '🏢' : '💰'}
      </text>

      {/* Overlap badge */}
      {node.isOverlapping && (
        <motion.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          <circle
            cx={node.x + size * 0.65}
            cy={node.y - size * 0.65}
            r={12}
            fill={THEME.colors.overlap.primary}
            stroke="#fff"
            strokeWidth={2}
          />
          <text
            x={node.x + size * 0.65}
            y={node.y - size * 0.65 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize={10}
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {node.overlapCount}
          </text>
        </motion.g>
      )}

      {/* Label with glassmorphism background */}
      <motion.g
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 + index * 0.02 }}
      >
        <rect
          x={node.x - 55}
          y={node.y + size + 8}
          width={110}
          height={22}
          rx={11}
          fill="rgba(15, 23, 42, 0.8)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
        <text
          x={node.x}
          y={node.y + size + 21}
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          fontWeight={500}
          style={{ pointerEvents: 'none' }}
        >
          {node.name.length > 14 ? node.name.slice(0, 12) + '...' : node.name}
        </text>
      </motion.g>
    </motion.g>
  );
};

// ============================================
// FLOATING METRICS CARD
// ============================================
const FloatingMetricsCard = ({ metrics, activeCount, totalCount }: { 
  metrics: { overlappingEntities: number; overlapPercentage: number; totalEntities: number };
  activeCount: number;
  totalCount: number;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.3 }}
    style={styles.floatingCard}
  >
    <div style={styles.cardHeader}>
      <span style={styles.cardIcon}>📊</span>
      <span style={styles.cardTitle}>Network Stats</span>
    </div>
    
    <div style={styles.statsGrid}>
      <motion.div 
        style={styles.statItem}
        whileHover={{ scale: 1.05 }}
      >
        <motion.span 
          style={styles.statValue}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          key={activeCount}
        >
          {activeCount}
        </motion.span>
        <span style={styles.statLabel}>Active Clients</span>
      </motion.div>
      
      <motion.div 
        style={styles.statItem}
        whileHover={{ scale: 1.05 }}
      >
        <span style={{ ...styles.statValue, color: THEME.colors.overlap.primary }}>
          {metrics.overlappingEntities}
        </span>
        <span style={styles.statLabel}>Shared</span>
      </motion.div>
      
      <motion.div 
        style={styles.statItem}
        whileHover={{ scale: 1.05 }}
      >
        <span style={{ ...styles.statValue, color: THEME.colors.firm.primary }}>
          {metrics.overlapPercentage.toFixed(0)}%
        </span>
        <span style={styles.statLabel}>Overlap</span>
      </motion.div>
      
      <motion.div 
        style={styles.statItem}
        whileHover={{ scale: 1.05 }}
      >
        <span style={{ ...styles.statValue, color: THEME.colors.fund.primary }}>
          {metrics.totalEntities}
        </span>
        <span style={styles.statLabel}>Entities</span>
      </motion.div>
    </div>
  </motion.div>
);

// ============================================
// CLIENT FILTER CHIPS
// ============================================
const ClientChips = ({ 
  clients, 
  activeClientIds, 
  onToggle, 
  onToggleAll 
}: {
  clients: Array<{ id: string; name: string; color: string }>;
  activeClientIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}
    style={styles.chipsContainer}
  >
    <motion.button
      onClick={onToggleAll}
      style={styles.toggleAllBtn}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {activeClientIds.length === clients.length ? '👁️ Hide All' : '👁️ Show All'}
    </motion.button>
    
    <div style={styles.chipsList}>
      {clients.map((client, i) => {
        const isActive = activeClientIds.includes(client.id);
        return (
          <motion.button
            key={client.id}
            onClick={() => onToggle(client.id)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            style={{
              ...styles.chip,
              background: isActive 
                ? `linear-gradient(135deg, ${client.color}40, ${client.color}20)`
                : 'rgba(255,255,255,0.05)',
              borderColor: isActive ? client.color : 'rgba(255,255,255,0.1)',
              opacity: isActive ? 1 : 0.5,
            }}
          >
            <span style={{ 
              ...styles.chipDot, 
              background: client.color,
              boxShadow: isActive ? `0 0 10px ${client.color}` : 'none'
            }} />
            <span style={styles.chipText}>{client.name}</span>
            {isActive && <span style={styles.chipCheck}>✓</span>}
          </motion.button>
        );
      })}
    </div>
  </motion.div>
);

// ============================================
// ENTITY TYPE LEGEND
// ============================================
const TypeLegend = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4 }}
    style={styles.legendContainer}
  >
    <div style={styles.legendTitle}>Entity Types</div>
    <div style={styles.legendItems}>
      {[
        { type: 'person', label: 'Person', icon: '👤' },
        { type: 'firm', label: 'Firm', icon: '🏢' },
        { type: 'fund', label: 'Fund', icon: '💰' },
      ].map((item) => (
        <div key={item.type} style={styles.legendItem}>
          <span style={{
            ...styles.legendDot,
            background: `linear-gradient(135deg, ${THEME.colors[item.type as keyof typeof THEME.colors].secondary}, ${THEME.colors[item.type as keyof typeof THEME.colors].primary})`,
          }}>
            {item.icon}
          </span>
          <span style={styles.legendLabel}>{item.label}</span>
        </div>
      ))}
      <div style={{ ...styles.legendItem, marginTop: 8 }}>
        <span style={{
          ...styles.legendDot,
          background: `linear-gradient(135deg, ${THEME.colors.overlap.secondary}, ${THEME.colors.overlap.primary})`,
        }}>
          ✨
        </span>
        <span style={styles.legendLabel}>Shared</span>
      </div>
    </div>
  </motion.div>
);

// ============================================
// SELECTED NODE DETAIL PANEL
// ============================================
const NodeDetailPanel = ({ 
  node, 
  clients, 
  onClose 
}: { 
  node: NodeData | null; 
  clients: Array<{ id: string; name: string; color: string }>;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {node && (
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25 }}
        style={styles.detailPanel}
      >
        <div style={styles.detailHeader}>
          <div style={styles.detailTitleRow}>
            <span style={styles.detailIcon}>
              {node.type === 'person' ? '👤' : node.type === 'firm' ? '🏢' : '💰'}
            </span>
            <h4 style={styles.detailTitle}>{node.name}</h4>
          </div>
          <motion.button 
            onClick={onClose} 
            style={styles.closeBtn}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            ×
          </motion.button>
        </div>
        
        <div style={styles.detailBadges}>
          <span style={{
            ...styles.typeBadge,
            background: `linear-gradient(135deg, ${THEME.colors[node.type].secondary}, ${THEME.colors[node.type].primary})`,
          }}>
            {node.type}
          </span>
          {node.isOverlapping && (
            <motion.span 
              style={styles.overlapBadge}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🔥 {node.overlapCount} clients share
            </motion.span>
          )}
        </div>

        <div style={styles.clientSection}>
          <span style={styles.clientSectionTitle}>Connected Clients</span>
          <div style={styles.clientList}>
            {node.clientIds.map(clientId => {
              const client = clients.find(c => c.id === clientId);
              return client ? (
                <motion.div 
                  key={clientId} 
                  style={styles.clientRow}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 4 }}
                >
                  <span style={{ 
                    ...styles.clientDot, 
                    background: client.color,
                    boxShadow: `0 0 8px ${client.color}`
                  }} />
                  <span style={styles.clientName}>{client.name}</span>
                </motion.div>
              ) : null;
            })}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ============================================
// MAIN COMPONENT
// ============================================
export function AccessMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 700 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // Load network data
  const { graph } = useNetworkGraph({ activeClientIds: [] });
  const [activeClientIds, setActiveClientIds] = useState<string[]>([]);

  // Initialize with all clients active
  useEffect(() => {
    if (graph.clients.length > 0 && activeClientIds.length === 0) {
      setActiveClientIds(graph.clients.map(c => c.id));
    }
  }, [graph.clients, activeClientIds.length]);

  // Get filtered data
  const { filteredEntities: entities, filteredEdges: edges } = useNetworkGraph({ activeClientIds });
  const { metrics } = useOverlapMetrics({ entities, edges, activeClientIds });

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width, 600),
          height: Math.max(rect.height, 500),
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate positions
  const { nodes, links } = useMemo(() => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const maxRadius = Math.min(dimensions.width, dimensions.height) * 0.38;

    // Build entity-to-clients map
    const entityClients = new Map<string, Set<string>>();
    edges.forEach(edge => {
      edge.clients.forEach(clientId => {
        if (!entityClients.has(edge.from)) entityClients.set(edge.from, new Set());
        if (!entityClients.has(edge.to)) entityClients.set(edge.to, new Set());
        entityClients.get(edge.from)!.add(clientId);
        entityClients.get(edge.to)!.add(clientId);
      });
    });

    // Group by type
    const firmEntities = entities.filter(e => e.type === 'firm');
    const fundEntities = entities.filter(e => e.type === 'fund');
    const personEntities = entities.filter(e => e.type === 'person');

    // Position nodes
    const positionedNodes: NodeData[] = [];
    const nodePositions = new Map<string, { x: number; y: number }>();

    const rings = [
      { entities: personEntities, radius: maxRadius * 0.35 },
      { entities: fundEntities, radius: maxRadius * 0.65 },
      { entities: firmEntities, radius: maxRadius * 0.95 },
    ];

    rings.forEach(({ entities: ringEntities, radius }) => {
      const count = ringEntities.length;
      if (count === 0) return;

      ringEntities.forEach((entity, index) => {
        const angle = (2 * Math.PI * index) / count - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        const clientSet = entityClients.get(entity.id) || new Set();
        const overlapCount = clientSet.size;

        nodePositions.set(entity.id, { x, y });
        positionedNodes.push({
          id: entity.id,
          name: entity.label || entity.id,
          type: entity.type,
          x,
          y,
          isOverlapping: overlapCount >= 2,
          overlapCount,
          clientIds: Array.from(clientSet),
        });
      });
    });

    // Create links
    const positionedLinks: LinkData[] = edges.map(edge => {
      const sourcePos = nodePositions.get(edge.from) || { x: centerX, y: centerY };
      const targetPos = nodePositions.get(edge.to) || { x: centerX, y: centerY };
      return {
        source: edge.from,
        target: edge.to,
        sourceX: sourcePos.x,
        sourceY: sourcePos.y,
        targetX: targetPos.x,
        targetY: targetPos.y,
        isOverlapping: edge.clients.length >= 2,
        overlapCount: edge.clients.length,
      };
    });

    return { nodes: positionedNodes, links: positionedLinks };
  }, [entities, edges, dimensions]);

  // Toggle handlers
  const toggleClient = useCallback((clientId: string) => {
    setActiveClientIds(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  }, []);

  const toggleAllClients = useCallback(() => {
    setActiveClientIds(prev => 
      prev.length === graph.clients.length ? [] : graph.clients.map(c => c.id)
    );
  }, [graph.clients]);

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const maxRadius = Math.min(dimensions.width, dimensions.height) * 0.38;

  return (
    <div style={styles.container}>
      {/* Gradient overlay */}
      <div style={styles.gradientOverlay} />

      {/* Header */}
      <motion.div 
        style={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={styles.headerLeft}>
          <motion.h2 
            style={styles.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span style={styles.titleIcon}>🌐</span>
            Network Access Map
          </motion.h2>
          <motion.p 
            style={styles.subtitle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Visualizing {entities.length} entities across {activeClientIds.length} clients
          </motion.p>
        </div>
      </motion.div>

      {/* Client filter chips */}
      <ClientChips
        clients={graph.clients}
        activeClientIds={activeClientIds}
        onToggle={toggleClient}
        onToggleAll={toggleAllClients}
      />

      {/* Main content */}
      <div style={styles.content}>
        {/* Left: Metrics & Legend */}
        <div style={styles.leftPanel}>
          <FloatingMetricsCard 
            metrics={metrics}
            activeCount={activeClientIds.length}
            totalCount={graph.clients.length}
          />
          <TypeLegend />
        </div>

        {/* Center: Graph */}
        <div ref={containerRef} style={styles.graphContainer}>
          <svg width={dimensions.width} height={dimensions.height} style={styles.svg}>
            {/* Background gradient */}
            <defs>
              <radialGradient id="bgGradient" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="50%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <rect width={dimensions.width} height={dimensions.height} fill="url(#bgGradient)" />

            {/* Background particles */}
            <BackgroundParticles width={dimensions.width} height={dimensions.height} />

            {/* Concentric rings */}
            {[0.35, 0.65, 0.95].map((ratio, i) => (
              <motion.circle
                key={i}
                cx={centerX}
                cy={centerY}
                r={maxRadius * ratio}
                fill="none"
                stroke="rgba(148, 163, 184, 0.15)"
                strokeWidth={1}
                strokeDasharray="8 8"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
              />
            ))}

            {/* Radial spokes */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (2 * Math.PI * i) / 12;
              return (
                <motion.line
                  key={i}
                  x1={centerX}
                  y1={centerY}
                  x2={centerX + maxRadius * Math.cos(angle)}
                  y2={centerY + maxRadius * Math.sin(angle)}
                  stroke="rgba(148, 163, 184, 0.1)"
                  strokeWidth={1}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                />
              );
            })}

            {/* Center orb */}
            <motion.circle 
              cx={centerX} 
              cy={centerY} 
              r={12}
              fill="url(#centerGradient)"
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <defs>
              <radialGradient id="centerGradient" cx="30%" cy="30%">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6366f1" />
              </radialGradient>
            </defs>

            {/* Links */}
            <g>
              {links.map((link, i) => (
                <AnimatedEdge key={`${link.source}-${link.target}`} link={link} index={i} />
              ))}
            </g>

            {/* Nodes */}
            <g>
              {nodes.map((node, i) => (
                <AnimatedNode
                  key={node.id}
                  node={node}
                  index={i}
                  isHovered={hoveredNode === node.id}
                  isSelected={selectedNode?.id === node.id}
                  onHover={setHoveredNode}
                  onClick={setSelectedNode}
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Right: Detail panel */}
        <div style={styles.rightPanel}>
          <NodeDetailPanel
            node={selectedNode}
            clients={graph.clients}
            onClose={() => setSelectedNode(null)}
          />
          
          {!selectedNode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={styles.hintPanel}
            >
              <span style={styles.hintIcon}>💡</span>
              <p style={styles.hintText}>
                Click on any node to view details and connections
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// STYLES
// ============================================
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '600px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
    borderRadius: '16px',
    overflow: 'hidden',
    position: 'relative',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '200px',
    background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.1) 0%, transparent 100%)',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px 12px',
    position: 'relative',
    zIndex: 10,
  },
  headerLeft: {},
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  titleIcon: {
    fontSize: '28px',
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: '14px',
    color: 'rgba(148, 163, 184, 0.8)',
  },
  chipsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 24px 16px',
    position: 'relative',
    zIndex: 10,
    flexWrap: 'wrap',
  },
  toggleAllBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
  },
  chipsList: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  chipDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  chipText: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#fff',
  },
  chipCheck: {
    fontSize: '12px',
    color: '#10b981',
    fontWeight: 700,
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  leftPanel: {
    width: '220px',
    minWidth: '220px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    zIndex: 10,
  },
  floatingCard: {
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
  },
  cardIcon: {
    fontSize: '18px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  statItem: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '12px 10px',
    textAlign: 'center',
    cursor: 'default',
  },
  statValue: {
    display: 'block',
    fontSize: '22px',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '10px',
    color: 'rgba(148, 163, 184, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  legendContainer: {
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  legendTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(148, 163, 184, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  legendItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  legendDot: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  legendLabel: {
    fontSize: '13px',
    color: '#fff',
    fontWeight: 500,
  },
  graphContainer: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  svg: {
    display: 'block',
  },
  rightPanel: {
    width: '260px',
    minWidth: '260px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    zIndex: 10,
  },
  detailPanel: {
    background: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '18px',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '14px',
  },
  detailTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
  },
  detailIcon: {
    fontSize: '24px',
  },
  detailTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.3,
  },
  closeBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBadges: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  typeBadge: {
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    borderRadius: '12px',
    textTransform: 'capitalize',
  },
  overlapBadge: {
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #ec4899, #f472b6)',
    borderRadius: '12px',
  },
  clientSection: {
    marginTop: '4px',
  },
  clientSectionTitle: {
    fontSize: '10px',
    color: 'rgba(148, 163, 184, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'block',
    marginBottom: '10px',
  },
  clientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  clientRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
  },
  clientDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  clientName: {
    fontSize: '13px',
    color: '#fff',
    fontWeight: 500,
  },
  hintPanel: {
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'center',
  },
  hintIcon: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '10px',
  },
  hintText: {
    margin: 0,
    fontSize: '13px',
    color: 'rgba(148, 163, 184, 0.7)',
    lineHeight: 1.5,
  },
};

export default AccessMap;
