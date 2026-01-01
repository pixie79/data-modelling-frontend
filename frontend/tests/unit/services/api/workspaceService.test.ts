/**
 * Unit tests for Workspace Service
 * Tests workspace CRUD operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspaceService } from '@/services/api/workspaceService';
import { apiClient } from '@/services/api/apiClient';

vi.mock('@/services/api/apiClient');

describe('WorkspaceService', () => {
  const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getClient).mockReturnValue(mockClient as any);
  });

  describe('getWorkspaceInfo', () => {
    it('should get current workspace information', async () => {
      const mockResponse = {
        workspace_path: '/workspace/user@example.com',
        email: 'user@example.com',
      };

      mockClient.get.mockResolvedValue({
        data: mockResponse,
      });

      const result = await workspaceService.getWorkspaceInfo();
      expect(result).toEqual(mockResponse);
      expect(mockClient.get).toHaveBeenCalledWith('/workspace/info');
    });
  });

  describe('listProfiles', () => {
    it('should list all user profiles', async () => {
      const mockProfiles = [
        {
          email: 'user@example.com',
          domains: ['domain-1', 'domain-2'],
        },
      ];

      mockClient.get.mockResolvedValue({
        data: { profiles: mockProfiles },
      });

      const result = await workspaceService.listProfiles();
      expect(result).toEqual(mockProfiles);
      expect(mockClient.get).toHaveBeenCalledWith('/workspace/profiles');
    });
  });

  describe('createWorkspace', () => {
    it('should create a new workspace', async () => {
      const mockResponse = {
        workspace_path: '/workspace/user@example.com',
        message: 'Workspace created successfully',
      };

      mockClient.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await workspaceService.createWorkspace('user@example.com', 'default');
      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith('/workspace/create', {
        email: 'user@example.com',
        domain: 'default',
      });
    });
  });

  describe('listDomains', () => {
    it('should list all domains', async () => {
      const mockDomains = ['domain-1', 'domain-2'];

      mockClient.get.mockResolvedValue({
        data: { domains: mockDomains },
      });

      const result = await workspaceService.listDomains();
      expect(result).toEqual(mockDomains);
      expect(mockClient.get).toHaveBeenCalledWith('/workspace/domains');
    });
  });

  describe('createDomain', () => {
    it('should create a new domain', async () => {
      const mockResponse = {
        domain: 'new-domain',
        workspace_path: '/workspace/user@example.com',
        message: 'Domain created successfully',
      };

      mockClient.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await workspaceService.createDomain('new-domain');
      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith('/workspace/domains', { domain: 'new-domain' });
    });
  });

  describe('loadDomain', () => {
    it('should load a domain into the model service', async () => {
      const mockResponse = {
        domain: 'domain-1',
        workspace_path: '/workspace/user@example.com',
        message: 'Domain loaded successfully',
      };

      mockClient.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await workspaceService.loadDomain('domain-1');
      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith('/workspace/load-domain', { domain: 'domain-1' });
    });
  });
});
