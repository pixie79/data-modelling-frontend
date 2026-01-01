/**
 * Electron File Service
 * Handles ODCS file I/O operations using Electron native file system
 */

import { electronFileService as platformFileService, type OpenDialogOptions, type SaveDialogOptions } from '@/services/platform/electron';
import { odcsService } from '@/services/sdk/odcsService';
import { getPlatform } from '@/services/platform/platform';
import { useModelStore } from '@/stores/modelStore';
import type { Workspace } from '@/types/workspace';

class ElectronFileService {
  /**
   * Read ODCS file from file path
   */
  async readFile(path: string): Promise<Workspace> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const content = await platformFileService.readFile(path);
    const odcsWorkspace = await odcsService.parseYAML(content);
    
    // Update model store with data flow diagrams if present
    if (odcsWorkspace.data_flow_diagrams && odcsWorkspace.data_flow_diagrams.length > 0) {
      useModelStore.getState().setDataFlowDiagrams(odcsWorkspace.data_flow_diagrams);
    }
    
    return odcsWorkspace as unknown as Workspace;
  }

  /**
   * Write workspace to ODCS file
   */
  async writeFile(workspace: Workspace, path: string): Promise<void> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    // Include data flow diagrams from model store
    const { dataFlowDiagrams } = useModelStore.getState();
    const workspaceWithDiagrams = {
      ...workspace,
      data_flow_diagrams: dataFlowDiagrams,
    };
    const yamlContent = await odcsService.toYAML(workspaceWithDiagrams as any);
    await platformFileService.writeFile(path, yamlContent);
  }

  /**
   * Show open file dialog and read selected file
   */
  async openFile(options?: OpenDialogOptions): Promise<Workspace | null> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const defaultOptions: OpenDialogOptions = {
      title: 'Open Workspace',
      filters: [
        { name: 'ODCS Files', extensions: ['yaml', 'yml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };

    const result = await platformFileService.showOpenDialog({ ...defaultOptions, ...options });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    if (!filePath) {
      return null;
    }

    return this.readFile(filePath);
  }

  /**
   * Show save file dialog and write workspace
   */
  async saveFile(workspace: Workspace, options?: SaveDialogOptions): Promise<string | null> {
    if (getPlatform() !== 'electron') {
      throw new Error('Electron file service can only be used in Electron environment');
    }

    const defaultOptions: SaveDialogOptions = {
      title: 'Save Workspace',
      filters: [
        { name: 'ODCS Files', extensions: ['yaml', 'yml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      defaultPath: 'workspace.yaml',
    };

    const result = await platformFileService.showSaveDialog({ ...defaultOptions, ...options });
    
    if (result.canceled || !result.filePath) {
      return null;
    }

    const filePath = result.filePath;
    await this.writeFile(workspace, filePath);
    return filePath;
  }

  /**
   * Load workspace from file (alias for openFile)
   */
  async loadWorkspace(options?: OpenDialogOptions): Promise<Workspace | null> {
    return this.openFile(options);
  }

  /**
   * Export workspace to file (alias for saveFile)
   */
  async exportWorkspace(workspace: Workspace, options?: SaveDialogOptions): Promise<string | null> {
    return this.saveFile(workspace, options);
  }
}

// Export singleton instance
export const electronFileService = new ElectronFileService();

