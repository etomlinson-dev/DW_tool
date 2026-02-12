import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Prospect, ProspectStage, Warmth } from '../types/kyi';
import { STAGE_LABELS, WARMTH_LABELS, WARMTH_COLORS } from '../types/kyi';
import type { InvestorListItem } from '../api/kyiClient';

interface PipelineNodeData {
  id: string;
  name: string;
  type: 'investor' | 'prospect';
  stage?: ProspectStage;
  warmth?: Warmth | null;
  firmName?: string | null;
  email?: string | null;
  x: number;
  y: number;
}

interface PipelineLinkData {
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  type: 'firm' | 'warmth';
}

// Colors for different node types
const NODE_COLORS = {
  investor: { fill: '#7c3aed', stroke: '#5b21b6' },
  discovered: { fill: '#6b7280', stroke: '#4b5563' },
  outreached: { fill: '#3b82f6', stroke: '#1d4ed8' },
  connected: { fill: '#10b981', stroke: '#047857' },
  interested: { fill: '#f59e0b', stroke: '#d97706' },
};

const NODE_SIZE = 28;
const MIN_SPACING = 100; // Minimum spacing between nodes

interface PipelineAccessMapProps {
  investors: InvestorListItem[];
  prospects: Prospect[];
}

/**
 * PipelineAccessMap - Zoomable/pannable network visualization
 */
