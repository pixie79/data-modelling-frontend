/**
 * ODPS Service
 * Handles ODPS (Open Data Product Standard) format operations
 * Supports both online (via API) and offline (via WASM SDK) modes
 */

import { apiClient } from '../api/apiClient';
import { sdkModeDetector } from './sdkMode';
import { sdkLoader } from './sdkLoader';
import * as yaml from 'js-yaml';
import type { DataProduct } from '@/types/odps';

class ODPSService {
  /**
   * Parse ODPS YAML content to DataProduct object
   * Uses API when online, WASM SDK when offline
   */
  async parseYAML(yamlContent: string): Promise<DataProduct> {
    // Always parse the raw YAML first to preserve full structure
    const rawParsed = yaml.load(yamlContent) as any;
    console.log('[ODPSService] Parsed raw YAML, keys:', Object.keys(rawParsed || {}));
    console.log('[ODPSService] Raw YAML has tenant:', !!rawParsed?.tenant);
    console.log('[ODPSService] Raw YAML has tags:', !!rawParsed?.tags);
    console.log('[ODPSService] Raw YAML has inputPorts:', !!rawParsed?.inputPorts);
    console.log('[ODPSService] Raw YAML has outputPorts:', !!rawParsed?.outputPorts);
    console.log('[ODPSService] Raw YAML has managementPorts:', !!rawParsed?.managementPorts);
    console.log('[ODPSService] Raw YAML has support:', !!rawParsed?.support);
    console.log('[ODPSService] Raw YAML has team:', !!rawParsed?.team);
    console.log('[ODPSService] Raw YAML has productCreatedTs:', !!rawParsed?.productCreatedTs);

    const isOnline = await sdkModeDetector.checkOnlineMode();

    if (isOnline) {
      try {
        const response = await apiClient.getClient().post('/api/v1/import/odps', {
          content: yamlContent,
        });
        const product = response.data as DataProduct;
        // Preserve raw ODPS data for round-trip
        product._odps_raw = rawParsed;
        console.log('[ODPSService] API import successful, _odps_raw set');
        return product;
      } catch (error) {
        console.warn('API import failed, falling back to SDK', error);
        // Fall through to SDK
      }
    }

    // Offline mode or API failure - use SDK
    try {
      const sdk = await sdkLoader.load();
      if (sdk && typeof sdk.parse_odps_yaml === 'function') {
        const resultJson = sdk.parse_odps_yaml(yamlContent);
        const product = JSON.parse(resultJson) as DataProduct;
        // Preserve raw ODPS data for round-trip
        product._odps_raw = rawParsed;
        console.log('[ODPSService] SDK import successful, _odps_raw set');
        return product;
      }
    } catch (error) {
      console.warn('SDK parse failed, using fallback parser', error);
    }

    // Fallback: Use js-yaml parser
    const product = this.mapToDataProduct(rawParsed);
    // Preserve raw ODPS data for round-trip
    product._odps_raw = rawParsed;
    console.log('[ODPSService] Fallback parser used, _odps_raw set');
    return product;
  }

