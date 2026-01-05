/**
 * Custom Edge Component with Crowfoot Notation Support
 * Renders relationship edges with proper cardinality markers (arrows and crowfeet)
 */

import React from 'react'
import { BaseEdge, EdgeProps, useEdges, useNodes } from 'reactflow'
import type { Relationship } from '@/types/relationship'
import { RelationshipCardinality } from '@/types/relationship'

interface CardinalityEdgeData {
  relationship: Relationship
}

export const CardinalityEdge: React.FC<EdgeProps<CardinalityEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data,
}) => {
  // Get all edges and nodes to detect crossings
  const allEdges = useEdges()
  const allNodes = useNodes()
  
  // Helper function to get node connection point coordinates
  const getNodeConnectionPoint = (nodeId: string, position: string): { x: number; y: number } => {
    const node = allNodes.find(n => n.id === nodeId)
    if (!node) {
      return { x: 0, y: 0 }
    }
    
    // Get node dimensions (default if not available)
    const width = (node.width as number) || 200
    const height = (node.height as number) || 150
    
    const nodeX = node.position.x
    const nodeY = node.position.y
    
    // Calculate connection point based on position
    switch (position) {
      case 'left':
        return { x: nodeX, y: nodeY + height / 2 }
      case 'right':
        return { x: nodeX + width, y: nodeY + height / 2 }
      case 'top':
        return { x: nodeX + width / 2, y: nodeY }
      case 'bottom':
        return { x: nodeX + width / 2, y: nodeY + height }
      default:
        return { x: nodeX + width / 2, y: nodeY + height / 2 }
    }
  }
  
  // Cardinality symbols are rendered at offsets up to ~20px, so extend perpendicular for 30px to clear them
  const perpendicularOffset = 30
  const hopOverHeight = 10 // Height of hop-over arc
  
  // Helper function to check if two line segments intersect
  const lineSegmentsIntersect = (
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): { intersects: boolean; x?: number; y?: number; t?: number } => {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if (Math.abs(denom) < 1e-10) return { intersects: false } // Parallel lines
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
    
    // Check if intersection is within both segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const ix = x1 + t * (x2 - x1)
      const iy = y1 + t * (y2 - y1)
      return { intersects: true, x: ix, y: iy, t }
    }
    return { intersects: false }
  }
  
  // Extract line segments from a path string (M and L commands)
  const extractPathSegments = (path: string): Array<{x1: number, y1: number, x2: number, y2: number}> => {
    const segments: Array<{x1: number, y1: number, x2: number, y2: number}> = []
    const commands = path.match(/[ML][\s]*[\d.-]+[\s,]+[\d.-]+/g) || []
    
    let lastX: number = 0
    let lastY: number = 0
    
    for (const cmd of commands) {
      const coords = cmd.substring(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
      if (coords.length >= 2) {
        const x: number = coords[0] ?? 0
        const y: number = coords[1] ?? 0
        
        if (cmd.startsWith('M')) {
          lastX = x
          lastY = y
        } else if (cmd.startsWith('L')) {
          segments.push({ x1: lastX, y1: lastY, x2: x, y2: y })
          lastX = x
          lastY = y
        }
      }
    }
    
    return segments
  }
  
  // Build path for another edge (same logic as current edge)
  const buildOtherEdgePath = (
    otherSourceX: number, otherSourceY: number,
    otherTargetX: number, otherTargetY: number,
    otherSourcePosition: string, otherTargetPosition: string
  ): string => {
    // Calculate perpendicular direction from source
    let perpDirX = 0
    let perpDirY = 0
    
    switch (otherSourcePosition) {
      case 'left':
        perpDirX = -1
        perpDirY = 0
        break
      case 'right':
        perpDirX = 1
        perpDirY = 0
        break
      case 'top':
        perpDirX = 0
        perpDirY = -1
        break
      case 'bottom':
        perpDirX = 0
        perpDirY = 1
        break
      default: {
        const dx = otherTargetX - otherSourceX
        const dy = otherTargetY - otherSourceY
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 0) {
          perpDirX = -dy / len
          perpDirY = dx / len
        }
        break
      }
    }
    
    const perpX1 = otherSourceX + perpDirX * perpendicularOffset
    const perpY1 = otherSourceY + perpDirY * perpendicularOffset
    
    // Calculate perpendicular direction from target
    let targetPerpDirX = 0
    let targetPerpDirY = 0
    
    switch (otherTargetPosition) {
      case 'left':
        targetPerpDirX = -1
        targetPerpDirY = 0
        break
      case 'right':
        targetPerpDirX = 1
        targetPerpDirY = 0
        break
      case 'top':
        targetPerpDirX = 0
        targetPerpDirY = -1
        break
      case 'bottom':
        targetPerpDirX = 0
        targetPerpDirY = 1
        break
      default: {
        const dx = otherTargetX - otherSourceX
        const dy = otherTargetY - otherSourceY
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 0) {
          targetPerpDirX = dy / len
          targetPerpDirY = -dx / len
        }
        break
      }
    }
    
    const perpX2 = otherTargetX + targetPerpDirX * perpendicularOffset
    const perpY2 = otherTargetY + targetPerpDirY * perpendicularOffset
    
    let path = `M ${otherSourceX} ${otherSourceY} L ${perpX1} ${perpY1}`
    
    const isSourceSide = otherSourcePosition === 'left' || otherSourcePosition === 'right'
    const isTargetSide = otherTargetPosition === 'left' || otherTargetPosition === 'right'
    
    if (isSourceSide && isTargetSide) {
      path += ` L ${perpX2} ${perpY1}`
      if (Math.abs(perpY1 - perpY2) > 1) {
        path += ` L ${perpX2} ${perpY2}`
      }
    } else if (!isSourceSide && !isTargetSide) {
      path += ` L ${perpX1} ${perpY2}`
      if (Math.abs(perpX1 - perpX2) > 1) {
        path += ` L ${perpX2} ${perpY2}`
      }
    } else {
      if (isSourceSide) {
        path += ` L ${perpX2} ${perpY1} L ${perpX2} ${perpY2}`
      } else {
        path += ` L ${perpX1} ${perpY2} L ${perpX2} ${perpY2}`
      }
    }
    
    path += ` L ${perpX2} ${perpY2} L ${otherTargetX} ${otherTargetY}`
    return path
  }
  
  // Build custom path that goes perpendicular from table, then routes to target
  const buildPerpendicularPath = (): [string, number, number] => {
    // Calculate perpendicular direction from source
    let perpDirX = 0
    let perpDirY = 0
    
    switch (sourcePosition) {
      case 'left':
        perpDirX = -1  // Go left (perpendicular outward)
        perpDirY = 0
        break
      case 'right':
        perpDirX = 1   // Go right (perpendicular outward)
        perpDirY = 0
        break
      case 'top':
        perpDirX = 0
        perpDirY = -1  // Go up (perpendicular outward)
        break
      case 'bottom':
        perpDirX = 0
        perpDirY = 1   // Go down (perpendicular outward)
        break
      default: {
        // Fallback: calculate perpendicular based on edge direction
        const dx = targetX - sourceX
        const dy = targetY - sourceY
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 0) {
          // Perpendicular is rotated 90 degrees
          perpDirX = -dy / len
          perpDirY = dx / len
        }
        break
      }
    }
    
    // First point: extend perpendicular from source
    const perpX1 = sourceX + perpDirX * perpendicularOffset
    const perpY1 = sourceY + perpDirY * perpendicularOffset
    
    // Calculate perpendicular direction from target (inward)
    let targetPerpDirX = 0
    let targetPerpDirY = 0
    
    switch (targetPosition) {
      case 'left':
        targetPerpDirX = -1  // Coming from left (perpendicular inward)
        targetPerpDirY = 0
        break
      case 'right':
        targetPerpDirX = 1   // Coming from right (perpendicular inward)
        targetPerpDirY = 0
        break
      case 'top':
        targetPerpDirX = 0
        targetPerpDirY = -1   // Coming from top (perpendicular inward)
        break
      case 'bottom':
        targetPerpDirX = 0
        targetPerpDirY = 1    // Coming from bottom (perpendicular inward)
        break
      default: {
        // Fallback: calculate perpendicular based on edge direction
        const dx = targetX - sourceX
        const dy = targetY - sourceY
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 0) {
          // Perpendicular is rotated 90 degrees (opposite direction for target)
          targetPerpDirX = dy / len
          targetPerpDirY = -dx / len
        }
        break
      }
    }
    
    // Last point before target: extend perpendicular from target
    const perpX2 = targetX + targetPerpDirX * perpendicularOffset
    const perpY2 = targetY + targetPerpDirY * perpendicularOffset
    
    // Build path: source -> perpendicular from source -> route horizontally/vertically -> perpendicular to target -> target
    let path = `M ${sourceX} ${sourceY} L ${perpX1} ${perpY1}`
    
    // Route horizontally/vertically between perpendicular points
    // For side-to-side (left/right): route horizontally, then vertically if needed
    // For top/bottom: route vertically, then horizontally if needed
    // For mixed: route in L-shape
    
    const isSourceSide = sourcePosition === 'left' || sourcePosition === 'right'
    const isTargetSide = targetPosition === 'left' || targetPosition === 'right'
    
    if (isSourceSide && isTargetSide) {
      // Both on sides (left/right): route horizontally first, then vertically to align Y
      path += ` L ${perpX2} ${perpY1}`
      // Then route vertically to target's perpendicular Y
      if (Math.abs(perpY1 - perpY2) > 1) {
        path += ` L ${perpX2} ${perpY2}`
      }
    } else if (!isSourceSide && !isTargetSide) {
      // Both on top/bottom: route vertically first, then horizontally to align X
      path += ` L ${perpX1} ${perpY2}`
      // Then route horizontally to target's perpendicular X
      if (Math.abs(perpX1 - perpX2) > 1) {
        path += ` L ${perpX2} ${perpY2}`
      }
    } else {
      // Mixed (side to top/bottom or vice versa): route in L-shape
      if (isSourceSide) {
        // Source on side: route horizontally first, then vertically
        path += ` L ${perpX2} ${perpY1} L ${perpX2} ${perpY2}`
      } else {
        // Source on top/bottom: route vertically first, then horizontally
        path += ` L ${perpX1} ${perpY2} L ${perpX2} ${perpY2}`
      }
    }
    
    // Final segment: perpendicular to target, then to target
    path += ` L ${perpX2} ${perpY2} L ${targetX} ${targetY}`
    
    // Detect intersections with other edges and add hop-over arcs
    const mySegments = extractPathSegments(path)
    const intersections: Array<{x: number, y: number, segmentIndex: number, t: number}> = []
    
    // Check each segment against other edges
    for (let segIdx = 0; segIdx < mySegments.length; segIdx++) {
      const seg = mySegments[segIdx]
      
      // Check against other edges (skip self)
      for (const otherEdge of allEdges) {
        if (otherEdge.id === id) continue
        if (otherEdge.type !== 'cardinality') continue // Only check cardinality edges
        
        // Get node connection points for other edge
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const otherSourcePos = (otherEdge as any).sourcePosition ?? 'bottom'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const otherTargetPos = (otherEdge as any).targetPosition ?? 'top'
        const otherSourcePoint = getNodeConnectionPoint(otherEdge.source, otherSourcePos)
        const otherTargetPoint = getNodeConnectionPoint(otherEdge.target, otherTargetPos)
        
        const otherSourceX = otherSourcePoint.x
        const otherSourceY = otherSourcePoint.y
        const otherTargetX = otherTargetPoint.x
        const otherTargetY = otherTargetPoint.y
        
        // Build path for other edge
        const otherPath = buildOtherEdgePath(
          otherSourceX,
          otherSourceY,
          otherTargetX,
          otherTargetY,
          otherSourcePos,
          otherTargetPos
        )
        
        const otherSegments = extractPathSegments(otherPath)
        
        // Check intersection with each segment of the other edge
        for (const otherSeg of otherSegments) {
          if (!seg) continue
          const intersection = lineSegmentsIntersect(
            seg.x1, seg.y1, seg.x2, seg.y2,
            otherSeg.x1, otherSeg.y1, otherSeg.x2, otherSeg.y2
          )
          
          if (intersection.intersects && intersection.x !== undefined && intersection.y !== undefined && intersection.t !== undefined) {
            // Only add if intersection is not too close to segment endpoints (avoid issues at corners)
            if (intersection.t > 0.1 && intersection.t < 0.9) {
              intersections.push({
                x: intersection.x,
                y: intersection.y,
                segmentIndex: segIdx,
                t: intersection.t
              })
            }
          }
        }
      }
    }
    
    // Sort intersections by segment index and position along segment
    intersections.sort((a, b) => {
      if (a.segmentIndex !== b.segmentIndex) {
        return a.segmentIndex - b.segmentIndex
      }
      return a.t - b.t
    })
    
    // Rebuild path with hop-over arcs at intersections
    if (intersections.length > 0) {
      // Group intersections by segment
      const intersectionsBySegment = new Map<number, Array<{x: number, y: number, t: number}>>()
      for (const intersection of intersections) {
        if (!intersectionsBySegment.has(intersection.segmentIndex)) {
          intersectionsBySegment.set(intersection.segmentIndex, [])
        }
        intersectionsBySegment.get(intersection.segmentIndex)!.push({
          x: intersection.x,
          y: intersection.y,
          t: intersection.t
        })
      }
      
      // Sort intersections within each segment by t value
      for (const [, segIntersections] of intersectionsBySegment.entries()) {
        segIntersections.sort((a, b) => a.t - b.t)
      }
      
      // Rebuild path segment by segment
      const firstSegment = mySegments[0]
      if (!firstSegment) {
        // Return original path if no segments
        return [path, (perpX1 + perpX2) / 2, (perpY1 + perpY2) / 2]
      }
      
      let newPath = `M ${firstSegment.x1} ${firstSegment.y1}`
      
      for (let segIdx = 0; segIdx < mySegments.length; segIdx++) {
        const seg = mySegments[segIdx]
        if (!seg) continue
        
        const segIntersections = intersectionsBySegment.get(segIdx) || []
        
        if (segIntersections.length === 0) {
          // No intersections on this segment - add it normally
          newPath += ` L ${seg.x2} ${seg.y2}`
        } else {
          // Process segment with intersections
          for (let i = 0; i < segIntersections.length; i++) {
            const intersection = segIntersections[i]
            if (!intersection) continue
            
            // Calculate point before intersection
            const beforeT = Math.max(0, intersection.t - 0.15)
            const beforeX = seg.x1 + beforeT * (seg.x2 - seg.x1)
            const beforeY = seg.y1 + beforeT * (seg.y2 - seg.y1)
            
            // Calculate point after intersection
            const afterT = Math.min(1, intersection.t + 0.15)
            const afterX = seg.x1 + afterT * (seg.x2 - seg.x1)
            const afterY = seg.y1 + afterT * (seg.y2 - seg.y1)
            
            // Determine hop-over direction (perpendicular to segment, going up/right)
            const segDx = seg.x2 - seg.x1
            const segDy = seg.y2 - seg.y1
            const segLen = Math.sqrt(segDx * segDx + segDy * segDy)
            // Perpendicular vector (rotated 90 degrees counterclockwise)
            const perpX = segLen > 0 ? -segDy / segLen : 0
            const perpY = segLen > 0 ? segDx / segLen : 1
            
            // Arc control point (above intersection)
            const arcX = intersection.x + perpX * hopOverHeight
            const arcY = intersection.y + perpY * hopOverHeight
            
            // Add line to before point
            newPath += ` L ${beforeX} ${beforeY}`
            // Add quadratic curve for hop-over arc
            newPath += ` Q ${arcX} ${arcY} ${afterX} ${afterY}`
          }
          
          // Add line from last intersection to segment end
          if (segIntersections.length > 0) {
            const lastIntersection = segIntersections[segIntersections.length - 1]
            if (lastIntersection) {
              const afterT = Math.min(1, lastIntersection.t + 0.15)
              
              // Only add if we haven't reached the end
              if (afterT < 1) {
                newPath += ` L ${seg.x2} ${seg.y2}`
              }
            }
          }
        }
      }
      
      path = newPath
    }
    
    // Label position at midpoint of the horizontal/vertical segment
    const labelX = (perpX1 + perpX2) / 2
    const labelY = (perpY1 + perpY2) / 2
    
    return [path, labelX, labelY]
  }
  
  // Build path with perpendicular routing
  const [edgePath, labelX, labelY] = buildPerpendicularPath()

  const relationship = data?.relationship
  
  // Normalize cardinality from backend format ("OneToMany") to frontend enum format ("One-to-Many")
  const normalizeCardinality = (cardinalityValue: string | undefined): string | undefined => {
    if (!cardinalityValue) return undefined
    
    // If it's already in frontend format (has dashes), return as-is
    if (cardinalityValue.includes('-')) {
      return cardinalityValue
    }
    
    // Map backend PascalCase to frontend enum format
    const mapping: Record<string, string> = {
      'OneToOne': RelationshipCardinality.ONE_TO_ONE,
      'OneToMany': RelationshipCardinality.ONE_TO_MANY,
      'ManyToOne': RelationshipCardinality.MANY_TO_ONE,
      'ManyToMany': RelationshipCardinality.MANY_TO_MANY,
    }
    
    return mapping[cardinalityValue] || cardinalityValue
  }
  
  // Derive cardinality from relationship type
  const cardinality = relationship?.type 
    ? normalizeCardinality(relationship.type === 'one-to-one' ? 'OneToOne' : 
                           relationship.type === 'one-to-many' ? 'OneToMany' :
                           relationship.type === 'many-to-many' ? 'ManyToMany' : undefined)
    : undefined

  // Determine what markers to show based on cardinality and optionality (Crow's Foot Notation)
  // According to https://www.red-gate.com/blog/crow-s-foot-notation:
  // - "One" = single perpendicular line (mandatory) or circle (optional)
  // - "Many" = three-pronged crowfoot symbol
  // - Optional = empty circle (shown before the multiplicity symbol)
  // - Mandatory = straight line (shown before the multiplicity symbol)
  let showStartCrowfoot = false  // Many at source
  let showStartLine = false      // One at source (mandatory)
  let showStartOptional = false  // Optional at source (circle)
  let showEndCrowfoot = false    // Many at target
  let showEndLine = false        // One at target (mandatory)
  let showEndOptional = false    // Optional at target (circle)

  // Get optionality flags from cardinality (if '0' then optional, otherwise mandatory)
  const sourceOptional = relationship?.source_cardinality === '0'
  const targetOptional = relationship?.target_cardinality === '0'

  if (cardinality === RelationshipCardinality.ONE_TO_MANY) {
    // One-to-Many: [optionality] + [one] at source, [optionality] + [crowfoot] at target
    // For "one" at source: if optional, show circle + line; if mandatory, show two parallel lines
    if (sourceOptional) {
      showStartOptional = true  // Circle for optional
      showStartLine = true      // Line for "one" (combined = "zero or one")
    } else {
      showStartLine = true      // Two parallel lines for "one and one only" (mandatory)
    }
    if (targetOptional) {
      showEndOptional = true
    }
    showEndCrowfoot = true
  } else if (cardinality === RelationshipCardinality.MANY_TO_ONE) {
    // Many-to-One: [optionality] + [crowfoot] at source, [optionality] + [one] at target
    if (sourceOptional) {
      showStartOptional = true
    }
    showStartCrowfoot = true
    // For "one" at target: if optional, show circle + line; if mandatory, show two parallel lines
    if (targetOptional) {
      showEndOptional = true    // Circle for optional
      showEndLine = true        // Line for "one" (combined = "zero or one")
    } else {
      showEndLine = true        // Two parallel lines for "one and one only" (mandatory)
    }
  } else if (cardinality === RelationshipCardinality.MANY_TO_MANY) {
    // Many-to-Many: [optionality] + [crowfoot] at both ends
    if (sourceOptional) {
      showStartOptional = true
    }
    showStartCrowfoot = true
    if (targetOptional) {
      showEndOptional = true
    }
    showEndCrowfoot = true
  } else if (cardinality === RelationshipCardinality.ONE_TO_ONE) {
    // One-to-One: [optionality] + [one] at both ends
    // For "one" at source: if optional, show circle + line; if mandatory, show two parallel lines
    if (sourceOptional) {
      showStartOptional = true  // Circle for optional
      showStartLine = true      // Line for "one" (combined = "zero or one")
    } else {
      showStartLine = true      // Two parallel lines for "one and one only" (mandatory)
    }
    // For "one" at target: if optional, show circle + line; if mandatory, show two parallel lines
    if (targetOptional) {
      showEndOptional = true    // Circle for optional
      showEndLine = true        // Line for "one" (combined = "zero or one")
    } else {
      showEndLine = true        // Two parallel lines for "one and one only" (mandatory)
    }
  }

  // Debug logging (reduced - only log if there's an issue)
  if (import.meta.env.DEV && cardinality && !showStartCrowfoot && !showEndCrowfoot && !showStartLine && !showEndLine) {
    console.warn('[CardinalityEdge] Cardinality set but no symbols rendered:', {
      id,
      cardinality,
      showStartCrowfoot,
      showEndCrowfoot,
      showStartLine,
      showEndLine,
    })
  }

  // Render a circle for optional relationships
  // According to Crow's Foot Notation: an empty circle indicates optional relationship
  // The circle appears closer to the entity (before the multiplicity symbol)
  // For crowfoot: circle sits where mandatory line would be (1px gap from crow's foot)
  const renderOptionalCircle = (x: number, y: number, angle: number, isForCrowfoot: boolean = false, position?: string) => {
    const radius = 4.86 // Reduced by another 10% from 5.4 (was 6, now 4.86)
    const angleRad = (angle * Math.PI) / 180
    
    let centerX: number
    let centerY: number
    
    if (isForCrowfoot && position) {
      // For crowfoot: circle should be level with center of line and 1px to the right of crow's foot point
      const offsetDistance = 15 // Same as crowfoot base point offset
      const offsetX = Math.cos(angleRad) * offsetDistance
      const offsetY = Math.sin(angleRad) * offsetDistance
      
      const baseX = x + offsetX // Crow's foot base point
      const baseY = y + offsetY // Level with center of line
      
      // Position circle 6px to the right of crow's foot point (along edge direction, toward target)
      // Edge direction vector (normalized)
      const edgeDirX = Math.cos(angleRad)
      // edgeDirY not used but kept for clarity
      
      // Circle center: same Y as base (level with line), 6px to the right along edge direction (moved 1px right from 5px)
      const gapFromCrowfoot = 6
      centerX = baseX + gapFromCrowfoot * edgeDirX
      centerY = baseY // Keep same Y to be level with center of line
    } else {
      // For "one" relationships: offset from connection point along the edge direction
      // Circle should be closer to entity (smaller offset) than multiplicity symbol
      // Lowered by 2px (was 6px, now 8px)
      const offsetDistance = 8
      const offsetX = Math.cos(angleRad) * offsetDistance
      const offsetY = Math.sin(angleRad) * offsetDistance
      
      centerX = x + offsetX
      centerY = y + offsetY
    }
    
    return (
      <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="none"
        stroke="#000"
        strokeWidth="2"
      />
    )
  }

  // Render perpendicular line(s) for "one" relationships
  // - If optional: single line (circle is rendered separately, closer to entity)
  // - If mandatory: two parallel lines (for "one and one only")
  // According to Crow's Foot Notation: 
  // - "Zero or One" (optional) = circle + single perpendicular line
  // - "One and One only" (mandatory) = two parallel perpendicular lines
  const renderOneLine = (x: number, y: number, angle: number, isOptional: boolean, position: string) => {
    const lineLength = 16 // Reduced by 20% from 20 (for mandatory one-to-one lines)
    const lineSpacing = 8  // Spacing between two parallel lines for mandatory (reduced from 10)
    const angleRad = (angle * Math.PI) / 180
    
    // Calculate perpendicular direction based on connection position
    // For top/bottom: edge is vertical, perpendicular is horizontal (lines side by side)
    // For left/right: edge is horizontal, perpendicular is vertical (lines stacked)
    let perpAngleRad: number
    if (position === 'top' || position === 'bottom') {
      // Edge is vertical, perpendicular is horizontal
      perpAngleRad = angleRad + Math.PI / 2
    } else {
      // Edge is horizontal, perpendicular is vertical
      perpAngleRad = angleRad - Math.PI / 2
    }
    const perpX = Math.cos(perpAngleRad)
    const perpY = Math.sin(perpAngleRad)
    
    // Offset from connection point along the edge direction
    // When optional: line should be further from entity than circle (circle is at 8px, line at 16px - lowered by 2px)
    // When mandatory: line is at 12px (raised by 2px from 14px)
    const offsetDistance = isOptional ? 16 : 12
    const offsetX = Math.cos(angleRad) * offsetDistance
    const offsetY = Math.sin(angleRad) * offsetDistance
    
    const centerX = x + offsetX
    const centerY = y + offsetY
    
    if (isOptional) {
      // Optional + One: single line perpendicular to edge (circle is rendered separately at 8px offset)
      const halfLength = lineLength / 2
      const startX = centerX - halfLength * perpX
      const startY = centerY - halfLength * perpY
      const endX = centerX + halfLength * perpX
      const endY = centerY + halfLength * perpY
      
      return (
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#000"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )
    } else {
      // Mandatory + One: two parallel lines perpendicular to edge (for "one and one only")
      // Lines should be stacked vertically (one above the other)
      const halfLength = lineLength / 2
      const halfSpacing = lineSpacing / 2
      
      // Calculate spacing direction based on connection position
      // For top/bottom: stack along edge direction (vertical stacking)
      // For left/right: stack along edge direction (horizontal stacking)
      // The lines themselves are always perpendicular to the edge
      const spacingDirX = Math.cos(angleRad)
      const spacingDirY = Math.sin(angleRad)
      // Use asymmetric spacing to raise the bottom line
      // Top line offset: full halfSpacing
      // Bottom line offset: reduced to raise it up (60% of halfSpacing)
      const topOffsetX = halfSpacing * spacingDirX
      const topOffsetY = halfSpacing * spacingDirY
      const bottomOffsetX = halfSpacing * 0.6 * spacingDirX
      const bottomOffsetY = halfSpacing * 0.6 * spacingDirY
      
      // First line (offset in one direction - stacked above)
      const center1X = centerX - topOffsetX
      const center1Y = centerY - topOffsetY
      const start1X = center1X - halfLength * perpX
      const start1Y = center1Y - halfLength * perpY
      const end1X = center1X + halfLength * perpX
      const end1Y = center1Y + halfLength * perpY
      
      // Second line (offset in opposite direction - stacked below, raised up)
      const center2X = centerX + bottomOffsetX
      const center2Y = centerY + bottomOffsetY
      const start2X = center2X - halfLength * perpX
      const start2Y = center2Y - halfLength * perpY
      const end2X = center2X + halfLength * perpX
      const end2Y = center2Y + halfLength * perpY
      
      return (
        <g>
          <line
            x1={start1X}
            y1={start1Y}
            x2={end1X}
            y2={end1Y}
            stroke="#000"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1={start2X}
            y1={start2Y}
            x2={end2X}
            y2={end2Y}
            stroke="#000"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )
    }
  }

  // Render crowfoot (three-pronged symbol) for "many" relationships
  // According to Crow's Foot Notation: three lines that fan out from a point (like a bird's foot)
  // For mandatory "many": the 4th line replaces the bottom line of the crowfoot
  const renderCrowfoot = (x: number, y: number, angle: number, _isSource: boolean, position: string, isMandatory: boolean = false) => {
    const lineLength = 11.52 // Reduced by 25% from 15.36 (was 24, now 11.52)
    // fanAngle not used but kept for documentation
    const angleRad = (angle * Math.PI) / 180
    
    // Calculate perpendicular direction based on connection position
    // For top/bottom: edge is vertical, perpendicular is horizontal (lines side by side)
    // For left/right: edge is horizontal, perpendicular is vertical (lines stacked)
    let perpAngleRad: number
    if (position === 'top' || position === 'bottom') {
      // Edge is vertical, perpendicular is horizontal
      perpAngleRad = angleRad + Math.PI / 2
    } else {
      // Edge is horizontal, perpendicular is vertical
      perpAngleRad = angleRad - Math.PI / 2
    }
    const perpX = Math.cos(perpAngleRad)
    const perpY = Math.sin(perpAngleRad)
    
    // Offset from connection point along the edge direction
    // For source: offset away from node (edge leaving)
    // For target: offset toward node (edge entering)
    // Crowfoot should be further from entity (larger offset) than optionality circle
    // Adjusted offset to move slanted lines right (reduce left offset)
    const offsetDistance = 15 // Reduced by 1px to move crow's foot higher
    const offsetX = Math.cos(angleRad) * offsetDistance
    const offsetY = Math.sin(angleRad) * offsetDistance
    
    // Base point where crowfoot lines converge (on the edge)
    const baseX = x + offsetX
    const baseY = y + offsetY
    
    // Calculate the three crowfoot lines that fan out
    // All lines join at the base point (top)
    // Central line: points in the direction of the edge (down when link points down)
    // Left line: 40 degrees to the left of central
    // Right line: 40 degrees to the right of central
    // Rotated 180 degrees so central points up instead of down
    // 40 degrees = 40 * Math.PI / 180 = Math.PI / 4.5 ≈ 0.698 radians
    const fanAngleRad = (40 * Math.PI) / 180 // 40 degrees in radians
    const rotation = Math.PI // 180 degrees rotation
    const centralAngle = angleRad + rotation // Central line points opposite to edge direction (up)
    const leftAngle = centralAngle - fanAngleRad // 40 degrees to the left
    const rightAngle = centralAngle + fanAngleRad // 40 degrees to the right
    
    // Calculate spacing direction for the mandatory line
    // For top/bottom: stack along edge direction (vertical)
    // For left/right: stack along perpendicular direction (vertical)
    let spacingDirX: number
    let spacingDirY: number
    if (position === 'top' || position === 'bottom') {
      // Stack along edge direction (vertical)
      spacingDirX = Math.cos(angleRad)
      spacingDirY = Math.sin(angleRad)
    } else {
      // Stack along perpendicular direction (vertical)
      spacingDirX = perpX
      spacingDirY = perpY
    }

    return (
      <g>
        {/* Central line: points down (in edge direction), joining at top (base point) */}
        {(() => {
          const centralDirX = Math.cos(centralAngle)
          const centralDirY = Math.sin(centralAngle)
          // Line starts at base point and extends outward
          const startX = baseX
          const startY = baseY
          const endX = baseX + lineLength * centralDirX
          const endY = baseY + lineLength * centralDirY
          
          return (
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#000"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )
        })()}
        
        {/* Left line: 40 degrees to the left of central, joining at top (base point) */}
        {(() => {
          const leftDirX = Math.cos(leftAngle)
          const leftDirY = Math.sin(leftAngle)
          // Line starts at base point and extends outward
          const startX = baseX
          const startY = baseY
          const endX = baseX + lineLength * leftDirX
          const endY = baseY + lineLength * leftDirY
          
          return (
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#000"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )
        })()}
        
        {/* Right line: 40 degrees to the right of central, joining at top (base point) */}
        {(() => {
          const rightDirX = Math.cos(rightAngle)
          const rightDirY = Math.sin(rightAngle)
          // Line starts at base point and extends outward
          const startX = baseX
          const startY = baseY
          const endX = baseX + lineLength * rightDirX
          const endY = baseY + lineLength * rightDirY
          
          return (
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#000"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )
        })()}
        
        {/* Mandatory line: parallel to the unrotated perpendicular, positioned on top of crow's foot */}
        {isMandatory && (() => {
          // Position at base point (moved 2px higher from previous 2px below position)
          // For many-to-many mandatory, this line should be at the base point
          const gapOffset = 0
          const mandatoryCenterX = baseX + gapOffset * spacingDirX
          const mandatoryCenterY = baseY + gapOffset * spacingDirY
          
          // Use unrotated perpendicular direction for mandatory line
          const mandatoryDirX = Math.cos(perpAngleRad)
          const mandatoryDirY = Math.sin(perpAngleRad)
          const startX = mandatoryCenterX - (lineLength / 2) * mandatoryDirX
          const startY = mandatoryCenterY - (lineLength / 2) * mandatoryDirY
          const endX = mandatoryCenterX + (lineLength / 2) * mandatoryDirX
          const endY = mandatoryCenterY + (lineLength / 2) * mandatoryDirY
          
          return (
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#000"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )
        })()}
      </g>
    )
  }

  // Calculate edge direction at connection points
  // The angle represents the direction the edge is traveling at that point
  const getEdgeDirection = (position: string, isSource: boolean): number => {
    // Calculate the actual edge direction vector
    const dx = targetX - sourceX
    const dy = targetY - sourceY
    
    // Base angle from source to target (in degrees)
    const baseAngle = Math.atan2(dy, dx) * (180 / Math.PI)
    
    // For smooth step edges, the direction at connection points depends on the position
    // For source: edge leaves the node, direction depends on which side it exits
    // For target: edge enters the node, direction is opposite of which side it enters
    switch (position) {
      case 'top':
        // Edge leaving/entering from top: going up (270°) or coming from above (270°)
        return 270
      case 'bottom':
        // Edge leaving/entering from bottom: going down (90°) or coming from below (90°)
        return 90
      case 'left':
        // Edge leaving/entering from left: going left (180°) or coming from left (180°)
        return 180
      case 'right':
        // Edge leaving/entering from right: going right (0°) or coming from right (0°)
        return 0
      default:
        // Fallback: use calculated direction
        // For source: angle points toward target
        // For target: angle points from source (opposite direction)
        return isSource ? baseAngle : (baseAngle + 180) % 360
    }
  }

  const sourceAngle = getEdgeDirection(sourcePosition, true)
  const targetAngle = getEdgeDirection(targetPosition, false)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        // Hide default markers when showing custom Crow's Foot symbols
        markerEnd={(showEndCrowfoot || showEndLine) ? undefined : markerEnd}
        markerStart={(showStartCrowfoot || showStartLine) ? undefined : markerStart}
      />
      {/* Render Crow's Foot Notation symbols */}
      {/* Source side: optionality symbol (circle) appears first, then multiplicity */}
      {showStartOptional && renderOptionalCircle(sourceX, sourceY, sourceAngle, showStartCrowfoot, sourcePosition)}
      {showStartCrowfoot && renderCrowfoot(sourceX, sourceY, sourceAngle, true, sourcePosition, !sourceOptional)}
      {showStartLine && renderOneLine(sourceX, sourceY, sourceAngle, showStartOptional, sourcePosition)}
      {/* Target side: optionality symbol (circle) appears first, then multiplicity */}
      {showEndOptional && renderOptionalCircle(targetX, targetY, targetAngle, showEndCrowfoot, targetPosition)}
      {showEndCrowfoot && renderCrowfoot(targetX, targetY, targetAngle, false, targetPosition, !targetOptional)}
      {showEndLine && renderOneLine(targetX, targetY, targetAngle, showEndOptional, targetPosition)}
      
      {/* Relationship label */}
      {relationship?.label && (
        <g>
          {/* Label background */}
          <rect
            x={labelX - (relationship.label.length * 3.5)}
            y={labelY - 10}
            width={relationship.label.length * 7}
            height={20}
            fill="white"
            stroke="#e5e7eb"
            strokeWidth={1}
            rx={4}
            className="pointer-events-none"
          />
          {/* Label text */}
          <text
            x={labelX}
            y={labelY}
            className="text-xs fill-gray-700 pointer-events-none"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontWeight: 500 }}
          >
            {relationship.label}
          </text>
        </g>
      )}
    </>
  )
}