export function PipelineAccessMap({ investors, prospects }: PipelineAccessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<PipelineNodeData | null>(null);
  const [showInvestors, setShowInvestors] = useState(true);
  const [showProspects, setShowProspects] = useState(true);
  const [selectedStage, setSelectedStage] = useState<ProspectStage | 'all'>('all');

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: Math.max(rect.width, 400),
          height: Math.max(rect.height, 300),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate canvas size based on number of nodes
  const canvasSize = useMemo(() => {
    const totalNodes = investors.length + prospects.filter(p => p.stage !== 'investor').length;
    const baseSize = Math.max(1500, Math.sqrt(totalNodes) * MIN_SPACING * 2);
    return { width: baseSize, height: baseSize };
  }, [investors.length, prospects]);

  // Calculate node positions using a spread-out grid layout
  const { nodes, links, metrics } = useMemo(() => {
    const positionedNodes: PipelineNodeData[] = [];
    const nodePositions = new Map<string, { x: number; y: number }>();
    const positionedLinks: PipelineLinkData[] = [];

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    // Filter prospects by stage
    const filteredProspects = selectedStage === 'all' 
      ? prospects.filter(p => p.stage !== 'investor') 
      : prospects.filter(p => p.stage === selectedStage);

    // Organize by stage for positioning
    const stages: ProspectStage[] = ['discovered', 'outreached', 'connected', 'interested'];
    const prospectsByStage = new Map<ProspectStage, Prospect[]>();
    stages.forEach(stage => prospectsByStage.set(stage, []));
    filteredProspects.forEach(p => {
      if (prospectsByStage.has(p.stage)) {
        prospectsByStage.get(p.stage)!.push(p);
      }
    });

    // Position investors in center cluster
    if (showInvestors && investors.length > 0) {
      const invCount = investors.length;
      const invRadius = Math.max(150, invCount * 40);
      
      investors.forEach((inv, index) => {
        const angle = (2 * Math.PI * index) / invCount - Math.PI / 2;
        const x = centerX + invRadius * Math.cos(angle);
        const y = centerY + invRadius * Math.sin(angle);

        const nodeId = `inv-${inv.id}`;
        nodePositions.set(nodeId, { x, y });
        positionedNodes.push({
          id: nodeId,
          name: inv.legalName,
          type: 'investor',
          warmth: inv.warmth,
          firmName: inv.firmName,
          email: inv.email,
          x,
          y,
        });
      });
    }

    // Position prospects in quadrants by stage with good spacing
    if (showProspects) {
      const quadrants = [
        { stage: 'discovered' as ProspectStage, offsetX: -1, offsetY: -1 },  // Top-left
        { stage: 'outreached' as ProspectStage, offsetX: 1, offsetY: -1 },   // Top-right
        { stage: 'connected' as ProspectStage, offsetX: -1, offsetY: 1 },    // Bottom-left
        { stage: 'interested' as ProspectStage, offsetX: 1, offsetY: 1 },    // Bottom-right
      ];

      quadrants.forEach(({ stage, offsetX, offsetY }) => {
        const stageProspects = prospectsByStage.get(stage) || [];
        if (stageProspects.length === 0) return;

        // Calculate grid for this quadrant
        const cols = Math.ceil(Math.sqrt(stageProspects.length));
        const rows = Math.ceil(stageProspects.length / cols);
        
        // Quadrant center
        const quadrantCenterX = centerX + offsetX * (canvasSize.width * 0.25);
        const quadrantCenterY = centerY + offsetY * (canvasSize.height * 0.25);
        
        // Grid starting position
        const gridWidth = cols * MIN_SPACING;
        const gridHeight = rows * MIN_SPACING;
        const startX = quadrantCenterX - gridWidth / 2;
        const startY = quadrantCenterY - gridHeight / 2;

        stageProspects.forEach((prospect, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          // Add some randomness to avoid perfect grid
          const jitterX = (Math.random() - 0.5) * 30;
          const jitterY = (Math.random() - 0.5) * 30;
          
          const x = startX + col * MIN_SPACING + MIN_SPACING / 2 + jitterX;
          const y = startY + row * MIN_SPACING + MIN_SPACING / 2 + jitterY;

          const nodeId = `prospect-${prospect.id}`;
          nodePositions.set(nodeId, { x, y });
          positionedNodes.push({
            id: nodeId,
            name: prospect.name,
            type: 'prospect',
            stage: prospect.stage,
            warmth: prospect.warmth,
            firmName: prospect.firmName,
            email: prospect.email,
            x,
            y,
          });
        });
      });
    }

    // Create links based on shared firm names
    const firmGroups = new Map<string, string[]>();
    positionedNodes.forEach(node => {
      if (node.firmName) {
        const firmKey = node.firmName.toLowerCase().trim();
        if (!firmGroups.has(firmKey)) {
          firmGroups.set(firmKey, []);
        }
        firmGroups.get(firmKey)!.push(node.id);
      }
    });

    // Connect nodes in the same firm
    firmGroups.forEach((nodeIds) => {
      if (nodeIds.length >= 2) {
        for (let i = 0; i < nodeIds.length - 1; i++) {
          const sourcePos = nodePositions.get(nodeIds[i]);
          const targetPos = nodePositions.get(nodeIds[i + 1]);
          if (sourcePos && targetPos) {
            positionedLinks.push({
              source: nodeIds[i],
              target: nodeIds[i + 1],
              sourceX: sourcePos.x,
              sourceY: sourcePos.y,
              targetX: targetPos.x,
              targetY: targetPos.y,
              type: 'firm',
            });
          }
        }
      }
    });

    // Connect investors to warm/trusted prospects
    if (showInvestors && showProspects) {
      investors.forEach(inv => {
        const invNodeId = `inv-${inv.id}`;
        const invPos = nodePositions.get(invNodeId);
        if (!invPos) return;

        filteredProspects.forEach(prospect => {
          const prospectNodeId = `prospect-${prospect.id}`;
          const prospectPos = nodePositions.get(prospectNodeId);
          if (!prospectPos) return;

          const sameFirm = inv.firmName && prospect.firmName && 
            inv.firmName.toLowerCase() === prospect.firmName.toLowerCase();
          const isWarm = prospect.warmth === 'warm' || prospect.warmth === 'trusted';

          if (sameFirm || isWarm) {
            positionedLinks.push({
              source: invNodeId,
              target: prospectNodeId,
              sourceX: invPos.x,
              sourceY: invPos.y,
              targetX: prospectPos.x,
              targetY: prospectPos.y,
              type: sameFirm ? 'firm' : 'warmth',
            });
          }
        });
      });
    }

    const connectedNodes = new Set<string>();
    positionedLinks.forEach(link => {
      connectedNodes.add(link.source);
      connectedNodes.add(link.target);
    });

    return {
      nodes: positionedNodes,
      links: positionedLinks,
      metrics: {
        totalNodes: positionedNodes.length,
        totalInvestors: showInvestors ? investors.length : 0,
        totalProspects: showProspects ? filteredProspects.length : 0,
        connections: positionedLinks.length,
        connectedNodes: connectedNodes.size,
      },
    };
  }, [investors, prospects, canvasSize, showInvestors, showProspects, selectedStage]);

  // Center view on load
  useEffect(() => {
    const initialZoom = Math.min(
      containerSize.width / canvasSize.width,
      containerSize.height / canvasSize.height
    ) * 0.8;
    setZoom(Math.max(0.3, Math.min(initialZoom, 1)));
    setPan({
      x: (containerSize.width - canvasSize.width * initialZoom) / 2,
      y: (containerSize.height - canvasSize.height * initialZoom) / 2,
    });
  }, [containerSize, canvasSize]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z * 1.3, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z / 1.3, 0.2));
  }, []);

  const handleZoomReset = useCallback(() => {
    const fitZoom = Math.min(
      containerSize.width / canvasSize.width,
      containerSize.height / canvasSize.height
    ) * 0.8;
    setZoom(Math.max(0.3, Math.min(fitZoom, 1)));
    setPan({
      x: (containerSize.width - canvasSize.width * fitZoom) / 2,
      y: (containerSize.height - canvasSize.height * fitZoom) / 2,
    });
  }, [containerSize, canvasSize]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(z * delta, 3)));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Pipeline Network Map</h2>
          <p style={styles.subtitle}>
            {metrics.totalNodes} entities | {metrics.connections} connections | Scroll to zoom, drag to pan
          </p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.zoomControls}>
            <button onClick={handleZoomOut} style={styles.zoomBtn}>−</button>
            <span style={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} style={styles.zoomBtn}>+</button>
            <button onClick={handleZoomReset} style={styles.resetBtn}>Fit</button>
          </div>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value as ProspectStage | 'all')}
            style={styles.select}
          >
            <option value="all">All Stages</option>
            <option value="discovered">Discovered</option>
            <option value="outreached">Outreached</option>
            <option value="connected">Connected</option>
            <option value="interested">Interested</option>
          </select>
        </div>
      </div>

      {/* Main content */}
      <div style={styles.content}>
        {/* Left panel */}
        <div style={styles.leftPanel}>
          <div style={styles.filterSection}>
            <h4 style={styles.filterTitle}>Show/Hide</h4>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showInvestors}
                onChange={(e) => setShowInvestors(e.target.checked)}
              />
              Investors ({investors.length})
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showProspects}
                onChange={(e) => setShowProspects(e.target.checked)}
              />
              Prospects ({prospects.filter(p => p.stage !== 'investor').length})
            </label>
          </div>

          <div style={styles.legendSection}>
            <h4 style={styles.filterTitle}>Legend</h4>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: NODE_COLORS.investor.fill }} />
              Investors (center)
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: NODE_COLORS.discovered.fill }} />
              Discovered (top-left)
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: NODE_COLORS.outreached.fill }} />
              Outreached (top-right)
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: NODE_COLORS.connected.fill }} />
              Connected (bottom-left)
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: NODE_COLORS.interested.fill }} />
              Interested (bottom-right)
            </div>
            <div style={{ ...styles.legendItem, marginTop: 8 }}>
              <span style={{ ...styles.legendLine, background: '#6366f1' }} />
              Same firm
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendLine, background: '#10b981', borderStyle: 'dashed' }} />
              Warm relationship
            </div>
          </div>
        </div>

        {/* Graph container */}
        <div 
          ref={containerRef} 
          style={styles.graphContainer}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg 
            ref={svgRef}
            width={containerSize.width} 
            height={containerSize.height} 
            style={{ ...styles.svg, cursor: isPanning ? 'grabbing' : 'grab' }}
          >
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Background with grid */}
            <rect width={containerSize.width} height={containerSize.height} fill="#f8fafc" />

            {/* Transformed group for zoom/pan */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Grid background */}
              <rect 
                x={0} 
                y={0} 
                width={canvasSize.width} 
                height={canvasSize.height} 
                fill="url(#grid)" 
              />

              {/* Stage labels in quadrants */}
              <text x={canvasSize.width * 0.25} y={80} textAnchor="middle" fontSize={16} fill="#9ca3af" fontWeight={600}>
                DISCOVERED
              </text>
              <text x={canvasSize.width * 0.75} y={80} textAnchor="middle" fontSize={16} fill="#9ca3af" fontWeight={600}>
                OUTREACHED
              </text>
              <text x={canvasSize.width * 0.25} y={canvasSize.height - 60} textAnchor="middle" fontSize={16} fill="#9ca3af" fontWeight={600}>
                CONNECTED
              </text>
              <text x={canvasSize.width * 0.75} y={canvasSize.height - 60} textAnchor="middle" fontSize={16} fill="#9ca3af" fontWeight={600}>
                INTERESTED
              </text>
              <text x={canvasSize.width / 2} y={canvasSize.height / 2 - 180} textAnchor="middle" fontSize={18} fill="#7c3aed" fontWeight={700}>
                INVESTORS
              </text>

              {/* Links */}
              <g>
                {links.map((link, i) => (
                  <line
                    key={i}
                    x1={link.sourceX}
                    y1={link.sourceY}
                    x2={link.targetX}
                    y2={link.targetY}
                    stroke={link.type === 'firm' ? '#6366f1' : '#10b981'}
                    strokeWidth={2}
                    opacity={0.5}
                    strokeDasharray={link.type === 'warmth' ? '8 4' : undefined}
                  />
                ))}
              </g>

              {/* Nodes */}
              <g>
                {nodes.map(node => {
                  const isInvestor = node.type === 'investor';
                  const colors = isInvestor 
                    ? NODE_COLORS.investor 
                    : NODE_COLORS[node.stage as keyof typeof NODE_COLORS] || NODE_COLORS.discovered;
                  const size = isInvestor ? NODE_SIZE * 1.3 : NODE_SIZE;
                  const isHovered = hoveredNode === node.id;
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
                    >
                      {/* Selection/hover ring */}
                      {(isSelected || isHovered) && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={size + 6}
                          fill="none"
                          stroke={isSelected ? '#667eea' : '#94a3b8'}
                          strokeWidth={3}
                        />
                      )}

                      {/* Node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={size}
                        fill={colors.fill}
                        stroke="#fff"
                        strokeWidth={3}
                      />

                      {/* Warmth badge */}
                      {node.warmth && (
                        <circle
                          cx={node.x + size * 0.7}
                          cy={node.y - size * 0.7}
                          r={10}
                          fill={WARMTH_COLORS[node.warmth].bg}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      )}

                      {/* Initials */}
                      <text
                        x={node.x}
                        y={node.y + 5}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={isInvestor ? 14 : 12}
                        fontWeight={600}
                      >
                        {node.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </text>

                      {/* Name label below node */}
                      <text
                        x={node.x}
                        y={node.y + size + 18}
                        textAnchor="middle"
                        fill="#374151"
                        fontSize={11}
                        fontWeight={500}
                      >
                        {node.name.length > 18 ? node.name.slice(0, 16) + '...' : node.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>

        {/* Right panel */}
        <div style={styles.rightPanel}>
          <div style={styles.metricsPanel}>
            <h4 style={styles.metricsTitle}>Metrics</h4>
            <div style={styles.metricRow}>
              <span style={styles.metricLabel}>Total Nodes</span>
              <span style={styles.metricValue}>{metrics.totalNodes}</span>
            </div>
            <div style={styles.metricRow}>
              <span style={styles.metricLabel}>Investors</span>
              <span style={styles.metricValue}>{metrics.totalInvestors}</span>
            </div>
            <div style={styles.metricRow}>
              <span style={styles.metricLabel}>Prospects</span>
              <span style={styles.metricValue}>{metrics.totalProspects}</span>
            </div>
            <div style={styles.metricRow}>
              <span style={styles.metricLabel}>Connections</span>
              <span style={styles.metricValue}>{metrics.connections}</span>
            </div>
          </div>

          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={styles.selectedPanel}
              >
                <div style={styles.selectedHeader}>
                  <h4 style={styles.selectedTitle}>{selectedNode.name}</h4>
                  <button onClick={() => setSelectedNode(null)} style={styles.closeBtn}>×</button>
                </div>
                <div style={styles.selectedInfo}>
                  <span style={{
                    ...styles.typeBadge,
                    backgroundColor: selectedNode.type === 'investor' 
                      ? NODE_COLORS.investor.fill 
                      : NODE_COLORS[selectedNode.stage as keyof typeof NODE_COLORS]?.fill || '#6b7280'
                  }}>
                    {selectedNode.type === 'investor' ? 'Investor' : STAGE_LABELS[selectedNode.stage!]}
                  </span>
                  {selectedNode.warmth && (
                    <span style={{
                      ...styles.warmthBadge,
                      background: WARMTH_COLORS[selectedNode.warmth].bg,
                      color: WARMTH_COLORS[selectedNode.warmth].text,
                    }}>
                      {WARMTH_LABELS[selectedNode.warmth]}
                    </span>
                  )}
                </div>
                {selectedNode.firmName && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Firm</span>
                    <span style={styles.detailValue}>{selectedNode.firmName}</span>
                  </div>
                )}
                {selectedNode.email && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Email</span>
                    <span style={styles.detailValue}>{selectedNode.email}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '500px',
    background: '#f8fafc',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid #e2e8f0',
    background: '#fff',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#1e293b',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: '11px',
    color: '#64748b',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  zoomControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: '#f1f5f9',
    borderRadius: '6px',
    padding: '2px',
  },
  zoomBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    background: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 600,
    color: '#374151',
  },
  zoomLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#64748b',
    minWidth: '40px',
    textAlign: 'center',
  },
  resetBtn: {
    padding: '4px 8px',
    border: 'none',
    background: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    color: '#374151',
  },
  select: {
    padding: '6px 10px',
    fontSize: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    width: '150px',
    minWidth: '150px',
    padding: '12px',
    borderRight: '1px solid #e2e8f0',
    background: '#fff',
    overflowY: 'auto',
    fontSize: '11px',
  },
  filterSection: {
    marginBottom: '14px',
  },
  filterTitle: {
    margin: '0 0 8px 0',
    fontSize: '10px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#334155',
    marginBottom: '5px',
    cursor: 'pointer',
  },
  legendSection: {
    paddingTop: '10px',
    borderTop: '1px solid #e2e8f0',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    color: '#334155',
    marginBottom: '4px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendLine: {
    width: '16px',
    height: '3px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  graphContainer: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  svg: {
    display: 'block',
  },
  rightPanel: {
    width: '170px',
    minWidth: '170px',
    padding: '12px',
    borderLeft: '1px solid #e2e8f0',
    background: '#fff',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  metricsPanel: {
    padding: '10px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  metricsTitle: {
    margin: '0 0 8px 0',
    fontSize: '11px',
    fontWeight: 600,
    color: '#1e293b',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  metricLabel: {
    fontSize: '10px',
    color: '#64748b',
  },
  metricValue: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#1e293b',
  },
  selectedPanel: {
    padding: '10px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  selectedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '6px',
  },
  selectedTitle: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 600,
    color: '#1e293b',
    flex: 1,
    lineHeight: 1.3,
  },
  closeBtn: {
    width: '18px',
    height: '18px',
    border: 'none',
    background: '#e2e8f0',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectedInfo: {
    display: 'flex',
    gap: '4px',
    marginBottom: '6px',
    flexWrap: 'wrap',
  },
  typeBadge: {
    padding: '2px 6px',
    fontSize: '9px',
    fontWeight: 600,
    color: '#fff',
    borderRadius: '8px',
  },
  warmthBadge: {
    padding: '2px 6px',
    fontSize: '9px',
    fontWeight: 600,
    borderRadius: '8px',
  },
  detailRow: {
    marginBottom: '4px',
  },
  detailLabel: {
    fontSize: '9px',
    color: '#64748b',
    textTransform: 'uppercase',
    display: 'block',
  },
  detailValue: {
    fontSize: '11px',
    color: '#1e293b',
    fontWeight: 500,
  },
};

export default PipelineAccessMap;
