import React from 'react';
import { motion } from 'framer-motion';
import type { Entity, NodePosition } from '../../types/network';

interface NodeProps {
  entity: Entity;
  position: NodePosition;
  /** Base size of the node (radius) */
  size?: number;
  /** Whether this node is shared by multiple clients */
  isOverlapping?: boolean;
  /** Number of clients sharing this node */
  overlapCount?: number;
  /** Whether to show the label */
  showLabel?: boolean;
  /** Whether the node is currently hovered */
  isHovered?: boolean;
  /** Whether the node is currently selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: (entity: Entity) => void;
  /** Hover handler */
  onHover?: (entity: Entity | null) => void;
}

/**
 * Node component renders an entity as an animated circle on the SVG canvas.
 * Uses Framer Motion for smooth entrance and interaction animations.
 */
export function Node({
  entity,
  position,
  size = 14,
  isOverlapping = false,
  overlapCount = 0,
  showLabel = true,
  isHovered = false,
  isSelected = false,
  onClick,
  onHover,
}: NodeProps) {
  // Determine visual properties based on entity type
  const getNodeColor = (): { fill: string; stroke: string } => {
    switch (entity.type) {
      case 'person':
        return { fill: '#667eea', stroke: '#4f46e5' };
      case 'firm':
        return { fill: '#10b981', stroke: '#059669' };
      case 'fund':
        return { fill: '#f59e0b', stroke: '#d97706' };
      default:
        return { fill: '#6b7280', stroke: '#4b5563' };
    }
  };

  const colors = getNodeColor();
  
  // Scale size based on overlap count
  const baseSize = size;
  const actualSize = isOverlapping 
    ? baseSize + Math.min(overlapCount * 2, 8) 
    : baseSize;

  // Animation variants
  const nodeVariants = {
    initial: { 
      scale: 0, 
      opacity: 0 
    },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
        delay: Math.random() * 0.3, // Stagger effect
      }
    },
    hover: { 
      scale: 1.2,
      transition: { duration: 0.2 }
    },
    tap: { 
      scale: 0.95 
    },
  };

  const glowVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: { 
      scale: [1, 1.3, 1],
      opacity: [0.4, 0.2, 0.4],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }
    },
  };

  return (
    <motion.g
      className="network-node"
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(entity)}
      onMouseEnter={() => onHover?.(entity)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Glow effect for overlapping nodes */}
      {isOverlapping && (
        <motion.circle
          cx={position.x}
          cy={position.y}
          r={actualSize + 8}
          fill={colors.fill}
          variants={glowVariants}
        />
      )}

      {/* Selection ring */}
      {(isSelected || isHovered) && (
        <motion.circle
          cx={position.x}
          cy={position.y}
          r={actualSize + 5}
          fill="none"
          stroke={isSelected ? '#1f2937' : colors.stroke}
          strokeWidth={2}
          strokeDasharray="4 2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.6, scale: 1 }}
        />
      )}

      {/* Main node circle */}
      <motion.circle
        cx={position.x}
        cy={position.y}
        r={actualSize}
        fill={colors.fill}
        stroke={isSelected ? '#1f2937' : '#fff'}
        strokeWidth={isSelected ? 3 : 2}
        variants={nodeVariants}
        style={{
          filter: isOverlapping ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
        }}
      />

      {/* Entity type icon */}
      <motion.text
        x={position.x}
        y={position.y}
        dy={1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize={actualSize * 0.8}
        fontWeight={600}
        style={{ pointerEvents: 'none' }}
        variants={nodeVariants}
      >
        {entity.type === 'person' ? '●' : entity.type === 'firm' ? '■' : '◆'}
      </motion.text>

      {/* Overlap count badge */}
      {isOverlapping && overlapCount > 1 && (
        <motion.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <circle
            cx={position.x + actualSize - 2}
            cy={position.y - actualSize + 2}
            r={9}
            fill="#1f2937"
            stroke="#fff"
            strokeWidth={1.5}
          />
          <text
            x={position.x + actualSize - 2}
            y={position.y - actualSize + 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize={9}
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {overlapCount > 9 ? '9+' : overlapCount}
          </text>
        </motion.g>
      )}

      {/* Label */}
      {showLabel && (
        <motion.text
          x={position.x}
          y={position.y + actualSize + 14}
          textAnchor="middle"
          fill="#374151"
          fontSize={11}
          fontWeight={isOverlapping ? 600 : 500}
          style={{ 
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0, y: position.y + actualSize + 5 }}
          animate={{ opacity: 1, y: position.y + actualSize + 14 }}
          transition={{ delay: 0.2 }}
        >
          {entity.label.length > 12 ? entity.label.slice(0, 12) + '...' : entity.label}
        </motion.text>
      )}
    </motion.g>
  );
}

export default Node;
