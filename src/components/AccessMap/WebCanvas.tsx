import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { WebCanvasConfig } from '../../types/network';
import { getWebIntersectionPoint, generateWebCurve } from './webUtils';

interface WebCanvasProps {
  /** Number of concentric rings to render */
  ringCount?: number;
  /** Number of radial spokes to render */
  spokeCount?: number;
  /** Children elements (nodes, edges) to render on the canvas */
  children?: React.ReactNode;
  /** Callback to report actual canvas dimensions */
  onDimensionsChange?: (config: WebCanvasConfig) => void;
}

/**
 * WebCanvas renders the animated spider-web structure:
 * - Concentric web rings with curved segments
 * - Radial spokes extending from center
 * - Intersection dots showing valid node positions
 */
export function WebCanvas({
  ringCount = 4,
  spokeCount = 8,
  children,
  onDimensionsChange,
}: WebCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [config, setConfig] = useState<WebCanvasConfig | null>(null);

  // Update dimensions on resize and notify parent
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 600;
      
      setDimensions({ width, height });
      
      const maxRadius = Math.min(width, height) * 0.4;
      const newConfig: WebCanvasConfig = {
        ringCount,
        spokeCount,
        centerX: width / 2,
        centerY: height / 2,
        maxRadius,
        ringSpacing: maxRadius / ringCount,
      };
      
      setConfig(newConfig);
      onDimensionsChange?.(newConfig);
    }
  }, [onDimensionsChange, ringCount, spokeCount]);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Don't render web structure until we have valid config
  if (!config) {
    return (
      <div ref={containerRef} style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  const { centerX, centerY, maxRadius } = config;

  // Generate radial spokes with animation
  const spokes = Array.from({ length: spokeCount }, (_, spoke) => {
    const outerPoint = getWebIntersectionPoint(ringCount, spoke, config);
    return (
      <motion.line
        key={`spoke-${spoke}`}
        x1={centerX}
        y1={centerY}
        x2={outerPoint.x}
        y2={outerPoint.y}
        stroke="#d1d5db"
        strokeWidth={1.5}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.6 }}
        transition={{ duration: 0.5, delay: spoke * 0.05 }}
      />
    );
  });

  // Generate web curves for each ring
  const webCurves: React.ReactNode[] = [];
  for (let ring = 1; ring <= ringCount; ring++) {
    const ringSpacing = config.maxRadius / ringCount;
    const radius = ringSpacing * ring;
    
    for (let spoke = 0; spoke < spokeCount; spoke++) {
      const nextSpoke = (spoke + 1) % spokeCount;
      const p1 = getWebIntersectionPoint(ring, spoke, config);
      const p2 = getWebIntersectionPoint(ring, nextSpoke, config);
      
      const curvePath = generateWebCurve(
        p1.x, p1.y,
        p2.x, p2.y,
        centerX, centerY,
        radius
      );
      
      webCurves.push(
        <motion.path
          key={`web-${ring}-${spoke}`}
          d={curvePath}
          fill="none"
          stroke="#d1d5db"
          strokeWidth={1.5}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: ring === ringCount ? 0.7 : 0.5 }}
          transition={{ duration: 0.4, delay: 0.3 + ring * 0.1 }}
        />
      );
    }
  }

  // Intersection dots at spoke-ring points (where nodes will be placed)
  const intersectionDots: React.ReactNode[] = [];
  for (let ring = 1; ring <= ringCount; ring++) {
    for (let spoke = 0; spoke < spokeCount; spoke++) {
      const point = getWebIntersectionPoint(ring, spoke, config);
      intersectionDots.push(
        <motion.circle
          key={`dot-${ring}-${spoke}`}
          cx={point.x}
          cy={point.y}
          r={3}
          fill="#e5e7eb"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ delay: 0.5 + (ring * spokeCount + spoke) * 0.02 }}
        />
      );
    }
  }

  // Center dot
  const centerDot = (
    <motion.circle
      cx={centerX}
      cy={centerY}
      r={8}
      fill="#667eea"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', delay: 0.2 }}
    />
  );

  return (
    <div ref={containerRef} style={styles.container}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        style={styles.svg}
      >
        {/* Background gradient */}
        <defs>
          <radialGradient id="webGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fafafa" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </radialGradient>
        </defs>
        
        {/* Background circle */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={maxRadius + 40}
          fill="url(#webGradient)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        />

        {/* Web structure */}
        <g className="web-structure">
          {spokes}
          {webCurves}
          {intersectionDots}
          {centerDot}
        </g>

        {/* Child elements (edges and nodes) */}
        <g className="web-content">
          {children}
        </g>
      </svg>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    minHeight: '500px',
    position: 'relative',
    background: '#fafafa',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  svg: {
    display: 'block',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
  },
};

export default WebCanvas;
