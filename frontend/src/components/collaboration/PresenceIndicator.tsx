/**
 * Presence Indicator Component
 * Shows who's online and what they're editing
 */

import React, { useMemo } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useAuth } from '@/components/auth/AuthProvider';

export interface PresenceIndicatorProps {
  workspaceId: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = () => {
  const { getParticipants, session } = useCollaborationStore();
  const { user } = useAuth();
  const participants = getParticipants();

  // Filter out current user
  const otherParticipants = useMemo(() => {
    if (!user?.id) return participants;
    return participants.filter((p) => p.userId !== user.id);
  }, [participants, user?.id]);

  if (!session || !session.isConnected) {
    return null;
  }

  if (otherParticipants.length === 0) {
    return (
      <div className="px-3 py-1 text-xs text-gray-500" title="No other users online">
        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
        You are alone
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg">
      <span className="text-xs text-gray-600">
        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
        {otherParticipants.length} {otherParticipants.length === 1 ? 'user' : 'users'} online
      </span>
      <div className="flex items-center gap-1">
        {otherParticipants.slice(0, 3).map((participant) => (
          <div
            key={participant.userId}
            className="relative group"
            title={`${participant.userName || participant.userEmail || participant.userId} - ${participant.accessLevel === 'edit' ? 'Editing' : 'Viewing'}`}
          >
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
              {(participant.userName || participant.userEmail || participant.userId).charAt(0).toUpperCase()}
            </div>
            {participant.selectedElements && participant.selectedElements.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white"></div>
            )}
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              {participant.userName || participant.userEmail || participant.userId}
              {participant.selectedElements && participant.selectedElements.length > 0 && (
                <div className="text-xs text-gray-300 mt-1">
                  Editing: {participant.selectedElements.length} {participant.selectedElements.length === 1 ? 'element' : 'elements'}
                </div>
              )}
            </div>
          </div>
        ))}
        {otherParticipants.length > 3 && (
          <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs">
            +{otherParticipants.length - 3}
          </div>
        )}
      </div>
    </div>
  );
};

