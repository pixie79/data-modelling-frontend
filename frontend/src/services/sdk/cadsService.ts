/**
 * CADS Service
 * Handles CADS (Compute Asset Definition Standard) format operations
 * Supports both online (via API) and offline (via WASM SDK) modes
 */

import { apiClient } from '../api/apiClient';
import { sdkModeDetector } from './sdkMode';
import { sdkLoader } from './sdkLoader';
import * as yaml from 'js-yaml';
import type { ComputeAsset } from '@/types/cads';

class CADSService {
  /**
   * Parse CADS YAML content to ComputeAsset object
   * Uses API when online, WASM SDK when offline
   */
  async parseYAML(yamlContent: string): Promise<ComputeAsset> {
    const isOnline = await sdkModeDetector.checkOnlineMode();

    if (isOnline) {
      try {
        const response = await apiClient.getClient().post('/api/v1/import/cads', {
          content: yamlContent,
        });
        return response.data as ComputeAsset;
      } catch (error) {
        console.warn('API import failed, falling back to SDK', error);
        // Fall through to SDK
      }
    }

    // Offline mode or API failure - use SDK
    try {
      const sdk = await sdkLoader.load();
      if (sdk && typeof sdk.parse_cads_yaml === 'function') {
        const resultJson = sdk.parse_cads_yaml(yamlContent);
        return JSON.parse(resultJson) as ComputeAsset;
      }
    } catch (error) {
      console.warn('SDK parse failed, using fallback parser', error);
    }

    // Fallback: Use js-yaml parser
    const parsed = yaml.load(yamlContent) as any;
    return this.mapToComputeAsset(parsed);
  }

  /**
   * Convert ComputeAsset to CADS YAML
   * Uses API when online, WASM SDK when offline
   */
  async toYAML(asset: ComputeAsset): Promise<string> {
    const isOnline = await sdkModeDetector.checkOnlineMode();

    if (isOnline) {
      try {
        const response = await apiClient.getClient().post('/api/v1/export/cads', {
          asset,
        });
        return response.data.content as string;
      } catch (error) {
        console.warn('API export failed, falling back to SDK', error);
        // Fall through to SDK
      }
    }

    // Offline mode or API failure - use SDK
    try {
      const sdk = await sdkLoader.load();
      if (sdk && typeof sdk.export_to_cads_yaml === 'function') {
        return sdk.export_to_cads_yaml(JSON.stringify(asset));
      }
    } catch (error) {
      console.warn('SDK export failed, using fallback serializer', error);
    }

    // Fallback: Use js-yaml serializer
    return yaml.dump(asset);
  }

  /**
   * Convert a frontend ComputeAsset to CADS format for SDK export
   * The SDK expects CADS-compliant format
   */
  private convertToCADSFormat(asset: ComputeAsset): Record<string, unknown> {
    // Map type to kind if not present
    const kind =
      asset.kind ||
      (asset.type === 'ai' ? 'AIModel' : asset.type === 'ml' ? 'MLPipeline' : 'Application');

    const cadsAsset: Record<string, unknown> = {
      apiVersion: 'v1.0.0',
      kind: kind,
      id: asset.id,
      name: asset.name,
      type: asset.type,
      status: asset.status || 'development',

      // Optional fields
      ...(asset.description && { description: asset.description }),
      ...(asset.owner && { owner: asset.owner }),
      ...(asset.engineering_team && { engineeringTeam: asset.engineering_team }),
      ...(asset.source_repo && { sourceRepo: asset.source_repo }),
      ...(asset.tags && asset.tags.length > 0 && { tags: asset.tags }),

      // Models and specs
      ...(asset.bpmn_models && asset.bpmn_models.length > 0 && { bpmnModels: asset.bpmn_models }),
      ...(asset.dmn_models && asset.dmn_models.length > 0 && { dmnModels: asset.dmn_models }),
      ...(asset.openapi_specs &&
        asset.openapi_specs.length > 0 && { openapiSpecs: asset.openapi_specs }),

      // Custom properties
      ...(asset.custom_properties && { customProperties: asset.custom_properties }),

      // Timestamps
      createdAt: asset.created_at,
      lastModifiedAt: asset.last_modified_at,
    };

    return cadsAsset;
  }

  /**
   * Export a compute asset to Markdown format
   * Uses SDK 1.14.1+ export_cads_to_markdown method
   */
  async exportToMarkdown(asset: ComputeAsset): Promise<string> {
    if (!sdkLoader.hasCADSExport()) {
      throw new Error('CADS Markdown export requires SDK 1.14.1 or later');
    }

    try {
      const sdk = await sdkLoader.load();

      if (sdk && typeof sdk.export_cads_to_markdown === 'function') {
        // Convert to CADS format before passing to SDK
        const cadsAsset = this.convertToCADSFormat(asset);
        const assetJson = JSON.stringify(cadsAsset);
        return sdk.export_cads_to_markdown(assetJson);
      }

      throw new Error('SDK export_cads_to_markdown method not available');
    } catch (error) {
      console.error('[CADSService] Failed to export compute asset to Markdown:', error);
      throw error;
    }
  }

  /**
   * Export a compute asset to PDF format
   * Uses SDK 1.14.1+ export_cads_to_pdf method
   * Returns base64-encoded PDF data
   */
  async exportToPDF(
    asset: ComputeAsset,
    branding?: { logo_base64?: string; company_name?: string; footer_text?: string }
  ): Promise<{ pdf_base64: string }> {
    if (!sdkLoader.hasCADSExport()) {
      throw new Error('CADS PDF export requires SDK 1.14.1 or later');
    }

    try {
      const sdk = await sdkLoader.load();

      if (sdk && typeof sdk.export_cads_to_pdf === 'function') {
        // Convert to CADS format before passing to SDK
        const cadsAsset = this.convertToCADSFormat(asset);
        const assetJson = JSON.stringify(cadsAsset);
        const brandingJson = branding ? JSON.stringify(branding) : null;
        const resultJson = sdk.export_cads_to_pdf(assetJson, brandingJson);
        return JSON.parse(resultJson);
      }

      throw new Error('SDK export_cads_to_pdf method not available');
    } catch (error) {
      console.error('[CADSService] Failed to export compute asset to PDF:', error);
      throw error;
    }
  }

  /**
   * Map parsed YAML to ComputeAsset type
   */
  private mapToComputeAsset(parsed: any): ComputeAsset {
    return {
      id: parsed.id || crypto.randomUUID(),
      domain_id: parsed.domain_id || '',
      name: parsed.name || '',
      type: parsed.type || 'app',
      description: parsed.description,
      owner: parsed.owner,
      engineering_team: parsed.engineering_team,
      source_repo: parsed.source_repo,
      bpmn_link: parsed.bpmn_link,
      dmn_link: parsed.dmn_link,
      bpmn_models: parsed.bpmn_models,
      dmn_models: parsed.dmn_models,
      openapi_specs: parsed.openapi_specs,
      status: parsed.status || 'development',
      kind: parsed.kind,
      custom_properties: parsed.custom_properties,
      created_at: parsed.created_at || new Date().toISOString(),
      last_modified_at: parsed.last_modified_at || new Date().toISOString(),
    };
  }
}

export const cadsService = new CADSService();
