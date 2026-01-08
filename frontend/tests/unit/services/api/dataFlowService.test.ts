/**
 * Unit tests for Data Flow Service
 * Tests CRUD operations for data flow diagrams
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataFlowService } from '@/services/api/dataFlowService';
import type { DataFlowDiagram } from '@/types/dataflow';
import type {
  ListDataFlowDiagramsResponse,
  GetDataFlowDiagramResponse,
  CreateDataFlowDiagramRequest,
  CreateDataFlowDiagramResponse,
  UpdateDataFlowDiagramRequest,
  UpdateDataFlowDiagramResponse,
} from '@/types/api';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/services/api/apiClient', () => ({
  apiClient: {
    getClient: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    })),
  },
}));

describe('DataFlowService', () => {
  const workspaceId = 'workspace-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listDataFlowDiagrams', () => {
    it('should fetch all data flow diagrams for a workspace', async () => {
      const mockDiagrams: DataFlowDiagram[] = [
        {
          id: 'diagram-1',
          workspace_id: workspaceId,
          name: 'Customer Data Flow',
          nodes: [],
          connections: [],
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ];

      const mockResponse: ListDataFlowDiagramsResponse = {
        diagrams: mockDiagrams,
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
      } as any);

      const result = await dataFlowService.listDataFlowDiagrams(workspaceId);

      expect(mockGet).toHaveBeenCalledWith(`/api/v1/workspaces/${workspaceId}/data-flow-diagrams`);
      expect(result).toEqual(mockDiagrams);
    });

    it('should handle empty list of diagrams', async () => {
      const mockResponse: ListDataFlowDiagramsResponse = {
        diagrams: [],
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
      } as any);

      const result = await dataFlowService.listDataFlowDiagrams(workspaceId);

      expect(result).toEqual([]);
    });
  });

  describe('getDataFlowDiagram', () => {
    it('should fetch a single data flow diagram', async () => {
      const diagramId = 'diagram-1';
      const mockDiagram: DataFlowDiagram = {
        id: diagramId,
        workspace_id: workspaceId,
        name: 'Customer Data Flow',
        nodes: [],
        connections: [],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const mockResponse: GetDataFlowDiagramResponse = {
        diagram: mockDiagram,
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
      } as any);

      const result = await dataFlowService.getDataFlowDiagram(workspaceId, diagramId);

      expect(mockGet).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/data-flow-diagrams/${diagramId}`
      );
      expect(result).toEqual(mockDiagram);
    });
  });

  describe('createDataFlowDiagram', () => {
    it('should create a new data flow diagram', async () => {
      const request: CreateDataFlowDiagramRequest = {
        name: 'New Data Flow',
        nodes: [
          {
            type: 'source',
            label: 'Source DB',
            position_x: 100,
            position_y: 100,
            width: 150,
            height: 100,
          },
        ],
        connections: [],
      };

      const mockDiagram: DataFlowDiagram = {
        id: 'diagram-1',
        workspace_id: workspaceId,
        name: 'New Data Flow',
        nodes: [
          {
            id: 'node-1',
            diagram_id: 'diagram-1',
            type: 'source',
            label: 'Source DB',
            position_x: 100,
            position_y: 100,
            width: 150,
            height: 100,
          },
        ],
        connections: [],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      const mockResponse: CreateDataFlowDiagramResponse = {
        diagram: mockDiagram,
      };

      mockPost.mockResolvedValue({
        data: mockResponse,
      } as any);

      const result = await dataFlowService.createDataFlowDiagram(workspaceId, request);

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/data-flow-diagrams`,
        request
      );
      expect(result).toEqual(mockDiagram);
    });

    it('should create diagram with nodes and connections', async () => {
      const request: CreateDataFlowDiagramRequest = {
        name: 'Complex Flow',
        nodes: [
          {
            type: 'source',
            label: 'Source',
            position_x: 0,
            position_y: 0,
          },
          {
            type: 'processor',
            label: 'Processor',
            position_x: 200,
            position_y: 0,
          },
          {
            type: 'target',
            label: 'Target',
            position_x: 400,
            position_y: 0,
          },
        ],
        connections: [
          {
            source_node_id: 'node-1',
            target_node_id: 'node-2',
            label: 'Data Flow',
          },
        ],
      };

      const mockDiagram: DataFlowDiagram = {
        id: 'diagram-1',
        workspace_id: workspaceId,
        name: 'Complex Flow',
        nodes: [
          {
            id: 'node-1',
            diagram_id: 'diagram-1',
            type: 'source',
            label: 'Source',
            position_x: 0,
            position_y: 0,
            width: 150,
            height: 100,
          },
          {
            id: 'node-2',
            diagram_id: 'diagram-1',
            type: 'processor',
            label: 'Processor',
            position_x: 200,
            position_y: 0,
            width: 150,
            height: 100,
          },
          {
            id: 'node-3',
            diagram_id: 'diagram-1',
            type: 'target',
            label: 'Target',
            position_x: 400,
            position_y: 0,
            width: 150,
            height: 100,
          },
        ],
        connections: [
          {
            id: 'conn-1',
            diagram_id: 'diagram-1',
            source_node_id: 'node-1',
            target_node_id: 'node-2',
            label: 'Data Flow',
          },
        ],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T00:00:00Z',
      };

      mockPost.mockResolvedValue({
        data: { diagram: mockDiagram },
      } as any);

      const result = await dataFlowService.createDataFlowDiagram(workspaceId, request);

      expect(result.nodes).toHaveLength(3);
      expect(result.connections).toHaveLength(1);
    });
  });

  describe('updateDataFlowDiagram', () => {
    it('should update an existing data flow diagram', async () => {
      const diagramId = 'diagram-1';
      const request: UpdateDataFlowDiagramRequest = {
        name: 'Updated Name',
      };

      const mockDiagram: DataFlowDiagram = {
        id: diagramId,
        workspace_id: workspaceId,
        name: 'Updated Name',
        nodes: [],
        connections: [],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T01:00:00Z',
      };

      const mockResponse: UpdateDataFlowDiagramResponse = {
        diagram: mockDiagram,
      };

      mockPut.mockResolvedValue({
        data: mockResponse,
      } as any);

      const result = await dataFlowService.updateDataFlowDiagram(workspaceId, diagramId, request);

      expect(mockPut).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/data-flow-diagrams/${diagramId}`,
        request
      );
      expect(result).toEqual(mockDiagram);
    });

    it('should update nodes and connections', async () => {
      const diagramId = 'diagram-1';
      const request: UpdateDataFlowDiagramRequest = {
        nodes: [
          {
            id: 'node-1',
            position_x: 150,
            position_y: 150,
          },
        ],
        connections: [
          {
            id: 'conn-1',
            label: 'Updated Label',
          },
        ],
      };

      const mockDiagram: DataFlowDiagram = {
        id: diagramId,
        workspace_id: workspaceId,
        name: 'Test Diagram',
        nodes: [
          {
            id: 'node-1',
            diagram_id: diagramId,
            type: 'source',
            label: 'Source',
            position_x: 150,
            position_y: 150,
            width: 150,
            height: 100,
          },
        ],
        connections: [
          {
            id: 'conn-1',
            diagram_id: diagramId,
            source_node_id: 'node-1',
            target_node_id: 'node-2',
            label: 'Updated Label',
          },
        ],
        created_at: '2025-01-01T00:00:00Z',
        last_modified_at: '2025-01-01T01:00:00Z',
      };

      mockPut.mockResolvedValue({
        data: { diagram: mockDiagram },
      } as any);

      const result = await dataFlowService.updateDataFlowDiagram(workspaceId, diagramId, request);

      expect(result.nodes[0].position_x).toBe(150);
      expect(result.connections[0].label).toBe('Updated Label');
    });
  });

  describe('deleteDataFlowDiagram', () => {
    it('should delete a data flow diagram', async () => {
      const diagramId = 'diagram-1';

      mockDelete.mockResolvedValue({
        status: 204,
      } as any);

      await dataFlowService.deleteDataFlowDiagram(workspaceId, diagramId);

      expect(mockDelete).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/data-flow-diagrams/${diagramId}`
      );
    });
  });
});
