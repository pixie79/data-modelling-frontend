/**
 * Collaboration Store
 * Manages collaboration state (presence, permissions, conflicts) using Zustand
 */

import { create } from 'zustand';
import type { CursorPosition } from '@/services/websocket/collaborationService';

export interface CollaborationParticipant {
  userId: string;
  userName?: string;
  userEmail?: string;
  cursorPosition?: CursorPosition;
  selectedElements?: string[];
  lastSeen: string; // ISO timestamp
  accessLevel: 'read' | 'edit';
  canvasOwnership?: string[]; // Array of domain IDs where user is primary owner
}

export interface CollaborationSession {
  workspaceId: string;
  primaryOwnerId: string;
  participants: CollaborationParticipant[];
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

interface CollaborationState {
  session: CollaborationSession | null;
  currentUserId: string | null;
  conflicts: Array<{
    id: string;
    elementType: 'table' | 'relationship' | 'data_flow_diagram';
    elementId: string;
    message: string;
    timestamp: string;
  }>;

  // Actions
  setSession: (session: CollaborationSession | null) => void;
  setCurrentUserId: (userId: string | null) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  addParticipant: (participant: CollaborationParticipant) => void;
  updateParticipant: (userId: string, updates: Partial<CollaborationParticipant>) => void;
  removeParticipant: (userId: string) => void;
  updateParticipantPresence: (userId: string, cursorPosition?: CursorPosition, selectedElements?: string[]) => void;
  addConflict: (conflict: {
    elementType: 'table' | 'relationship' | 'data_flow_diagram';
    elementId: string;
    message: string;
    timestamp: string;
  }) => void;
  removeConflict: (conflictId: string) => void;
  clearConflicts: () => void;
  
  // Computed
  getParticipants: () => CollaborationParticipant[];
  getParticipant: (userId: string) => CollaborationParticipant | undefined;
  isPrimaryOwner: (userId: string, domainId: string) => boolean;
  hasEditAccess: (userId: string, domainId: string) => boolean;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  session: null,
  currentUserId: null,
  conflicts: [],

  setSession: (session) => set({ session }),
  
  setCurrentUserId: (userId) => set({ currentUserId: userId }),
  
  setConnectionStatus: (status) =>
    set((state) => ({
      session: state.session
        ? {
            ...state.session,
            isConnected: status === 'connected',
            connectionStatus: status,
          }
        : null,
    })),

  addParticipant: (participant) =>
    set((state) => {
      if (!state.session) return state;
      
      const existingIndex = state.session.participants.findIndex((p) => p.userId === participant.userId);
      if (existingIndex >= 0) {
        // Update existing participant
        const updatedParticipants = [...state.session.participants];
        updatedParticipants[existingIndex] = participant;
        return {
          session: {
            ...state.session,
            participants: updatedParticipants,
          },
        };
      }
      
      return {
        session: {
          ...state.session,
          participants: [...state.session.participants, participant],
        },
      };
    }),

  updateParticipant: (userId, updates) =>
    set((state) => {
      if (!state.session) return state;
      
      return {
        session: {
          ...state.session,
          participants: state.session.participants.map((p) =>
            p.userId === userId ? { ...p, ...updates } : p
          ),
        },
      };
    }),

  removeParticipant: (userId) =>
    set((state) => {
      if (!state.session) return state;
      
      return {
        session: {
          ...state.session,
          participants: state.session.participants.filter((p) => p.userId !== userId),
        },
      };
    }),

  updateParticipantPresence: (userId, cursorPosition, selectedElements) =>
    set((state) => {
      if (!state.session) return state;
      
      return {
        session: {
          ...state.session,
          participants: state.session.participants.map((p) =>
            p.userId === userId
              ? {
                  ...p,
                  cursorPosition,
                  selectedElements,
                  lastSeen: new Date().toISOString(),
                }
              : p
          ),
        },
      };
    }),

  addConflict: (conflict) =>
    set((state) => ({
      conflicts: [
        ...state.conflicts,
        {
          id: `conflict-${Date.now()}-${Math.random()}`,
          ...conflict,
        },
      ],
    })),

  removeConflict: (conflictId) =>
    set((state) => ({
      conflicts: state.conflicts.filter((c) => c.id !== conflictId),
    })),

  clearConflicts: () => set({ conflicts: [] }),

  // Computed getters
  getParticipants: () => {
    const state = get();
    return state.session?.participants || [];
  },

  getParticipant: (userId) => {
    const state = get();
    return state.session?.participants.find((p) => p.userId === userId);
  },

  isPrimaryOwner: (userId, domainId) => {
    const state = get();
    const participant = state.session?.participants.find((p) => p.userId === userId);
    return participant?.canvasOwnership?.includes(domainId) ?? false;
  },

  hasEditAccess: (userId, domainId) => {
    const state = get();
    const participant = state.session?.participants.find((p) => p.userId === userId);
    if (!participant) return false;
    
    // Primary owner always has edit access
    if (participant.canvasOwnership?.includes(domainId)) return true;
    
    // Check access level
    return participant.accessLevel === 'edit';
  },
}));

