/**
 * Draggable Modal Component
 * A free-floating modal that can be dragged around the screen
 */

import React, { useEffect, useRef, useState } from 'react';
import { trapFocus, generateAriaId } from '@/utils/accessibility';

export interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  showCloseButton?: boolean;
  initialPosition?: { x: number; y: number };
  noPadding?: boolean;
  resizable?: boolean;
  zIndex?: number; // For stacking multiple modals
  onFocus?: () => void; // Called when modal is clicked/focused
  hideBackdrop?: boolean; // Hide backdrop for multi-modal support
}

export const DraggableModal: React.FC<DraggableModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  initialPosition,
  noPadding = false,
  resizable = false,
  zIndex = 50,
  onFocus,
  hideBackdrop = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>(
    initialPosition || { x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 200 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const hasFocusedRef = useRef(false);
  const titleId = generateAriaId('modal-title');
  const descriptionId = generateAriaId('modal-description');

  // Handle dragging
  useEffect(() => {
    if (!isDragging || !modalRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep modal within viewport bounds
      const maxX = window.innerWidth - (modalRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (modalRef.current?.offsetHeight || 0);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;

    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection while dragging
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height,
    });
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle resizing
  useEffect(() => {
    if (!isResizing || !resizeStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const newWidth = Math.max(
        400,
        Math.min(resizeStart.width + deltaX, window.innerWidth * 0.95)
      );
      const newHeight = Math.max(
        300,
        Math.min(resizeStart.height + deltaY, window.innerHeight * 0.95)
      );

      setDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart]);

  const [_hasFocused, _setHasFocused] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      hasFocusedRef.current = false;
      return;
    }

    // Trap focus when modal opens (only traps Tab navigation, doesn't auto-focus)
    const cleanup = modalRef.current ? trapFocus(modalRef.current) : undefined;

    // Focus first input field only on initial open (not on every render)
    if (!hasFocusedRef.current && modalRef.current) {
      // Use setTimeout to ensure the modal is fully rendered and avoid focus conflicts
      const focusTimeout = setTimeout(() => {
        if (!modalRef.current || hasFocusedRef.current) return;

        // Prioritize input fields, exclude close button
        const prioritySelectors = [
          'input[autofocus]',
          'input[type="text"]',
          'input[type="email"]',
          'textarea',
          'input:not([type="hidden"])',
          'select',
          'button:not([aria-label="Close modal"]):not([aria-label="Close"])',
        ];

        for (const selector of prioritySelectors) {
          const element = modalRef.current.querySelector<HTMLElement>(selector);
          if (element) {
            // Only focus if not already focused (prevents stealing focus while typing)
            if (document.activeElement !== element) {
              element.focus();
              hasFocusedRef.current = true;
            }
            return;
          }
        }
      }, 50); // Slightly longer delay to ensure modal is stable

      return () => {
        cleanup?.();
        clearTimeout(focusTimeout);
      };
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      cleanup?.();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'w-96 max-w-[90vw]',
    md: 'w-[400px] max-w-[90vw]',
    lg: 'w-[700px] max-w-[90vw]',
    xl: 'w-[900px] max-w-[90vw]',
    xxl: 'w-[1400px] max-w-[95vw]',
  };

  const defaultHeights = {
    sm: 400,
    md: 500,
    lg: 600,
    xl: 700,
    xxl: 850,
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop - only show for single modal or first modal */}
      {!hideBackdrop && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity pointer-events-auto"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClose();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close modal"
        />
      )}

      {/* Draggable Modal */}
      <div
        ref={modalRef}
        className={`fixed bg-white rounded-lg shadow-2xl ${dimensions ? '' : sizeClasses[size]} ${dimensions ? '' : 'max-h-[90vh]'} flex flex-col pointer-events-auto`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'none',
          width: dimensions ? `${dimensions.width}px` : undefined,
          height: dimensions ? `${dimensions.height}px` : `${defaultHeights[size]}px`,
          maxHeight: dimensions ? undefined : '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => onFocus?.()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header - draggable area */}
        <div
          ref={headerRef}
          onMouseDown={(e) => {
            // Don't start dragging if clicking on a button
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON' || target.closest('button')) {
              return;
            }
            handleMouseDown(e);
          }}
          className={`flex items-center justify-between p-4 border-b border-gray-200 ${
            isDragging ? 'cursor-grabbing' : 'cursor-move'
          } select-none`}
          role="banner"
          aria-label="Modal header - drag to move"
        >
          <h2 id={titleId} className="text-xl font-semibold text-gray-900 flex-1">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              tabIndex={-1}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ml-4 flex-shrink-0"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Content - scrollable */}
        <div
          id={descriptionId}
          className={`flex-1 overflow-y-auto ${noPadding ? '' : 'p-6'}`}
          style={{
            maxHeight: 'calc(90vh - 80px)',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 #f1f5f9',
          }}
        >
          <style>{`
            #${descriptionId}::-webkit-scrollbar {
              width: 8px;
            }
            #${descriptionId}::-webkit-scrollbar-track {
              background: #f1f5f9;
              border-radius: 4px;
            }
            #${descriptionId}::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
            }
            #${descriptionId}::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}</style>
          {children}
        </div>

        {/* Resize Handle */}
        {resizable && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{
              background: 'linear-gradient(135deg, transparent 50%, #94a3b8 50%)',
            }}
            title="Drag to resize"
          />
        )}
      </div>
    </div>
  );
};
