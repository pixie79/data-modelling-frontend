/**
 * Collaboration Service
 * Handles real-time collaboration features via WebSocket
 */

import { WebSocketClient, type WebSocketMessage } from './websocketClient';

export interface TableUpdateData {
  name?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface RelationshipUpdateData {
  source_cardinality?: import('@/types/relationship').Cardinality;
  target_cardinality?: import('@/types/relationship').Cardinality;
  label?: string;
  [key: string]: unknown;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface TableUpdateEvent {
  tableId: string;
  data: TableUpdateData;
  userId: string;
  timestamp: string;
}

export interface RelationshipUpdateEvent {
  relationshipId: string;
  data: RelationshipUpdateData;
  userId: string;
  timestamp: string;
}

export interface PresenceUpdateEvent {
  userId: string;
  cursorPosition?: CursorPosition;
  selectedElements?: string[];
  timestamp: string;
}

export interface ConflictEvent {
  elementType: 'table' | 'relationship' | 'data_flow_diagram';
  elementId: string;
  message: string;
  timestamp: string;
}

export type TableUpdateHandler = (event: TableUpdateEvent) => void;
export type RelationshipUpdateHandler = (event: RelationshipUpdateEvent) => void;
export type PresenceUpdateHandler = (event: PresenceUpdateEvent) => void;
export type ConflictHandler = (event: ConflictEvent) => void;

class CollaborationService {
  private wsClient: WebSocketClient;
  private workspaceId: string;

  constructor(workspaceId: string, accessToken: string) {
    this.workspaceId = workspaceId;
    this.wsClient = new WebSocketClient(workspaceId, accessToken);
    this.setupMessageHandlers();
  }

  /**
   * Setup message handlers for WebSocket messages
   */
  private setupMessageHandlers(): void {
    // Message handlers are registered via onTableUpdate, onRelationshipUpdate, etc.
    // This method is a placeholder for future initialization logic if needed
  }

  /**
   * Send table update to other users
   */
  sendTableUpdate(tableId: string, data: TableUpdateData): void {
    this.wsClient.send({
      type: 'update_table',
      workspace_id: this.workspaceId,
      table_id: tableId,
      data,
    });
  }

  /**
   * Send relationship update to other users
   */
  sendRelationshipUpdate(relationshipId: string, data: RelationshipUpdateData): void {
    this.wsClient.send({
      type: 'update_relationship',
      workspace_id: this.workspaceId,
      relationship_id: relationshipId,
      data,
    });
  }

  /**
   * Send presence update (cursor position, selected elements)
   */
  sendPresenceUpdate(cursorPosition?: CursorPosition, selectedElements?: string[]): void {
    this.wsClient.send({
      type: 'presence_update',
      workspace_id: this.workspaceId,
      cursor_position: cursorPosition,
      selected_elements: selectedElements,
    });
  }

  /**
   * Register handler for table update events
   */
  onTableUpdate(handler: TableUpdateHandler): () => void {
    return this.wsClient.onMessage((message: WebSocketMessage) => {
      if (message.type === 'table_updated') {
        handler({
          tableId: message.table_id as string,
          data: message.data as TableUpdateData,
          userId: message.user_id as string,
          timestamp: message.timestamp as string,
        });
      }
    });
  }

  /**
   * Register handler for relationship update events
   */
  onRelationshipUpdate(handler: RelationshipUpdateHandler): () => void {
    return this.wsClient.onMessage((message: WebSocketMessage) => {
      if (message.type === 'relationship_updated') {
        handler({
          relationshipId: message.relationship_id as string,
          data: message.data as RelationshipUpdateData,
          userId: message.user_id as string,
          timestamp: message.timestamp as string,
        });
      }
    });
  }

  /**
   * Register handler for presence update events
   */
  onPresenceUpdate(handler: PresenceUpdateHandler): () => void {
    return this.wsClient.onMessage((message: WebSocketMessage) => {
      if (message.type === 'presence_update' && message.user_id) {
        handler({
          userId: message.user_id as string,
          cursorPosition: message.cursor_position as CursorPosition | undefined,
          selectedElements: message.selected_elements as string[] | undefined,
          timestamp: message.timestamp as string,
        });
      }
    });
  }

  /**
   * Register handler for conflict events
   */
  onConflict(handler: ConflictHandler): () => void {
    return this.wsClient.onMessage((message: WebSocketMessage) => {
      if (message.type === 'conflict_warning') {
        handler({
          elementType: message.element_type as 'table' | 'relationship' | 'data_flow_diagram',
          elementId: message.element_id as string,
          message: message.message as string,
          timestamp: message.timestamp as string,
        });
      }
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * Disconnect from collaboration session
   */
  disconnect(): void {
    this.wsClient.disconnect();
  }
}

export { CollaborationService };
