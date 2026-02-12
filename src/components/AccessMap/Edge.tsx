import React from 'react';
import { motion } from 'framer-motion';
import type { Edge as EdgeType, NodePosition } from '../../types/network';

interface EdgeProps {
  edge: EdgeType;
  fromPosition: NodePosition;
  toPosition: NodePosition;
  /** Whether this edge is shared by multiple clients */
  isOverlapping?: boolean;
  /** Number of clients sharing this edge */
  overlapCount?: number;
  /** Whether the edge is highlighted (connected to hovered/selected node) */
  isHighlighted?: boolean;
  /** Client colors for multi-colored edges */
  clientColors?: string[];
}

/**
 * Edge component renders an animated connection line between two nodes.
 * Uses Framer Motion for smooth entrance and interaction animations.
 */
export function Edge({
  edge,
  fromPosition,
  toPosition,
  isOverlapping = false,
  overlapCount = 0,
  isHighlighted = false,
  clientColors = [],
}: EdgeProps) {
  // Calculate visual properties
  const baseOpacity = isOverlapping ? 0.7 : 0.35;
  const opacity = isHighlighted ? 0.9 : baseOpacity;
  
  // Scale stroke width based on overlap count
  const baseWidth = 1.5 + edge.strength * 0.3;
  const overlapScale = isOverlapping ? 1 + (overlapCount - 1) * 0.3 : 1;
  const strokeWidth = Math.min(baseWidth * overlapScale, 5);

  // Determine stroke color
  const strokeColor = isHighlighted
    ? '#667eea'
    : isOverlapping && clientColors.length > 0
      ? clientColors[0]
      : '#94a3b8';

  // Calculate path length for animation
  const dx = toPosition.x - fromPosition.x;
  const dy = toPosition.y - fromPosition.y;
  const pathLength = Math.sqrt(dx * dx + dy * dy);

  // Animation variants
  const lineVariants = {
    initial: { 
      pathLength: 0, 
      opacity: 0 
    },
    animate: { 
      pathLength: 1, 
      opacity,
      transition: {
        pathLength: { duration: 0.5, ease: 'easeOut' },
        opacity: { duration: 0.3 },
      }
    },
  };

  return (
    <g className="network-edge">
      {/* Glow effect for overlapping or highlighted edges */}
      {(isOverlapping || isHighlighted) && (
        <motion.line
          x1={fromPosition.x}
          y1={fromPosition.y}
          x2={toPosition.x}
          y2={toPosition.y}
          stroke={strokeColor}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
        />
      )}

      {/* Main edge line */}
      <motion.line
        x1={fromPosition.x}
        y1={fromPosition.y}
        x2={toPosition.x}
        y2={toPosition.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial="initial"
        animate="animate"
        variants={lineVariants}
      />

      {/* Animated flow indicator for overlapping edges */}
      {isOverlapping && (
        <motion.circle
          r={3}
          fill={strokeColor}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.8, 0],
            cx: [fromPosition.x, toPosition.x],
            cy: [fromPosition.y, toPosition.y],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
            delay: Math.random() * 2,
          }}
        />
      )}
    </g>
  );
}

export default Edge;
