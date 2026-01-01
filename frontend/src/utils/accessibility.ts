/**
 * Accessibility utilities
 * Provides ARIA helpers and keyboard navigation support
 */

/**
 * Generate unique ID for ARIA attributes
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get ARIA label for table
 */
export function getTableAriaLabel(tableName: string, columnCount: number): string {
  return `${tableName}, table with ${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`;
}

/**
 * Get ARIA label for relationship
 */
export function getRelationshipAriaLabel(
  sourceTable: string,
  targetTable: string,
  type: string
): string {
  return `Relationship from ${sourceTable} to ${targetTable}, type ${type}`;
}

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  return focusableSelectors.some((selector) => element.matches(selector));
}

/**
 * Trap focus within an element
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = Array.from(
    element.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') {
      return;
    }

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Handle keyboard navigation for arrow keys
 */
export function handleArrowKeyNavigation(
  currentIndex: number,
  items: unknown[],
  direction: 'up' | 'down' | 'left' | 'right',
  onSelect: (index: number) => void
): number | null {
  let newIndex = currentIndex;

  switch (direction) {
    case 'up':
    case 'left':
      newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      break;
    case 'down':
    case 'right':
      newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      break;
  }

  if (newIndex !== currentIndex) {
    onSelect(newIndex);
    return newIndex;
  }

  return null;
}

