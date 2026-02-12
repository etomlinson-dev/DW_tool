// AccessMap Component Barrel Export
export { AccessMap } from './AccessMap';
export { WebCanvas } from './WebCanvas';
export { Node } from './Node';
export { Edge } from './Edge';
export { Legend } from './Legend';
export { MetricsPanel } from './MetricsPanel';

// Web utilities
export { getWebIntersectionPoint, generateWebCurve, getAllWebPositions } from './webUtils';

// Re-export types for convenience
export type {
  Client,
  Entity,
  Edge as EdgeType,
  NetworkGraph,
  NodePosition,
  OverlapMetrics,
  WebCanvasConfig,
} from '../../types/network';