  /**
   * Convert DataProduct to ODPS-compliant format
   */
  private convertToODPSFormat(product: DataProduct, domainName?: string): any {
    // Map status values to ODPS enum values
    const mapStatus = (status?: string): string => {
      switch (status) {
        case 'published':
          return 'active';
        case 'draft':
          return 'draft';
        case 'deprecated':
          return 'deprecated';
        default:
          return 'draft';
      }
    };

    // Convert description string to ODPS description object
    let descriptionObj: any = undefined;
    if (product.description) {
      descriptionObj = {
        purpose: product.description,
      };
    }

    // Convert input_ports to inputPorts with proper structure
    // InputPort requires: name, version, contractId
    const inputPorts =
      product.input_ports
        ?.filter((port) => port.name && port.table_id)
        .map((port) => ({
          name: port.name,
          version: '1.0.0', // Default version if not provided
          contractId: port.table_id,
          ...(port.description && { description: port.description }),
        })) || [];

    // Convert output_ports to outputPorts with proper structure
    // OutputPort requires: name, version (contractId is optional)
    const outputPorts =
      product.output_ports
        ?.filter((port) => port.name)
        .map((port) => ({
          name: port.name,
          version: '1.0.0', // Default version if not provided
          ...(port.table_id && { contractId: port.table_id }),
          ...(port.description && { description: port.description }),
        })) || [];

    // Convert custom_properties Record to array format
    const customProperties = product.custom_properties
      ? Object.entries(product.custom_properties).map(([property, value]) => ({
          property,
          value,
        }))
      : undefined;

    // Convert support object to array format
    // Support requires: channel, url
    const support =
      product.support && (product.support.slack_channel || product.support.documentation_url)
        ? [
            {
              channel: product.support.slack_channel || 'general',
              url:
                product.support.documentation_url ||
                (product.support.slack_channel
                  ? `https://slack.com/channels/${product.support.slack_channel}`
                  : 'https://example.com'),
              ...(product.support.contact && { description: product.support.contact }),
              ...(product.support.slack_channel && { tool: 'slack' }),
            },
          ]
        : undefined;

    // Build ODPS-compliant product
    const odpsProduct: any = {
      apiVersion: 'v1.0.0',
      kind: 'DataProduct',
      id: product.id,
      name: product.name,
      status: mapStatus(product.status),
    };

    // Add optional fields only if they have values
    if (domainName) {
      odpsProduct.domain = domainName;
    }

    if (descriptionObj) {
      odpsProduct.description = descriptionObj;
    }

    if (inputPorts.length > 0) {
      odpsProduct.inputPorts = inputPorts;
    }

    if (outputPorts.length > 0) {
      odpsProduct.outputPorts = outputPorts;
    }

    if (customProperties && customProperties.length > 0) {
      odpsProduct.customProperties = customProperties;
    }

    if (support && support.length > 0) {
      odpsProduct.support = support;
    }

    if (product.team) {
      odpsProduct.team = {
        name: product.team,
      };
    }

    return odpsProduct;
  }

  /**
   * Convert DataProduct to ODPS YAML
   * Uses API when online, WASM SDK when offline
   * If _odps_raw is available, uses it for round-trip preservation and skips SDK/API
   */
  async toYAML(product: DataProduct, domainName?: string): Promise<string> {
    // If we have raw ODPS data, use it directly for round-trip preservation
    // This ensures ALL fields are preserved exactly as imported
    if (product._odps_raw) {
      // Use raw ODPS data as base, preserving all original fields
      const odpsProduct = JSON.parse(JSON.stringify(product._odps_raw)); // Deep clone

      // Only update fields that may have changed in the UI
      if (product.id) odpsProduct.id = product.id;
      if (product.name) odpsProduct.name = product.name;

      // Update domain only if explicitly provided and different from original
      const originalDomain = odpsProduct.domain;
      if (
        domainName &&
        domainName !== 'Default' &&
        domainName !== 'unknown' &&
        domainName !== originalDomain
      ) {
        odpsProduct.domain = domainName;
      }

      // Map status values if changed
      if (product.status) {
        const statusMap: Record<string, string> = {
          published: 'active',
          draft: 'draft',
          deprecated: 'deprecated',
        };
        const mappedStatus = statusMap[product.status] || product.status;
        // Only update if status actually changed
        if (mappedStatus !== odpsProduct.status) {
          odpsProduct.status = mappedStatus;
        }
      }

      // Ensure required fields are present (but preserve original apiVersion)
      if (!odpsProduct.apiVersion) odpsProduct.apiVersion = 'v1.0.0';
      if (!odpsProduct.kind) odpsProduct.kind = 'DataProduct';

      // Update description only if it was modified in the UI
      // (preserve original structure if unchanged)
      if (product.description && typeof product.description === 'string') {
        // Check if description was modified by comparing with original
        const originalDesc = odpsProduct.description;
        let descriptionChanged = false;

        if (!originalDesc || typeof originalDesc === 'string') {
          descriptionChanged = originalDesc !== product.description;
        } else if (typeof originalDesc === 'object') {
          // Check if the formatted string matches the original object
          const formatted = [
            originalDesc.purpose && `Purpose: ${originalDesc.purpose}`,
            originalDesc.limitations && `Limitations: ${originalDesc.limitations}`,
            originalDesc.usage && `Usage: ${originalDesc.usage}`,
          ]
            .filter(Boolean)
            .join('\n\n');
          descriptionChanged = formatted !== product.description;
        }

        if (descriptionChanged) {
          // Try to parse the formatted description back to object
          const purposeMatch = product.description.match(/Purpose:\s*(.+?)(?:\n\n|$)/s);
          const limitationsMatch = product.description.match(/Limitations:\s*(.+?)(?:\n\n|$)/s);
          const usageMatch = product.description.match(/Usage:\s*(.+?)(?:\n\n|$)/s);

          if (purposeMatch || limitationsMatch || usageMatch) {
            odpsProduct.description = {
              ...(purposeMatch && purposeMatch[1] && { purpose: purposeMatch[1].trim() }),
              ...(limitationsMatch &&
                limitationsMatch[1] && { limitations: limitationsMatch[1].trim() }),
              ...(usageMatch && usageMatch[1] && { usage: usageMatch[1].trim() }),
            };
          } else {
            odpsProduct.description = { purpose: product.description };
          }
        }
      }

      // Log what we're about to export
      console.log('[ODPSService] Exporting ODPS product with fields:', Object.keys(odpsProduct));
      console.log('[ODPSService] Has tenant:', !!odpsProduct.tenant);
      console.log(
        '[ODPSService] Has tags:',
        !!odpsProduct.tags,
        Array.isArray(odpsProduct.tags) ? odpsProduct.tags.length : 'N/A'
      );
      console.log(
        '[ODPSService] Has inputPorts:',
        !!odpsProduct.inputPorts,
        Array.isArray(odpsProduct.inputPorts) ? odpsProduct.inputPorts.length : 'N/A'
      );
      console.log(
        '[ODPSService] Has outputPorts:',
        !!odpsProduct.outputPorts,
        Array.isArray(odpsProduct.outputPorts) ? odpsProduct.outputPorts.length : 'N/A'
      );
      console.log(
        '[ODPSService] Has managementPorts:',
        !!odpsProduct.managementPorts,
        Array.isArray(odpsProduct.managementPorts) ? odpsProduct.managementPorts.length : 'N/A'
      );
      console.log(
        '[ODPSService] Has support:',
        !!odpsProduct.support,
        Array.isArray(odpsProduct.support) ? odpsProduct.support.length : 'N/A'
      );
      console.log('[ODPSService] Has team:', !!odpsProduct.team);
      console.log('[ODPSService] Has productCreatedTs:', !!odpsProduct.productCreatedTs);

      // When we have raw data, serialize directly to YAML to preserve everything
      // Skip SDK/API to avoid any field loss
      const yamlOutput = yaml.dump(odpsProduct, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false,
        skipInvalid: false,
      });

      console.log('[ODPSService] YAML output length:', yamlOutput.length);
      console.log('[ODPSService] YAML output preview:', yamlOutput.substring(0, 500));
      return yamlOutput;
    }

