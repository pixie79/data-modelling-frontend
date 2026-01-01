/**
 * Data Flow Service
 * Handles API interactions for data flow diagram CRUD operations
 */

import { apiClient } from './apiClient';
import type { DataFlowDiagram } from '@/types/dataflow';
import type {
  ListDataFlowDiagramsResponse,
  GetDataFlowDiagramResponse,
  CreateDataFlowDiagramRequest,
  CreateDataFlowDiagramResponse,
  UpdateDataFlowDiagramRequest,
  UpdateDataFlowDiagramResponse,
} from '@/types/api';

class DataFlowService {
  /**
   * List all data flow diagrams for a workspace
   */
  async listDataFlowDiagrams(workspaceId: string): Promise<DataFlowDiagram[]> {
    const response = await apiClient.getClient().get<ListDataFlowDiagramsResponse>(
      `/api/v1/workspaces/${workspaceId}/data-flow-diagrams`
    );
    return response.data.diagrams;
  }

  /**
   * Get a single data flow diagram by ID
   */
  async getDataFlowDiagram(workspaceId: string, diagramId: string): Promise<DataFlowDiagram> {
    const response = await apiClient.getClient().get<GetDataFlowDiagramResponse>(
      `/api/v1/workspaces/${workspaceId}/data-flow-diagrams/${diagramId}`
    );
    return response.data.diagram;
  }

  /**
   * Create a new data flow diagram
   */
  async createDataFlowDiagram(
    workspaceId: string,
    request: CreateDataFlowDiagramRequest
  ): Promise<DataFlowDiagram> {
    const response = await apiClient.getClient().post<CreateDataFlowDiagramResponse>(
      `/api/v1/workspaces/${workspaceId}/data-flow-diagrams`,
      request
    );
    return response.data.diagram;
  }

  /**
   * Update an existing data flow diagram
   */
  async updateDataFlowDiagram(
    workspaceId: string,
    diagramId: string,
    request: UpdateDataFlowDiagramRequest
  ): Promise<DataFlowDiagram> {
    const response = await apiClient.getClient().put<UpdateDataFlowDiagramResponse>(
      `/api/v1/workspaces/${workspaceId}/data-flow-diagrams/${diagramId}`,
      request
    );
    return response.data.diagram;
  }

  /**
   * Delete a data flow diagram
   */
  async deleteDataFlowDiagram(workspaceId: string, diagramId: string): Promise<void> {
    await apiClient.getClient().delete(`/api/v1/workspaces/${workspaceId}/data-flow-diagrams/${diagramId}`);
  }
}

// Export singleton instance
export const dataFlowService = new DataFlowService();

