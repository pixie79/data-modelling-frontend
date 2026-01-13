/**
 * Canvas Export Component
 * Provides PNG export functionality for ReactFlow canvas with area selection
 * Supports high-quality export for detailed viewing
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, getNodesBounds } from 'reactflow';
import { toPng } from 'html-to-image';
import { useUIStore } from '@/stores/uiStore';

interface CanvasExportProps {
  /** Optional filename prefix for the exported image */
  filenamePrefix?: string;
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * CanvasExport component provides export functionality for the ReactFlow canvas.
 * It supports:
 * - Full canvas export (exports all visible nodes)
 * - Area selection export (user draws a rectangle to select area)
 * - High-quality PNG output (4x scale for zooming)
 */
export const CanvasExport: React.FC<CanvasExportProps> = ({ filenamePrefix = 'canvas' }) => {
  const { getNodes, getViewport } = useReactFlow();
  const { addToast } = useUIStore();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const selectionOverlayRef = useRef<HTMLDivElement>(null);

  // Filter function to exclude UI elements from export
  const filterNode = (node: HTMLElement) => {
    const className = node.className || '';
    if (typeof className === 'string') {
      return (
        !className.includes('react-flow__controls') &&
        !className.includes('react-flow__minimap') &&
        !className.includes('react-flow__attribution') &&
        !className.includes('react-flow__panel')
      );
    }
    return true;
  };

  // Export the full canvas (all nodes)
  const exportFullCanvas = useCallback(async () => {
    setShowMenu(false);
    const nodes = getNodes();

    if (nodes.length === 0) {
      addToast({
        type: 'warning',
        message: 'No nodes on canvas to export',
      });
      return;
    }

    try {
      // Get the ReactFlow viewport element - this contains the transformed content
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) {
        throw new Error('Canvas viewport not found');
      }

      // Calculate bounds of all nodes
      const nodesBounds = getNodesBounds(nodes);

      // Add padding around the bounds
      const padding = 50;

      // Calculate the image dimensions based on node bounds
      const imageWidth = nodesBounds.width + padding * 2;
      const imageHeight = nodesBounds.height + padding * 2;

      // Use higher scale for better quality (4x for crisp details)
      const scale = 4;

      addToast({
        type: 'info',
        message: 'Generating high-quality PNG...',
      });

      // Save the original transform so we can restore it after export
      const originalTransform = viewport.style.transform;

      // Set the transform to position all nodes in view with padding
      viewport.style.transform = `translate(${-nodesBounds.x + padding}px, ${-nodesBounds.y + padding}px) scale(1)`;

      try {
        // Create the PNG directly from the viewport (not a clone)
        // This preserves all CSS styles since we're capturing the live element
        const dataUrl = await toPng(viewport, {
          backgroundColor: '#ffffff',
          width: imageWidth,
          height: imageHeight,
          pixelRatio: scale,
          filter: filterNode,
          style: {
            // Ensure the viewport fills the capture area
            width: `${imageWidth}px`,
            height: `${imageHeight}px`,
          },
        });

        // Download the image
        const link = document.createElement('a');
        link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();

        addToast({
          type: 'success',
          message: 'Canvas exported successfully',
        });
      } finally {
        // Restore the original transform
        viewport.style.transform = originalTransform;
      }
    } catch (error) {
      console.error('Failed to export canvas:', error);
      addToast({
        type: 'error',
        message: `Failed to export canvas: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [getNodes, filenamePrefix, addToast]);

  // Start area selection mode
  const startAreaSelection = useCallback(() => {
    setShowMenu(false);
    setIsSelecting(true);
    setSelectionBox(null);
    addToast({
      type: 'info',
      message: 'Click and drag to select an area to export',
    });
  }, [addToast]);

  // Handle mouse down for area selection
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      setSelectionBox({
        startX,
        startY,
        endX: startX,
        endY: startY,
      });
    },
    [isSelecting]
  );

  // Handle mouse move for area selection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !selectionBox) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;

      setSelectionBox((prev) => (prev ? { ...prev, endX, endY } : null));
    },
    [isSelecting, selectionBox]
  );

  // Handle mouse up for area selection - export the selected area
  const handleMouseUp = useCallback(async () => {
    if (!isSelecting || !selectionBox) return;

    setIsSelecting(false);

    // Calculate the actual selection rectangle (screen coordinates)
    const screenX = Math.min(selectionBox.startX, selectionBox.endX);
    const screenY = Math.min(selectionBox.startY, selectionBox.endY);
    const width = Math.abs(selectionBox.endX - selectionBox.startX);
    const height = Math.abs(selectionBox.endY - selectionBox.startY);

    // Minimum size check
    if (width < 50 || height < 50) {
      addToast({
        type: 'warning',
        message: 'Selection too small. Please select a larger area.',
      });
      setSelectionBox(null);
      return;
    }

    try {
      // Get the ReactFlow viewport element
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) {
        throw new Error('Canvas viewport not found');
      }

      // Get the current viewport transform
      const currentViewport = getViewport();

      addToast({
        type: 'info',
        message: 'Generating high-quality PNG of selected area...',
      });

      // Use higher scale for better quality
      const scale = 4;

      // Convert screen coordinates to canvas coordinates
      // The selection is in screen space, we need to figure out what part of the canvas that represents
      const canvasX = (screenX - currentViewport.x) / currentViewport.zoom;
      const canvasY = (screenY - currentViewport.y) / currentViewport.zoom;
      const canvasWidth = width / currentViewport.zoom;
      const canvasHeight = height / currentViewport.zoom;

      // Save the original transform so we can restore it after export
      const originalTransform = viewport.style.transform;

      // Set the transform to show only the selected area at scale 1
      viewport.style.transform = `translate(${-canvasX}px, ${-canvasY}px) scale(1)`;

      try {
        // Create the PNG directly from the viewport (not a clone)
        // This preserves all CSS styles since we're capturing the live element
        const dataUrl = await toPng(viewport, {
          backgroundColor: '#ffffff',
          width: canvasWidth,
          height: canvasHeight,
          pixelRatio: scale,
          filter: filterNode,
          style: {
            // Ensure the viewport fills the capture area
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
          },
        });

        // Download the image
        const link = document.createElement('a');
        link.download = `${filenamePrefix}-selection-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();

        addToast({
          type: 'success',
          message: 'Selected area exported successfully',
        });
      } finally {
        // Restore the original transform
        viewport.style.transform = originalTransform;
      }
    } catch (error) {
      console.error('Failed to export selected area:', error);
      addToast({
        type: 'error',
        message: `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    setSelectionBox(null);
  }, [isSelecting, selectionBox, filenamePrefix, addToast, getViewport]);

  // Cancel selection on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelecting) {
        setIsSelecting(false);
        setSelectionBox(null);
        addToast({
          type: 'info',
          message: 'Selection cancelled',
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelecting, addToast]);

  // Calculate selection rectangle for display
  const selectionRect = selectionBox
    ? {
        left: Math.min(selectionBox.startX, selectionBox.endX),
        top: Math.min(selectionBox.startY, selectionBox.endY),
        width: Math.abs(selectionBox.endX - selectionBox.startX),
        height: Math.abs(selectionBox.endY - selectionBox.startY),
      }
    : null;

  return (
    <>
      {/* Export button - compact icon button positioned at top-right, first in stack */}
      <div className="absolute top-4 right-4 z-10">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Export canvas as PNG"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={exportFullCanvas}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                Export Full Canvas
              </button>
              <button
                onClick={startAreaSelection}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
                Select Area to Export
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selection overlay */}
      {isSelecting && (
        <div
          ref={selectionOverlayRef}
          className="absolute inset-0 z-50 cursor-crosshair"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Selection hint */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-lg text-sm text-gray-700">
            Click and drag to select area. Press{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> to cancel.
          </div>

          {/* Selection rectangle */}
          {selectionRect && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/10"
              style={{
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
                height: selectionRect.height,
              }}
            />
          )}
        </div>
      )}

      {/* Close menu when clicking outside */}
      {showMenu && <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)} />}
    </>
  );
};

export default CanvasExport;
