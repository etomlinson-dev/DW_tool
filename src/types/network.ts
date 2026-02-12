// AccessMap Network Visualization Types

/**
 * A Client represents an investor in the network visualization.
 * Each client has a unique color for visual identification.
 */
export type Client = {
  id: string;
  name: string;
  color: string;
};

/**
 * An Entity represents a node in the network graph.
 * Entities can be people, firms, or funds that clients are connected to.
 */
export type Entity = {
  id: string;
  label: string;
  type: 'person' | 'firm' | 'fund';
  /** Depth level for ring positioning (1 = innermost) */
  depth?: number;
};

/**
 * An Edge represents a connection between two entities.
 * Edges track which clients share this connection.
 */
export type Edge = {
  from: string;
  to: string;
  strength: number;
  /** IDs of clients that share this edge connection */
  clients: string[];
};

/**
 * The complete network graph data structure.
 */
export type NetworkGraph = {
  clients: Client[];
  entities: Entity[];
  edges: Edge[];
};

/**
 * Computed position for an entity node on the canvas.
 */
export type NodePosition = {
  entityId: string;
  x: number;
  y: number;
  ring: number;
  angle: number;
};

/**
 * Overlap metrics calculated from the network graph.
 */
export type OverlapMetrics = {
  totalEntities: number;
  uniqueEntities: number;
  overlappingEntities: number;
  overlapPercentage: number;
  networkGrowthDelta: number;
};

/**
 * Configuration for the web canvas rendering.
 */
export type WebCanvasConfig = {
  ringCount: number;
  spokeCount: number;
  centerX: number;
  centerY: number;
  maxRadius: number;
  ringSpacing: number;
};
