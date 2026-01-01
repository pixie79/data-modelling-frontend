/**
 * UI Store
 * Manages UI state (modals, toasts, theme, etc.) using Zustand
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface UIState {
  // Modals
  isDialogOpen: boolean;
  dialogContent: React.ReactNode | null;
  
  // Toasts
  toasts: Toast[];
  
  // Theme
  theme: 'light' | 'dark';
  
  // Sidebar
  isSidebarOpen: boolean;
  
  // Loading states
  isGlobalLoading: boolean;
  loadingMessage: string | null;

  // Actions
  openDialog: (content: React.ReactNode) => void;
  closeDialog: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setGlobalLoading: (isLoading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isDialogOpen: false,
  dialogContent: null,
  toasts: [],
  theme: 'light',
  isSidebarOpen: true,
  isGlobalLoading: false,
  loadingMessage: null,

  openDialog: (content) => set({ isDialogOpen: true, dialogContent: content }),
  closeDialog: () => set({ isDialogOpen: false, dialogContent: null }),
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    
    // Auto-remove toast after duration (default 5 seconds)
    const duration = toast.duration || 5000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  setGlobalLoading: (isLoading, message) =>
    set({ isGlobalLoading: isLoading, loadingMessage: message || null }),
}));

