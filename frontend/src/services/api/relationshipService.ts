/**
 * Relationship Service
 * Handles API interactions for relationship CRUD operations
 */

import { apiClient } from './apiClient';
import type { Relationship } from '@/types/relationship';
import type {
  ListRelationshipsResponse,
  GetRelationshipResponse,
  CreateRelationshipRequest,
  CreateRelationshipResponse,
  UpdateRelationshipRequest,
  UpdateRelationshipResponse,
} from '@/types/api';

class RelationshipService {
  /**
   * List all relationships for a domain
   * Note: Domain must be loaded first via workspaceService.loadDomain()
   */
  async listRelationships(domain: string): Promise<Relationship[]> {
    const response = await apiClient.getClient().get<ListRelationshipsResponse>(
      `/workspace/domains/${domain}/relationships`
    );
    return response.data.relationships;
  }

  /**
   * Get a single relationship by ID
   */
  async getRelationship(
    domain: string,
    relationshipId: string
  ): Promise<Relationship> {
    const response = await apiClient.getClient().get<GetRelationshipResponse>(
      `/workspace/domains/${domain}/relationships/${relationshipId}`
    );
    return response.data.relationship;
  }

  /**
   * Create a new relationship
   */
  async createRelationship(
    domain: string,
    request: CreateRelationshipRequest
  ): Promise<Relationship> {
    // Validate request
    if (request.source_table_id === request.target_table_id) {
      throw new Error('Source and target tables must be different');
    }

    const response = await apiClient.getClient().post<CreateRelationshipResponse>(
      `/workspace/domains/${domain}/relationships`,
      request
    );
    return response.data.relationship;
  }

  /**
   * Check for circular dependency
   */
  async checkCircularDependency(
    domain: string,
    sourceTableId: string,
    targetTableId: string
  ): Promise<{ is_circular: boolean; path?: string[] }> {
    const response = await apiClient.getClient().post<{ is_circular: boolean; path?: string[] }>(
      `/workspace/domains/${domain}/relationships/check-circular`,
      { source_table_id: sourceTableId, target_table_id: targetTableId }
    );
    return response.data;
  }

  /**
   * Update an existing relationship
   */
  async updateRelationship(
    domain: string,
    relationshipId: string,
    updates: UpdateRelationshipRequest
  ): Promise<Relationship> {
    const response = await apiClient.getClient().put<UpdateRelationshipResponse>(
      `/workspace/domains/${domain}/relationships/${relationshipId}`,
      updates
    );
    return response.data.relationship;
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(
    domain: string,
    relationshipId: string
  ): Promise<void> {
    await apiClient.getClient().delete(
      `/workspace/domains/${domain}/relationships/${relationshipId}`
    );
  }
}

// Export singleton instance
export const relationshipService = new RelationshipService();

