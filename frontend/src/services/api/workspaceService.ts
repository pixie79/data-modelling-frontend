/**
 * Workspace Service
 * Handles API interactions for workspace CRUD operations
 */

import { apiClient } from './apiClient';

class WorkspaceService {
  /**
   * Get current workspace information
   */
  async getWorkspaceInfo(): Promise<{ workspace_path: string; email: string }> {
    const response = await apiClient.getClient().get<{ workspace_path: string; email: string }>(
      '/workspace/info'
    );
    return response.data;
  }

  /**
   * List all user profiles (workspaces)
   */
  async listProfiles(): Promise<Array<{ email: string; domains: string[] }>> {
    const response = await apiClient.getClient().get<{ profiles: Array<{ email: string; domains: string[] }> }>(
      '/workspace/profiles'
    );
    return response.data.profiles;
  }

  /**
   * Create a new workspace (email-based)
   */
  async createWorkspace(email: string, domain: string): Promise<{ workspace_path: string; message: string }> {
    const response = await apiClient.getClient().post<{ workspace_path: string; message: string }>(
      '/workspace/create',
      { email, domain }
    );
    return response.data;
  }

  /**
   * List all domains in the workspace
   */
  async listDomains(): Promise<string[]> {
    const response = await apiClient.getClient().get<{ domains: string[] }>('/workspace/domains');
    return response.data.domains;
  }

  /**
   * Create a new domain
   */
  async createDomain(domain: string): Promise<{ domain: string; workspace_path: string; message: string }> {
    const response = await apiClient.getClient().post<{ domain: string; workspace_path: string; message: string }>(
      '/workspace/domains',
      { domain }
    );
    return response.data;
  }

  /**
   * Get domain information
   */
  async getDomain(domain: string): Promise<{ domain: string; workspace_path: string; message: string }> {
    const response = await apiClient.getClient().get<{ domain: string; workspace_path: string; message: string }>(
      `/workspace/domains/${domain}`
    );
    return response.data;
  }

  /**
   * Load a domain into the model service
   */
  async loadDomain(domain: string): Promise<{ domain: string; workspace_path: string; message: string }> {
    const response = await apiClient.getClient().post<{ domain: string; workspace_path: string; message: string }>(
      '/workspace/load-domain',
      { domain }
    );
    return response.data;
  }
}

// Export singleton instance
export const workspaceService = new WorkspaceService();

