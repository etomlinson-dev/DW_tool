import { useState, useEffect, useRef, useCallback } from "react";
import { kyiApi } from "../api/kyiClient";
import type { InvestorGraph as InvestorGraphType, GraphNode, GraphEdge, GraphHub, GraphCluster } from "../types/kyi";
import { WARMTH_COLORS, STAGE_COLORS } from "../types/kyi";

interface Props {
  investorId: number;
  onNodeClick?: (nodeId: string) => void;
}

// Simple force simulation for graph layout
function useForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const animationRef = useRef<number>();

  useEffect(() => {
    if (nodes.length === 0) return;

    // Initialize positions in a circle
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;
    
    const initialPositions: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      // Place center node in middle
      if (node.size && node.size >= 30) {
        initialPositions[node.id] = { x: centerX, y: centerY, vx: 0, vy: 0 };
      } else {
        initialPositions[node.id] = {
          x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 50,
          y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 50,
          vx: 0,
          vy: 0,
        };
      }
    });

    // Build edge index
    const edgeIndex: Record<string, string[]> = {};
    edges.forEach((edge) => {
      if (!edgeIndex[edge.source]) edgeIndex[edge.source] = [];
      if (!edgeIndex[edge.target]) edgeIndex[edge.target] = [];
      edgeIndex[edge.source].push(edge.target);
      edgeIndex[edge.target].push(edge.source);
    });

    // Run simulation
    let iteration = 0;
    const maxIterations = 100;
    const alpha = 0.3;
    const alphaDecay = 0.02;
    
    const simulate = () => {
      if (iteration >= maxIterations) {
        setPositions(
          Object.fromEntries(
            Object.entries(initialPositions).map(([id, pos]) => [id, { x: pos.x, y: pos.y }])
          )
        );
        return;
      }

      const currentAlpha = alpha * Math.max(0, 1 - iteration * alphaDecay);

      // Apply forces
      Object.keys(initialPositions).forEach((id) => {
        const pos = initialPositions[id];
        let fx = 0;
        let fy = 0;

        // Repulsion from all other nodes
        Object.keys(initialPositions).forEach((otherId) => {
          if (id === otherId) return;
          const other = initialPositions[otherId];
          const dx = pos.x - other.x;
          const dy = pos.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 5000 / (distance * distance);
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        });

        // Attraction to connected nodes
        const connected = edgeIndex[id] || [];
        connected.forEach((otherId) => {
          if (!initialPositions[otherId]) return;
          const other = initialPositions[otherId];
          const dx = other.x - pos.x;
          const dy = other.y - pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = distance * 0.05;
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        });

        // Center gravity
        const dx = centerX - pos.x;
        const dy = centerY - pos.y;
        fx += dx * 0.01;
        fy += dy * 0.01;

        // Update velocity and position
        pos.vx = pos.vx * 0.9 + fx * currentAlpha;
        pos.vy = pos.vy * 0.9 + fy * currentAlpha;
        pos.x += pos.vx;
        pos.y += pos.vy;

        // Keep within bounds
        pos.x = Math.max(50, Math.min(width - 50, pos.x));
        pos.y = Math.max(50, Math.min(height - 50, pos.y));
      });

      iteration++;
      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, edges, width, height]);

  return positions;
}

// Node color based on type and properties
function getNodeColor(node: GraphNode): string {
  if (node.type === "investor") {
    if (node.warmth && WARMTH_COLORS[node.warmth]) {
      return WARMTH_COLORS[node.warmth].bg;
    }
    return "#667eea";
  } else if (node.type === "prospect") {
    if (node.stage && STAGE_COLORS[node.stage]) {
      return STAGE_COLORS[node.stage].bg;
    }
    return "#f3f4f6";
  }
  return "#d1d5db";
}

function getNodeBorderColor(node: GraphNode): string {
  if (node.type === "investor") {
    if (node.warmth && WARMTH_COLORS[node.warmth]) {
      return WARMTH_COLORS[node.warmth].text;
    }
    return "#4f46e5";
  } else if (node.type === "prospect") {
    if (node.stage && STAGE_COLORS[node.stage]) {
      return STAGE_COLORS[node.stage].border;
    }
    return "#9ca3af";
  }
  return "#6b7280";
}

