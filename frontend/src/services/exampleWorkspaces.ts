/**
 * Example Workspaces Service
 * Loads bundled example workspaces from public/examples
 * Examples are refreshed when the app version changes
 */

import { WorkspaceV2Loader } from './storage/workspaceV2Loader';
import type { Workspace } from '@/types/workspace';

// App version - used to detect new releases and refresh examples
const APP_VERSION = __APP_VERSION__ || '0.0.0';
declare const __APP_VERSION__: string;
const EXAMPLES_VERSION_KEY = 'examples-loaded-version';
const EXAMPLES_CACHE_KEY = 'examples-workspaces';

export interface ExampleWorkspaceInfo {
  id: string;
  name: string;
  description: string;
  folder: string;
  workspaceFile: string;
  files: string[];
  features: string[];
}

export interface ExamplesIndex {
  examples: ExampleWorkspaceInfo[];
}

/**
 * Check if examples need to be refreshed (new app version deployed)
 */
export function shouldRefreshExamples(): boolean {
  const loadedVersion = localStorage.getItem(EXAMPLES_VERSION_KEY);
  return loadedVersion !== APP_VERSION;
}

/**
 * Mark examples as loaded for current version
 */
export function markExamplesLoaded(): void {
  localStorage.setItem(EXAMPLES_VERSION_KEY, APP_VERSION);
}

/**
 * Clear cached examples (force refresh on next load)
 */
export function clearExamplesCache(): void {
  localStorage.removeItem(EXAMPLES_VERSION_KEY);
  localStorage.removeItem(EXAMPLES_CACHE_KEY);
}

/**
 * Fetch the examples index from the bundled files
 */
export async function fetchExamplesIndex(): Promise<ExamplesIndex> {
  const response = await fetch('/examples/index.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch examples index: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch a single file from an example workspace
 */
async function fetchExampleFile(folder: string, filename: string): Promise<string> {
  const response = await fetch(`/examples/${folder}/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch example file ${filename}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Load an example workspace by fetching all its files
 */
export async function loadExampleWorkspace(example: ExampleWorkspaceInfo): Promise<Workspace> {
  console.log(`[ExampleWorkspaces] Loading example: ${example.name}`);

  // Fetch all files in parallel
  const fileContents = await Promise.all(
    example.files.map(async (filename) => {
      const content = await fetchExampleFile(example.folder, filename);
      return { name: filename, content };
    })
  );

  // Convert to the format expected by WorkspaceV2Loader
  const files = fileContents.map(({ name, content }) => ({
    name,
    content,
  }));

  // Use the V2 loader to parse the workspace from string content
  const workspace = await WorkspaceV2Loader.loadFromStringFiles(files);

  if (!workspace) {
    throw new Error(`Failed to parse example workspace: ${example.name}`);
  }

  // Mark as example workspace
  (workspace as Workspace & { isExample?: boolean }).isExample = true;

  console.log(
    `[ExampleWorkspaces] Loaded example: ${example.name} with ${workspace.domains?.length || 0} domains`
  );

  return workspace;
}

/**
 * Get list of available example workspaces (metadata only, not loaded)
 */
export async function getAvailableExamples(): Promise<ExampleWorkspaceInfo[]> {
  try {
    const index = await fetchExamplesIndex();
    return index.examples;
  } catch (error) {
    console.warn('[ExampleWorkspaces] Failed to fetch examples index:', error);
    return [];
  }
}

/**
 * Check if an example workspace is already loaded in the store
 */
export function isExampleLoaded(exampleId: string, workspaces: Workspace[]): boolean {
  // Example workspaces have a fixed ID format: example-{id}
  return workspaces.some((w) => w.id === `example-${exampleId}` || w.name === exampleId);
}
