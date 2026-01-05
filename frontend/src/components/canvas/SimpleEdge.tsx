/**
 * Simple Edge Component
 * Renders simple relationships (non-table-to-table) with arrow heads and labels
 * Routes around nodes and adds hop bumps for crossing edges
 */

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, useEdges, useNodes } from 'reactflow';
import type { Relationship } from '@/types/relationship';

interface SimpleEdgeData {
  relationship: Relationship;
}

export const SimpleEdge: React.FC<EdgeProps<SimpleEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}) => {
  const allEdges = useEdges();
  const allNodes = useNodes();
  
  // Helper function to get node bounding box
  const getNodeBounds = (nodeId: string): { x: number, y: number, width: number, height: number } | null => {
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    const width = (node.width as number) || 200;
    const height = (node.height as number) || 150;
    
    return {
      x: node.position.x,
      y: node.position.y,
      width,
      height,
    };
  };

  // Check if a point is inside a node bounding box
  // Note: Currently unused but kept for future routing logic
  // const isPointInNode = (x: number, y: number, nodeId: string): boolean => {
  //   const bounds = getNodeBounds(nodeId);
  //   if (!bounds) return false;
  //   
  //   return x >= bounds.x && x <= bounds.x + bounds.width &&
  //          y >= bounds.y && y <= bounds.y + bounds.height;
  // };

  // Calculate perpendicular offset from node (similar to CardinalityEdge)
  const perpendicularOffset = 30;
  
  // Calculate perpendicular direction from source
  let perpDirX = 0;
  let perpDirY = 0;
  
  switch (sourcePosition) {
    case 'left':
      perpDirX = -1;
      perpDirY = 0;
      break;
    case 'right':
      perpDirX = 1;
      perpDirY = 0;
      break;
    case 'top':
      perpDirX = 0;
      perpDirY = -1;
      break;
    case 'bottom':
      perpDirX = 0;
      perpDirY = 1;
      break;
    default: {
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        perpDirX = -dy / len;
        perpDirY = dx / len;
      }
      break;
    }
  }
  
  // Calculate perpendicular direction from target
  let targetPerpDirX = 0;
  let targetPerpDirY = 0;
  
  switch (targetPosition) {
    case 'left':
      targetPerpDirX = -1;
      targetPerpDirY = 0;
      break;
    case 'right':
      targetPerpDirX = 1;
      targetPerpDirY = 0;
      break;
    case 'top':
      targetPerpDirX = 0;
      targetPerpDirY = -1;
      break;
    case 'bottom':
      targetPerpDirX = 0;
      targetPerpDirY = 1;
      break;
    default: {
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        targetPerpDirX = dy / len;
        targetPerpDirY = -dx / len;
      }
      break;
    }
  }
  
  // First point: extend perpendicular from source
  const perpX1 = sourceX + perpDirX * perpendicularOffset;
  const perpY1 = sourceY + perpDirY * perpendicularOffset;
  
  // Last point before target: extend perpendicular from target
  const perpX2 = targetX + targetPerpDirX * perpendicularOffset;
  const perpY2 = targetY + targetPerpDirY * perpendicularOffset;
  
  // Build path: source -> perpendicular from source -> route -> perpendicular to target -> target
  const isSourceSide = sourcePosition === 'left' || sourcePosition === 'right';
  const isTargetSide = targetPosition === 'left' || targetPosition === 'right';
  
  let path = `M ${sourceX} ${sourceY} L ${perpX1} ${perpY1}`;
  
  if (isSourceSide && isTargetSide) {
    // Both on sides: route horizontally first, then vertically
    path += ` L ${perpX2} ${perpY1}`;
    if (Math.abs(perpY1 - perpY2) > 1) {
      path += ` L ${perpX2} ${perpY2}`;
    }
  } else if (!isSourceSide && !isTargetSide) {
    // Both on top/bottom: route vertically first, then horizontally
    path += ` L ${perpX1} ${perpY2}`;
    if (Math.abs(perpX1 - perpX2) > 1) {
      path += ` L ${perpX2} ${perpY2}`;
    }
  } else {
    // Mixed: route in L-shape
    if (isSourceSide) {
      path += ` L ${perpX2} ${perpY1} L ${perpX2} ${perpY2}`;
    } else {
      path += ` L ${perpX1} ${perpY2} L ${perpX2} ${perpY2}`;
    }
  }
  
  path += ` L ${perpX2} ${perpY2} L ${targetX} ${targetY}`;
  
  // Label position at midpoint
  const labelX = (perpX1 + perpX2) / 2;
  const labelY = (perpY1 + perpY2) / 2;
  
  const edgePath = path;

  const relationship = data?.relationship;
  const label = relationship?.label;

  // Arrow marker ID (unique per edge)
  const markerId = `arrow-${id}`;

  // Edge style with arrow
  const edgeStyle = {
    ...style,
    stroke: selected ? '#3b82f6' : '#6b7280',
    strokeWidth: selected ? 3 : 2,
  };

  // Helper function to check if two line segments intersect
  const lineSegmentsIntersect = (
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): { intersects: boolean; x?: number; y?: number; t?: number } => {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return { intersects: false };
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const ix = x1 + t * (x2 - x1);
      const iy = y1 + t * (y2 - y1);
      return { intersects: true, x: ix, y: iy, t };
    }
    return { intersects: false };
  };

  // Extract line segments from path
  const extractPathSegments = (path: string): Array<{x1: number, y1: number, x2: number, y2: number}> => {
    const segments: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
    const commands = path.match(/[ML][\s]*[\d.-]+[\s,]+[\d.-]+/g) || [];
    
    let lastX = 0;
    let lastY = 0;
    
    for (const cmd of commands) {
      const coords = cmd.substring(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      if (coords.length >= 2) {
        const x = coords[0] ?? 0;
        const y = coords[1] ?? 0;
        
        if (cmd.startsWith('M')) {
          lastX = x;
          lastY = y;
        } else if (cmd.startsWith('L')) {
          segments.push({ x1: lastX, y1: lastY, x2: x, y2: y });
          lastX = x;
          lastY = y;
        }
      }
    }
    
    return segments;
  };

  // Detect intersections with other edges and add hop bumps
  const mySegments = extractPathSegments(edgePath);
  const intersections: Array<{x: number, y: number, segmentIndex: number, t: number}> = [];
  const hopOverHeight = 10;

  for (let segIdx = 0; segIdx < mySegments.length; segIdx++) {
    const seg = mySegments[segIdx];
    if (!seg) continue;
    
    for (const otherEdge of allEdges) {
      if (otherEdge.id === id) continue;
      
      // Get other edge's path
      const otherPath = otherEdge.path || '';
      const otherSegments = extractPathSegments(otherPath);
      
      for (const otherSeg of otherSegments) {
        const intersection = lineSegmentsIntersect(
          seg.x1, seg.y1, seg.x2, seg.y2,
          otherSeg.x1, otherSeg.y1, otherSeg.x2, otherSeg.y2
        );
        
        if (intersection.intersects && intersection.x !== undefined && intersection.y !== undefined && intersection.t !== undefined) {
          if (intersection.t > 0.1 && intersection.t < 0.9) {
            intersections.push({
              x: intersection.x,
              y: intersection.y,
              segmentIndex: segIdx,
              t: intersection.t,
            });
          }
        }
      }
    }
  }

  // Sort intersections by segment index and position
  intersections.sort((a, b) => {
    if (a.segmentIndex !== b.segmentIndex) {
      return a.segmentIndex - b.segmentIndex;
    }
    return a.t - b.t;
  });

  // Rebuild path with hop bumps at intersections
  let finalPath = edgePath;
  if (intersections.length > 0) {
    const intersectionsBySegment = new Map<number, Array<{x: number, y: number, t: number}>>();
    for (const intersection of intersections) {
      if (!intersectionsBySegment.has(intersection.segmentIndex)) {
        intersectionsBySegment.set(intersection.segmentIndex, []);
      }
      intersectionsBySegment.get(intersection.segmentIndex)!.push({
        x: intersection.x,
        y: intersection.y,
        t: intersection.t,
      });
    }

    const firstSegment = mySegments[0];
    if (firstSegment) {
      let newPath = `M ${firstSegment.x1} ${firstSegment.y1}`;
      
      for (let segIdx = 0; segIdx < mySegments.length; segIdx++) {
        const seg = mySegments[segIdx];
        if (!seg) continue;
        
        const segIntersections = intersectionsBySegment.get(segIdx) || [];
        
        if (segIntersections.length === 0) {
          newPath += ` L ${seg.x2} ${seg.y2}`;
        } else {
          // Process segment with intersections
          let currentX = seg.x1;
          let currentY = seg.y1;
          
          for (let i = 0; i < segIntersections.length; i++) {
            const intersection = segIntersections[i];
            if (!intersection) continue;
            
            // Calculate point before intersection
            const beforeX = seg.x1 + (seg.x2 - seg.x1) * (intersection.t - 0.1);
            const beforeY = seg.y1 + (seg.y2 - seg.y1) * (intersection.t - 0.1);
            
            // Calculate point after intersection
            const afterX = seg.x1 + (seg.x2 - seg.x1) * (intersection.t + 0.1);
            const afterY = seg.y1 + (seg.y2 - seg.y1) * (intersection.t + 0.1);
            
            // Calculate perpendicular direction for hop bump
            const dx = seg.x2 - seg.x1;
            const dy = seg.y2 - seg.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpX = len > 0 ? -dy / len : 0;
            const perpY = len > 0 ? dx / len : 0;
            
            // Hop bump arc
            const hopX = intersection.x + perpX * hopOverHeight;
            const hopY = intersection.y + perpY * hopOverHeight;
            
            newPath += ` L ${beforeX} ${beforeY}`;
            newPath += ` Q ${intersection.x} ${intersection.y} ${hopX} ${hopY}`;
            newPath += ` Q ${intersection.x} ${intersection.y} ${afterX} ${afterY}`;
            
            currentX = afterX;
            currentY = afterY;
          }
          
          // Add final segment to end
          if (currentX !== seg.x2 || currentY !== seg.y2) {
            newPath += ` L ${seg.x2} ${seg.y2}`;
          }
        }
      }
      
      finalPath = newPath;
    }
  }

  return (
    <>
      {/* Define arrow marker - small arrowhead */}
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M0,0 L7,4 L0,8 Z"
            fill={selected ? '#3b82f6' : '#6b7280'}
          />
        </marker>
      </defs>

      {/* Edge path with arrow */}
      <BaseEdge
        id={id}
        path={finalPath}
        style={edgeStyle}
        markerEnd={`url(#${markerId})`}
      />

      {/* Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan text-xs bg-white border border-gray-300 rounded-md px-2 py-1 shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

