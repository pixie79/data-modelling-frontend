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
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  initialPosition?: { x: number; y: number };
}

export const DraggableModal: React.FC<DraggableModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  initialPosition,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>(
    initialPosition || { x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 200 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    md: 'w-[400px] max-w-[90vw]', // Reduced by 20% from 500px
    lg: 'w-[700px] max-w-[90vw]',
    xl: 'w-[900px] max-w-[90vw]',
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
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

      {/* Draggable Modal */}
      <div
        ref={modalRef}
        className={`fixed bg-white rounded-lg shadow-2xl ${sizeClasses[size]} max-h-[90vh] flex flex-col`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
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
          className="flex-1 overflow-y-auto p-6"
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
      </div>
    </div>
  );
};
