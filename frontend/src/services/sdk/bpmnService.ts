/**
 * BPMN Service
 * Handles BPMN 2.0 XML format operations
 * Supports both online (via API) and offline (via WASM SDK) modes
 */

import { apiClient } from '../api/apiClient';
import { sdkModeDetector } from './sdkMode';
import { sdkLoader } from './sdkLoader';
import type { BPMNProcess } from '@/types/bpmn';

const MAX_BPMN_SIZE = 10 * 1024 * 1024; // 10MB

class BPMNService {
  /**
   * Validate BPMN XML size
   */
  private validateSize(xml: string): void {
    if (xml.length > MAX_BPMN_SIZE) {
      throw new Error(`BPMN XML exceeds maximum size of ${MAX_BPMN_SIZE / 1024 / 1024}MB`);
    }
  }

  /**
   * Parse BPMN XML content to BPMNProcess object
   * Uses API when online, WASM SDK when offline
   * Alias for parseXML for consistency
   */
  async parseBPMNXML(xmlContent: string): Promise<BPMNProcess> {
    return this.parseXML(xmlContent);
  }

  /**
   * Extract process name and ID from BPMN XML
   * Falls back to extracting from the XML if SDK doesn't provide these values
   */
  private extractFromXML(xmlContent: string): { name: string; id: string } {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');

      // Check for parse errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.warn('[BPMNService] XML parse error:', parseError.textContent);
        // Fall back to regex extraction
        return this.extractFromXMLRegex(xmlContent);
      }

      // Try multiple ways to find the process element
      let processEl: Element | null = null;
      let name = '';
      let id = '';

      // Method 1: getElementsByTagNameNS (most reliable for namespaced XML)
      const bpmnNS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
      const processElements = doc.getElementsByTagNameNS(bpmnNS, 'process');
      if (processElements.length > 0) {
        processEl = processElements[0] ?? null;
        console.log('[BPMNService] Found process via getElementsByTagNameNS');
      }

      // Method 2: Try getElementsByTagName with local name
      if (!processEl) {
        const allProcesses = doc.getElementsByTagName('process');
        if (allProcesses.length > 0) {
          processEl = allProcesses[0] ?? null;
          console.log('[BPMNService] Found process via getElementsByTagName("process")');
        }
      }

      // Method 3: Try getElementsByTagName with prefixed name
      if (!processEl) {
        const bpmnProcesses = doc.getElementsByTagName('bpmn:process');
        if (bpmnProcesses.length > 0) {
          processEl = bpmnProcesses[0] ?? null;
          console.log('[BPMNService] Found process via getElementsByTagName("bpmn:process")');
        }
      }

      if (processEl) {
        name = processEl.getAttribute('name') || '';
        id = processEl.getAttribute('id') || '';
        console.log(`[BPMNService] Extracted from XML DOM - name: "${name}", id: "${id}"`);
      } else {
        console.warn('[BPMNService] No process element found in DOM, trying regex fallback');
        return this.extractFromXMLRegex(xmlContent);
      }

      // If DOM parsing didn't find the name, try regex as final fallback
      if (!name) {
        const regexResult = this.extractFromXMLRegex(xmlContent);
        if (regexResult.name) {
          name = regexResult.name;
          console.log(`[BPMNService] Got name from regex fallback: "${name}"`);
        }
      }