    console.log('[ODPSService] No _odps_raw found, converting from DataProduct');

    // No raw data available, convert from DataProduct and use SDK/API
    const odpsProduct = this.convertToODPSFormat(product, domainName);

    const isOnline = await sdkModeDetector.checkOnlineMode();

    if (isOnline) {
      try {
        const response = await apiClient.getClient().post('/api/v1/export/odps', {
          product: odpsProduct,
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
      if (sdk && typeof sdk.export_to_odps_yaml === 'function') {
        return sdk.export_to_odps_yaml(JSON.stringify(odpsProduct));
      }
    } catch (error) {
      console.warn('SDK export failed, using fallback serializer', error);
    }

    // Fallback: Use js-yaml serializer with ODPS-compliant format
    return yaml.dump(odpsProduct, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
  }

  /**
   * Export a data product to Markdown format
   * Uses SDK 1.14.1+ export_odps_to_markdown method
   */
  async exportToMarkdown(product: DataProduct): Promise<string> {
    if (!sdkLoader.hasODPSExport()) {
      throw new Error('ODPS Markdown export requires SDK 1.14.1 or later');
    }

    try {
      const sdk = await sdkLoader.load();

      if (sdk && typeof sdk.export_odps_to_markdown === 'function') {
        // Convert to ODPS format before passing to SDK
        const odpsProduct = this.convertToODPSFormat(product);
        const productJson = JSON.stringify(odpsProduct);
        return sdk.export_odps_to_markdown(productJson);
      }

      throw new Error('SDK export_odps_to_markdown method not available');
    } catch (error) {
      console.error('[ODPSService] Failed to export data product to Markdown:', error);
      throw error;
    }
  }

  /**
   * Export a data product to PDF format
   * Uses SDK 1.14.1+ export_odps_to_pdf method
   * Returns base64-encoded PDF data
   */
  async exportToPDF(
    product: DataProduct,
    branding?: { logo_base64?: string; company_name?: string; footer_text?: string }
  ): Promise<{ pdf_base64: string }> {
    if (!sdkLoader.hasODPSExport()) {
      throw new Error('ODPS PDF export requires SDK 1.14.1 or later');
    }

    try {
      const sdk = await sdkLoader.load();

      if (sdk && typeof sdk.export_odps_to_pdf === 'function') {
        // Convert to ODPS format before passing to SDK
        const odpsProduct = this.convertToODPSFormat(product);
        const productJson = JSON.stringify(odpsProduct);
        const brandingJson = branding ? JSON.stringify(branding) : null;
        const resultJson = sdk.export_odps_to_pdf(productJson, brandingJson);
        return JSON.parse(resultJson);
      }

      throw new Error('SDK export_odps_to_pdf method not available');
    } catch (error) {
      console.error('[ODPSService] Failed to export data product to PDF:', error);
      throw error;
    }
  }

  /**
   * Map parsed YAML to DataProduct type
   */
  private mapToDataProduct(parsed: any): DataProduct {
    // Handle description as either string or object (ODPS v1.0.0 format)
    let description: string | undefined;
    if (typeof parsed.description === 'string') {
      description = parsed.description;
    } else if (parsed.description && typeof parsed.description === 'object') {
      // Convert object description to formatted string
      const parts: string[] = [];
      if (parsed.description.purpose) parts.push(`Purpose: ${parsed.description.purpose}`);
      if (parsed.description.limitations)
        parts.push(`Limitations: ${parsed.description.limitations}`);
      if (parsed.description.usage) parts.push(`Usage: ${parsed.description.usage}`);
      description = parts.length > 0 ? parts.join('\n\n') : undefined;
    }

    // Handle team as either string or object (ODPS format)
    let team: string | undefined;
    if (typeof parsed.team === 'string') {
      team = parsed.team;
    } else if (parsed.team && typeof parsed.team === 'object') {
      // Convert team object to string (use name if available)
      team = parsed.team.name || parsed.tenant || undefined;
    } else {
      team = parsed.tenant;
    }

    // Extract input ports from inputPorts (camelCase) or input_ports (snake_case)
    const inputPorts = parsed.inputPorts || parsed.input_ports;

    // Extract output ports from outputPorts (camelCase) or output_ports (snake_case)
    const outputPorts = parsed.outputPorts || parsed.output_ports;

    // Extract support - handle both array (ODPS) and object (simplified) formats
    let support: any = undefined;
    if (parsed.support) {
      if (Array.isArray(parsed.support) && parsed.support.length > 0) {
        // ODPS format: array of support objects, convert to simplified format
        const firstSupport = parsed.support[0];
        support = {
          slack_channel:
            firstSupport.channel === 'Data Team Slack' ? firstSupport.channel : undefined,
          documentation_url: firstSupport.url,
          contact: firstSupport.description,
        };
      } else if (typeof parsed.support === 'object') {
        support = parsed.support;
      }
    }

    // Extract linked tables from inputPorts and outputPorts
    const linkedTables: string[] = [];
    if (inputPorts && Array.isArray(inputPorts)) {
      inputPorts.forEach((port: any) => {
        const contractId = port.contractId || port.contract_id || port.table_id;
        if (contractId && !linkedTables.includes(contractId)) {
          linkedTables.push(contractId);
        }
      });
    }
    if (outputPorts && Array.isArray(outputPorts)) {
      outputPorts.forEach((port: any) => {
        const contractId = port.contractId || port.contract_id || port.table_id;
        if (contractId && !linkedTables.includes(contractId)) {
          linkedTables.push(contractId);
        }
      });
    }

    return {
      id: parsed.id || crypto.randomUUID(),
      domain_id: parsed.domain_id || parsed.domain || '',
      name: parsed.name || '',
      description,
      linked_tables: parsed.linked_tables || linkedTables,
      input_ports:
        Array.isArray(inputPorts) && inputPorts.length > 0
          ? inputPorts.map((port: any) => ({
              name: port.name,
              table_id: port.contractId || port.contract_id || port.table_id,
              description: port.description,
            }))
          : undefined,
      output_ports:
        Array.isArray(outputPorts) && outputPorts.length > 0
          ? outputPorts.map((port: any) => ({
              name: port.name,
              table_id: port.contractId || port.contract_id || port.table_id,
              description: port.description,
            }))
          : undefined,
      support,
      team,
      status: parsed.status || 'draft',
      custom_properties: parsed.customProperties || parsed.custom_properties,
      created_at: parsed.created_at || parsed.productCreatedTs || new Date().toISOString(),
      last_modified_at: parsed.last_modified_at || new Date().toISOString(),
    };
  }
}

export const odpsService = new ODPSService();
