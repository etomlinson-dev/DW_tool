import { useMemo, useRef, useEffect } from 'react';
import type { Entity, Edge, OverlapMetrics } from '../types/network';

interface UseOverlapMetricsOptions {
  /** List of entities in the current view */
  entities: Entity[];
  /** List of edges in the current view */
  edges: Edge[];
  /** IDs of currently active clients */
  activeClientIds: string[];
}

interface EntityOverlapInfo {
  entityId: string;
  clientsConnected: Set<string>;
  isOverlapping: boolean;
  overlapCount: number;
}

interface UseOverlapMetricsResult {
  /** Calculated overlap metrics */
  metrics: OverlapMetrics;
  /** Detailed overlap info per entity */
  entityOverlaps: Map<string, EntityOverlapInfo>;
  /** Detailed overlap info per edge */
  edgeOverlaps: Map<string, number>;
  /** Entities that are shared by multiple clients */
  sharedEntities: Entity[];
  /** Edges that are shared by multiple clients */
  sharedEdges: Edge[];
}

/**
 * Calculate which clients are connected to an entity via edges.
 */
function getClientsForEntity(
  entityId: string,
  edges: Edge[]
): Set<string> {
  const clients = new Set<string>();
  
  edges.forEach(edge => {
    if (edge.from === entityId || edge.to === entityId) {
      edge.clients.forEach(clientId => clients.add(clientId));
    }
  });
  
  return clients;
}

/**
 * Hook to calculate overlap metrics for the network visualization.
 * Detects which entities and edges are shared between multiple clients.
 */
export function useOverlapMetrics({
  entities,
  edges,
  activeClientIds,
}: UseOverlapMetricsOptions): UseOverlapMetricsResult {
  // Track previous entity count for growth delta
  const prevEntityCountRef = useRef<number>(0);

  // Calculate entity overlaps
  const entityOverlaps = useMemo(() => {
    const overlaps = new Map<string, EntityOverlapInfo>();
    
    entities.forEach(entity => {
      const clientsConnected = getClientsForEntity(entity.id, edges);
      const activeClientsConnected = new Set(
        [...clientsConnected].filter(id => activeClientIds.includes(id))
      );
      
      overlaps.set(entity.id, {
        entityId: entity.id,
        clientsConnected: activeClientsConnected,
        isOverlapping: activeClientsConnected.size > 1,
        overlapCount: activeClientsConnected.size,
      });
    });
    
    return overlaps;
  }, [entities, edges, activeClientIds]);

  // Calculate edge overlaps (number of active clients per edge)
  const edgeOverlaps = useMemo(() => {
    const overlaps = new Map<string, number>();
    
    edges.forEach(edge => {
      const edgeKey = `${edge.from}-${edge.to}`;
      const activeClients = edge.clients.filter(id => activeClientIds.includes(id));
      overlaps.set(edgeKey, activeClients.length);
    });
    
    return overlaps;
  }, [edges, activeClientIds]);

  // Get shared entities (overlapping)
  const sharedEntities = useMemo(() => {
    return entities.filter(entity => {
      const info = entityOverlaps.get(entity.id);
      return info?.isOverlapping ?? false;
    });
  }, [entities, entityOverlaps]);

  // Get shared edges (multiple clients)
  const sharedEdges = useMemo(() => {
    return edges.filter(edge => {
      const activeClients = edge.clients.filter(id => activeClientIds.includes(id));
      return activeClients.length > 1;
    });
  }, [edges, activeClientIds]);

  // Calculate metrics
  const metrics = useMemo((): OverlapMetrics => {
    const totalEntities = entities.length;
    const overlappingEntities = sharedEntities.length;
    
    // Count unique entities (entities connected to at least one active client)
    const uniqueEntities = [...entityOverlaps.values()].filter(
      info => info.clientsConnected.size > 0
    ).length;
    
    // Calculate overlap percentage
    const overlapPercentage = totalEntities > 0
      ? (overlappingEntities / totalEntities) * 100
      : 0;
    
    // Calculate network growth delta
    const networkGrowthDelta = totalEntities - prevEntityCountRef.current;
    
    return {
      totalEntities,
      uniqueEntities,
      overlappingEntities,
      overlapPercentage,
      networkGrowthDelta,
    };
  }, [entities.length, sharedEntities.length, entityOverlaps]);

  // Update previous count after metrics calculation
  useEffect(() => {
    prevEntityCountRef.current = entities.length;
  }, [entities.length]);

  return {
    metrics,
    entityOverlaps,
    edgeOverlaps,
    sharedEntities,
    sharedEdges,
  };
}

export default useOverlapMetrics;