export function InvestorGraph({ investorId, onNodeClick }: Props) {
  const [graph, setGraph] = useState<InvestorGraphType | null>(null);
  const [hubs, setHubs] = useState<GraphHub[]>([]);
  const [clusters, setClusters] = useState<GraphCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showHubs, setShowHubs] = useState(false);
  const [showClusters, setShowClusters] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Load graph data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [graphData, hubsData, clustersData] = await Promise.all([
          kyiApi.graph.getInvestorGraph(investorId),
          kyiApi.graph.getHubs(),
          kyiApi.graph.getClusters(),
        ]);
        setGraph(graphData);
        setHubs(hubsData);
        setClusters(clustersData);
        setError(null);
      } catch (err) {
        console.error("Failed to load graph:", err);
        setError("Failed to load relationship graph");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [investorId]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(400, containerRef.current.clientHeight),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Calculate positions with force simulation
  const positions = useForceSimulation(
    graph?.nodes || [],
    graph?.edges || [],
    dimensions.width,
    dimensions.height
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    onNodeClick?.(node.id);
  }, [onNodeClick]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading relationship graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>🕸️</span>
          <p style={styles.emptyText}>No connections found</p>
          <p style={styles.emptySubtext}>Import LinkedIn connections or add relationships to build the graph</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.stats}>
          <span style={styles.stat}>{graph.nodes.length} nodes</span>
          <span style={styles.stat}>{graph.edges.length} connections</span>
        </div>
        <div style={styles.toggles}>
          <button
            onClick={() => setShowHubs(!showHubs)}
            style={{ ...styles.toggleBtn, ...(showHubs ? styles.toggleBtnActive : {}) }}
          >
            Hubs ({hubs.length})
          </button>
          <button
            onClick={() => setShowClusters(!showClusters)}
            style={{ ...styles.toggleBtn, ...(showClusters ? styles.toggleBtnActive : {}) }}
          >
            Clusters ({clusters.length})
          </button>
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} style={styles.graphContainer}>
        <svg width={dimensions.width} height={dimensions.height} style={styles.svg}>
          {/* Edges */}
          {graph.edges.map((edge) => {
            const sourcePos = positions[edge.source];
            const targetPos = positions[edge.target];
            if (!sourcePos || !targetPos) return null;

            const isHighlighted =
              hoveredNode === edge.source ||
              hoveredNode === edge.target ||
              (selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target));

            return (
              <g key={edge.id}>
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={isHighlighted ? "#667eea" : "#e5e7eb"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={isHighlighted ? 1 : 0.6}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;

            const nodeSize = node.size || 20;
            const isCenter = nodeSize >= 30;
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Node circle */}
                <circle
                  r={isHovered || isSelected ? nodeSize + 4 : nodeSize}
                  fill={getNodeColor(node)}
                  stroke={isSelected ? "#1f2937" : isHovered ? "#667eea" : getNodeBorderColor(node)}
                  strokeWidth={isCenter ? 3 : isSelected ? 3 : isHovered ? 2 : 1}
                />
                
                {/* Node label */}
                <text
                  y={nodeSize + 14}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize={isCenter ? 12 : 10}
                  fontWeight={isCenter ? 600 : 400}
                  style={{ pointerEvents: "none" }}
                >
                  {node.name.length > 15 ? node.name.slice(0, 15) + "..." : node.name}
                </text>

                {/* Connection count badge */}
                {node.connections > 1 && (
                  <g transform={`translate(${nodeSize - 5}, ${-nodeSize + 5})`}>
                    <circle r={8} fill="#667eea" />
                    <text
                      textAnchor="middle"
                      dy={4}
                      fill="#fff"
                      fontSize={9}
                      fontWeight={600}
                      style={{ pointerEvents: "none" }}
                    >
                      {node.connections > 99 ? "99+" : node.connections}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hubs panel */}
      {showHubs && (
        <div style={styles.sidePanel}>
          <h4 style={styles.sidePanelTitle}>Influence Hubs</h4>
          <div style={styles.hubList}>
            {hubs.slice(0, 10).map((hub) => (
              <div
                key={hub.nodeId}
                style={styles.hubItem}
                onClick={() => {
                  const node = graph.nodes.find((n) => n.id === hub.nodeId);
                  if (node) handleNodeClick(node);
                }}
              >
                <div style={styles.hubInfo}>
                  <span style={styles.hubName}>{hub.name}</span>
                  <span style={styles.hubConnections}>{hub.connectionCount} connections</span>
                </div>
                <div style={styles.hubScore}>
                  <span style={styles.scoreValue}>{hub.influenceScore}</span>
                  <span style={styles.scoreLabel}>influence</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clusters panel */}
      {showClusters && (
        <div style={styles.sidePanel}>
          <h4 style={styles.sidePanelTitle}>Clusters</h4>
          <div style={styles.clusterList}>
            {clusters.slice(0, 10).map((cluster) => (
              <div key={cluster.id} style={styles.clusterItem}>
                <div style={styles.clusterInfo}>
                  <span style={styles.clusterName}>{cluster.name}</span>
                  <span style={styles.clusterType}>{cluster.type}</span>
                </div>
                <span style={styles.clusterSize}>{cluster.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected node details */}
      {selectedNode && (
        <div style={styles.nodeDetails}>
          <div style={styles.nodeDetailsHeader}>
            <h4 style={styles.nodeDetailsTitle}>{selectedNode.name}</h4>
            <button onClick={() => setSelectedNode(null)} style={styles.closeBtn}>×</button>
          </div>
          <div style={styles.nodeDetailsBody}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Type</span>
              <span style={styles.detailValue}>{selectedNode.type}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Connections</span>
              <span style={styles.detailValue}>{selectedNode.connections}</span>
            </div>
            {selectedNode.warmth && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Warmth</span>
                <span style={styles.detailValue}>{selectedNode.warmth}</span>
              </div>
            )}
            {selectedNode.riskScore && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Risk Score</span>
                <span style={styles.detailValue}>{selectedNode.riskScore}/10</span>
              </div>
            )}
            {selectedNode.strategicScore && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Strategic Score</span>
                <span style={styles.detailValue}>{selectedNode.strategicScore}/10</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: "#667eea" }} />
          <span>Investor</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: "#dcfce7" }} />
          <span>Prospect</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: "#fed7aa" }} />
          <span>Warm</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: "#bbf7d0" }} />
          <span>Trusted</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    background: "#fff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  controls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  stats: {
    display: "flex",
    gap: "16px",
  },
  stat: {
    fontSize: "13px",
    color: "#6b7280",
  },
  toggles: {
    display: "flex",
    gap: "8px",
  },
  toggleBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: "12px",
    cursor: "pointer",
  },
  toggleBtnActive: {
    background: "#667eea",
    borderColor: "#667eea",
    color: "#fff",
  },
  graphContainer: {
    width: "100%",
    height: "500px",
    background: "#fafafa",
  },
  svg: {
    display: "block",
  },
  sidePanel: {
    position: "absolute",
    top: "60px",
    right: "16px",
    width: "220px",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    padding: "12px",
    maxHeight: "350px",
    overflowY: "auto",
  },
  sidePanelTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  hubList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  hubItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    background: "#f9fafb",
    borderRadius: "6px",
    cursor: "pointer",
  },
  hubInfo: {
    display: "flex",
    flexDirection: "column",
  },
  hubName: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#1f2937",
  },
  hubConnections: {
    fontSize: "10px",
    color: "#9ca3af",
  },
  hubScore: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  scoreValue: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#667eea",
  },
  scoreLabel: {
    fontSize: "9px",
    color: "#9ca3af",
  },
  clusterList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  clusterItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    background: "#f9fafb",
    borderRadius: "6px",
  },
  clusterInfo: {
    display: "flex",
    flexDirection: "column",
  },
  clusterName: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#1f2937",
  },
  clusterType: {
    fontSize: "10px",
    color: "#9ca3af",
    textTransform: "capitalize",
  },
  clusterSize: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#16a34a",
  },
  nodeDetails: {
    position: "absolute",
    bottom: "60px",
    left: "16px",
    width: "200px",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
  },
  nodeDetailsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
  },
  nodeDetailsTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  closeBtn: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeDetailsBody: {
    padding: "10px 12px",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  detailLabel: {
    fontSize: "11px",
    color: "#9ca3af",
  },
  detailValue: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#374151",
    textTransform: "capitalize",
  },
  legend: {
    position: "absolute",
    bottom: "16px",
    right: "16px",
    display: "flex",
    gap: "16px",
    background: "#fff",
    padding: "8px 12px",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    color: "#6b7280",
  },
  legendDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  loading: {
    padding: "60px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "14px",
  },
  error: {
    padding: "60px",
    textAlign: "center",
    color: "#dc2626",
    fontSize: "14px",
  },
  empty: {
    padding: "60px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "40px",
    display: "block",
    marginBottom: "12px",
  },
  emptyText: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 6px",
  },
  emptySubtext: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: 0,
  },
};

export default InvestorGraph;
