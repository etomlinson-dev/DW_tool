import type { WebCanvasConfig } from '../../types/network';

/**
 * Calculate the exact position of a spoke-ring intersection point.
 * This function is shared between WebCanvas and node positioning
 * to ensure perfect alignment.
 */
export function getWebIntersectionPoint(
  ring: number,
  spoke: number,
  config: WebCanvasConfig
): { x: number; y: number; angle: number } {
  const { centerX, centerY, ringCount, spokeCount } = config;
  const ringSpacing = config.maxRadius / ringCount;
  const radius = ringSpacing * ring;
  const angle = -Math.PI / 2 + (2 * Math.PI * spoke) / spokeCount;
  
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
    angle,
  };
}

/**
 * Generate a curved path between two adjacent spoke points on the same ring.
 */
export function generateWebCurve(
  x1: number, y1: number,
  x2: number, y2: number,
  centerX: number, centerY: number,
  radius: number
): string {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  
  const dx = midX - centerX;
  const dy = midY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const curveFactor = 0.12;
  const controlX = midX - (dx / dist) * radius * curveFactor;
  const controlY = midY - (dy / dist) * radius * curveFactor;
  
  return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
}

/**
 * Get all available web intersection positions.
 */
export function getAllWebPositions(config: WebCanvasConfig): Array<{
  ring: number;
  spoke: number;
  x: number;
  y: number;
  angle: number;
  key: string;
}> {
  const positions: Array<{
    ring: number;
    spoke: number;
    x: number;
    y: number;
    angle: number;
    key: string;
  }> = [];
  
  for (let ring = 1; ring <= config.ringCount; ring++) {
    for (let spoke = 0; spoke < config.spokeCount; spoke++) {
      const point = getWebIntersectionPoint(ring, spoke, config);
      positions.push({
        ring,
        spoke,
        x: point.x,
        y: point.y,
        angle: point.angle,
        key: `${ring}-${spoke}`,
      });
    }
  }
  
  return positions;
}