      return { name, id };
    } catch (error) {
      console.warn('[BPMNService] Failed to extract from XML via DOM:', error);
      return this.extractFromXMLRegex(xmlContent);
    }
  }

  /**
   * Extract process name and ID from BPMN XML using regex (fallback)
   */
  private extractFromXMLRegex(xmlContent: string): { name: string; id: string } {
    let name = '';
    let id = '';

    try {
      // Match <bpmn:process or <process element with name and id attributes
      // Handle both orders: name before id, and id before name
      const processRegex = /<(?:bpmn:)?process[^>]*>/i;
      const processMatch = xmlContent.match(processRegex);

      if (processMatch) {
        const processTag = processMatch[0];

        // Extract name attribute
        const nameMatch = processTag.match(/name\s*=\s*["']([^"']+)["']/);
        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1];
        }

        // Extract id attribute
        const idMatch = processTag.match(/id\s*=\s*["']([^"']+)["']/);
        if (idMatch && idMatch[1]) {
          id = idMatch[1];
        }

        console.log(`[BPMNService] Extracted from XML regex - name: "${name}", id: "${id}"`);
      }
    } catch (error) {
      console.warn('[BPMNService] Regex extraction failed:', error);
    }

    return { name, id };
  }

  /**
   * Parse BPMN XML content to BPMNProcess object
   * Uses API when online, WASM SDK when offline
   */
  async parseXML(xmlContent: string): Promise<BPMNProcess> {
    this.validateSize(xmlContent);

    // Always extract name/id from XML as fallback
    const xmlExtracted = this.extractFromXML(xmlContent);

    const isOnline = await sdkModeDetector.checkOnlineMode();

    if (isOnline) {
      try {
        const response = await apiClient.getClient().post('/api/v1/import/bpmn', {
          content: xmlContent,
        });
        const result = response.data as BPMNProcess;
        // Ensure name is set from XML if API didn't provide it
        if (!result.name && xmlExtracted.name) {
          result.name = xmlExtracted.name;
        }
        return result;
      } catch (error) {
        console.warn('API import failed, falling back to SDK', error);
        // Fall through to SDK
      }
    }

    // Offline mode or API failure - use SDK
    try {
      const sdk = await sdkLoader.load();
      if (sdk && typeof sdk.parse_bpmn_xml === 'function') {
        const resultJson = sdk.parse_bpmn_xml(xmlContent);
        const parsed = JSON.parse(resultJson);
        return {
          id: parsed.id || xmlExtracted.id || crypto.randomUUID(),
          domain_id: parsed.domain_id || '',
          name: parsed.name || xmlExtracted.name || 'Untitled Process',
          bpmn_xml: xmlContent, // Preserve original XML
          linked_assets: parsed.linked_assets,
          transformation_links: parsed.transformation_links,
          created_at: parsed.created_at || new Date().toISOString(),
          last_modified_at: parsed.last_modified_at || new Date().toISOString(),
        };
      }
    } catch (error) {
      console.warn('SDK parse failed', error);
      // Don't throw - fall through to fallback parsing
    }

    // If SDK not available or failed, return structure with XML-extracted values
    return {
      id: xmlExtracted.id || crypto.randomUUID(),
      domain_id: '',
      name: xmlExtracted.name || 'Untitled Process',
      bpmn_xml: xmlContent,
      created_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
    };
  }

  /**
   * Export BPMNProcess to BPMN XML
   * Uses API when online, WASM SDK when offline
   * Alias for toXML for consistency
   */
  async exportBPMNXML(process: BPMNProcess): Promise<string> {
    return this.toXML(process);
  }

  /**
   * Convert BPMNProcess to BPMN XML
   * Uses API when online, WASM SDK when offline
   */
  async toXML(process: BPMNProcess): Promise<string> {
    // If we already have XML, return it
    if (process.bpmn_xml) {
      this.validateSize(process.bpmn_xml);
      return process.bpmn_xml;
    }

    const isOnline = await sdkModeDetector.checkOnlineMode();

    if (isOnline) {
      try {
        const response = await apiClient.getClient().post('/api/v1/export/bpmn', {
          process,
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
      if (sdk && typeof sdk.export_to_bpmn_xml === 'function') {
        return sdk.export_to_bpmn_xml(JSON.stringify(process));
      }
    } catch (error) {
      console.warn('SDK export failed', error);
      throw new Error(
        'Failed to export BPMN XML: ' + (error instanceof Error ? error.message : String(error))
      );
    }

    throw new Error('BPMN XML export not available - SDK not loaded');
  }

  /**
   * Validate BPMN XML syntax
   */
  async validateXML(xmlContent: string): Promise<{ valid: boolean; errors?: string[] }> {
    this.validateSize(xmlContent);

    try {
      const sdk = await sdkLoader.load();
      if (sdk && typeof sdk.validate_bpmn_xml === 'function') {
        const resultJson = sdk.validate_bpmn_xml(xmlContent);
        return JSON.parse(resultJson);
      }
    } catch (error) {
      console.warn('SDK validation failed', error);
    }

    // Basic XML validation
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      const errors = Array.from(doc.querySelectorAll('parsererror')).map(
        (e) => e.textContent || 'Parse error'
      );
      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}

export const bpmnService = new BPMNService();
