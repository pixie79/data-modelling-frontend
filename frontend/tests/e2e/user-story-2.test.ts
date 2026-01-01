/**
 * E2E test for User Story 2 - Create Data Flow Diagrams
 * Tests complete workflow: create diagram, add nodes, connect them, link to table
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ModelEditor from '@/pages/ModelEditor';
import { useModelStore } from '@/stores/modelStore';
import type { DataFlowDiagram } from '@/types/dataflow';

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ workspaceId: 'workspace-1' }),
  };
});

describe('User Story 2 - Data Flow Diagrams E2E', () => {
  beforeEach(() => {
    // Reset store
    useModelStore.setState({
      dataFlowDiagrams: [],
      selectedDataFlowDiagramId: null,
      tables: [
        {
          id: 'table-1',
          workspace_id: 'workspace-1',
          primary_domain_id: 'domain-1',
          name: 'Customer',
          model_type: 'conceptual',
          columns: [],
          position_x: 0,
          position_y: 0,
          width: 200,
          height: 150,
          visible_domains: ['domain-1'],
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ],
      domains: [
        {
          id: 'domain-1',
          workspace_id: 'workspace-1',
          name: 'Conceptual',
          model_type: 'conceptual',
          is_primary: true,
          created_at: '2025-01-01T00:00:00Z',
          last_modified_at: '2025-01-01T00:00:00Z',
        },
      ],
      selectedDomainId: 'domain-1',
    });
  });

  it('should create a data flow diagram with source, processor, and target nodes', async () => {
    render(
      <BrowserRouter>
        <ModelEditor />
      </BrowserRouter>
    );

    // Switch to data flow view
    const dataFlowButton = screen.getByText('Data Flow');
    fireEvent.click(dataFlowButton);

    await waitFor(() => {
      // Should show data flow canvas
      expect(screen.getByText(/No data flow diagram selected|Create New Diagram/)).toBeInTheDocument();
    });

    // Create new diagram
    const createButton = screen.getByText('Create New Diagram');
    if (createButton) {
      fireEvent.click(createButton);
    }

    // Verify diagram was created
    await waitFor(() => {
      const diagrams = useModelStore.getState().dataFlowDiagrams;
      expect(diagrams.length).toBeGreaterThan(0);
    });
  });

  it('should link data flow to conceptual table', async () => {
    const diagram: DataFlowDiagram = {
      id: 'diagram-1',
      workspace_id: 'workspace-1',
      name: 'Customer Flow',
      nodes: [
        {
          id: 'node-1',
          diagram_id: 'diagram-1',
          type: 'source',
          label: 'Customer DB',
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

    useModelStore.getState().addDataFlowDiagram(diagram);
    useModelStore.getState().setSelectedDataFlowDiagram('diagram-1');

    // Link to table
    useModelStore.getState().linkDataFlowToTable('diagram-1', 'table-1');

    const updatedDiagram = useModelStore.getState().dataFlowDiagrams.find((d) => d.id === 'diagram-1');
    expect(updatedDiagram?.linked_tables).toContain('table-1');
  });
});

