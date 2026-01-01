/**
 * Type definitions for Data Flow entities
 * Re-exported from workspace.ts for convenience
 */

export type {
  DataFlowDiagram,
  DataFlowNode,
  DataFlowConnection,
} from './workspace';

export type DataFlowNodeType = 'source' | 'target' | 'processor' | 'storage';

// Extended node types for specific implementations
export type DataFlowNodeSubType =
  | 'database'
  | 'kafka_topic'
  | 'api'
  | 'processor'
  | 'target'
  | 'source'
  | 'storage';

