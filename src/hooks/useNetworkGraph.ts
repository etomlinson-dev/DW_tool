import { useState, useEffect, useMemo, useCallback } from 'react';
import type { NetworkGraph, Client, Entity, Edge, NodePosition, WebCanvasConfig } from '../types/network';
import { networkApi } from '../api/client';

interface UseNetworkGraphOptions {
  /** IDs of active clients to include in the graph */
  activeClientIds: string[];
  /** Canvas configuration for position calculations */
  canvasConfig?: Partial<WebCanvasConfig>;
}

interface UseNetworkGraphResult {
  /** The full network graph data */
  graph: NetworkGraph;
  /** Filtered entities based on active clients */
  filteredEntities: Entity[];
  /** Filtered edges based on active clients */
  filteredEdges: Edge[];
  /** Calculated positions for all filtered entities */
  positions: Map<string, NodePosition>;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Reload graph data */
  reload: () => void;
}

// Default canvas configuration
const DEFAULT_CONFIG: WebCanvasConfig = {
  ringCount: 4,
  spokeCount: 8,
  centerX: 400,
  centerY: 300,
  maxRadius: 200,
  ringSpacing: 50,
};

/**
 * Calculate the exact position of a spoke-ring intersection point.
 * Uses the same formula as WebCanvas for perfect alignment.
 */
function getWebIntersectionPoint(
  ring: number,
  spoke: number,
  config: WebCanvasConfig
): { x: number; y: number; angle: number } {
  const { centerX, centerY, ringCount, spokeCount, maxRadius } = config;
  const ringSpacing = maxRadius / ringCount;
  const radius = ringSpacing * ring;
  const angle = -Math.PI / 2 + (2 * Math.PI * spoke) / spokeCount;
  
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
    angle,
  };
}

/**
 * Get the preferred rings for an entity based on its type.
 * Firms are outermost, then Funds, then Persons innermost.
 */
function getRingsForEntityType(type: Entity['type'], ringCount: number): number[] {
  switch (type) {
    case 'firm':
      return [ringCount, ringCount - 1, ringCount - 2, 1]; // Outermost first
    case 'fund':
      return [ringCount - 1, ringCount, ringCount - 2, 1]; // Second outermost first
    case 'person':
      return [1, 2, 3, ringCount]; // Innermost first
    default:
      return [2, 1, 3, ringCount];
  }
}

/**
 * Calculate deterministic node positions on the web intersections.
 * Each entity gets a unique spoke-ring position - no overlapping.
 */
function calculatePositions(
  entities: Entity[],
  _edges: Edge[],
  config: WebCanvasConfig
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  
  if (entities.length === 0) {
    return positions;
  }

  const { ringCount, spokeCount } = config;
  
  // Track which positions are used (by key "ring-spoke")
  const usedPositions = new Set<string>();
  
  // Group entities by type for ordered placement
  const firmEntities = entities.filter(e => e.type === 'firm');
  const fundEntities = entities.filter(e => e.type === 'fund');
  const personEntities = entities.filter(e => e.type === 'person');
  
  // Helper to find and assign a position
  const assignPosition = (entity: Entity, preferredRings: number[]): boolean => {
    // Try each preferred ring
    for (const ring of preferredRings) {
      if (ring < 1 || ring > ringCount) continue;
      
      // Try each spoke on this ring
      for (let spoke = 0; spoke < spokeCount; spoke++) {
        const key = `${ring}-${spoke}`;
        if (!usedPositions.has(key)) {
          const point = getWebIntersectionPoint(ring, spoke, config);
          usedPositions.add(key);
          
          positions.set(entity.id, {
            entityId: entity.id,
            x: point.x,
            y: point.y,
            ring,
            angle: point.angle,
          });
          return true;
        }
      }
    }
    return false;
  };
  
  // Place entities in order: Firms (outer) -> Funds (middle) -> Persons (inner)
  firmEntities.forEach(entity => {
    assignPosition(entity, getRingsForEntityType('firm', ringCount));
  });
  
  fundEntities.forEach(entity => {
    assignPosition(entity, getRingsForEntityType('fund', ringCount));
  });
  
  personEntities.forEach(entity => {
    assignPosition(entity, getRingsForEntityType('person', ringCount));
  });
  
  return positions;
}

/**
 * Filter entities to only include those connected to active clients.
 */
function filterEntitiesByClients(
  entities: Entity[],
  edges: Edge[],
  activeClientIds: string[]
): Entity[] {
  if (activeClientIds.length === 0) {
    return [];
  }
  
  const connectedEntityIds = new Set<string>();
  edges.forEach(edge => {
    const hasActiveClient = edge.clients.some(clientId => 
      activeClientIds.includes(clientId)
    );
    if (hasActiveClient) {
      connectedEntityIds.add(edge.from);
      connectedEntityIds.add(edge.to);
    }
  });
  
  return entities.filter(entity => connectedEntityIds.has(entity.id));
}

/**
 * Filter edges to only include those with active clients.
 */
function filterEdgesByClients(
  edges: Edge[],
  activeClientIds: string[]
): Edge[] {
  if (activeClientIds.length === 0) {
    return [];
  }
  
  return edges.filter(edge => 
    edge.clients.some(clientId => activeClientIds.includes(clientId))
  ).map(edge => ({
    ...edge,
    clients: edge.clients.filter(clientId => activeClientIds.includes(clientId)),
  }));
}

/**
 * Hook to load and manage network graph data.
 */
export function useNetworkGraph({
  activeClientIds,
  canvasConfig,
}: UseNetworkGraphOptions): UseNetworkGraphResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<NetworkGraph>({
    clients: [],
    entities: [],
    edges: [],
  });

  // Use provided config or defaults
  const config: WebCanvasConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...canvasConfig,
  }), [canvasConfig]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from API
      const apiData = await networkApi.getGraph();
      
      const data: NetworkGraph = {
        clients: apiData.clients as Client[],
        entities: apiData.entities as Entity[],
        edges: apiData.edges as Edge[],
      };
      
      setGraph(data);
    } catch (err) {
      console.error('Failed to load network graph:', err);
      setError('Failed to load network data');
      // Set empty graph on error
      setGraph({ clients: [], entities: [], edges: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEdges = useMemo(() => 
    filterEdgesByClients(graph.edges, activeClientIds),
    [graph.edges, activeClientIds]
  );

  const filteredEntities = useMemo(() => 
    filterEntitiesByClients(graph.entities, graph.edges, activeClientIds),
    [graph.entities, graph.edges, activeClientIds]
  );

  const positions = useMemo(() => 
    calculatePositions(filteredEntities, filteredEdges, config),
    [filteredEntities, filteredEdges, config]
  );

  return {
    graph,
    filteredEntities,
    filteredEdges,
    positions,
    loading,
    error,
    reload: loadData,
  };
}

export default useNetworkGraph;
