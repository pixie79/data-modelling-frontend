/**
 * System Node Component
 * Represents a physical system (database, schema, namespace) in Systems View
 * In Systems View, displays table cards inside the system
 */

import React from 'react';
import { Handle, Position } from 'reactflow';
import { TableCard } from './TableCard';
import { ComputeAssetCard } from './ComputeAssetCard';
import type { Table } from '@/types/table';
import type { ComputeAsset } from '@/types/cads';

import type { SystemType } from '@/types/system';

export interface SystemNodeData {
  systemId: string;
  systemName: string;
  systemType: SystemType;
  description?: string;
  tables?: Table[]; // Tables belonging to this system (for Systems View)
  computeAssets?: ComputeAsset[]; // Compute assets belonging to this system (for Systems View)
  onTableClick?: (table: Table) => void; // Handler for table card clicks
  onTableEdit?: (tableId: string) => void; // Handler for table edit button clicks
  onTableDelete?: (tableId: string) => void; // Handler for table delete button clicks
  onTableExport?: (tableId: string) => void; // Handler for table export button clicks
  onTableBPMNClick?: (tableId: string) => void; // Handler for BPMN icon clicks on tables
  tableHasBPMN?: (tableId: string) => boolean; // Check if table has BPMN link
  onEdit?: (systemId: string) => void; // Handler for edit button clicks
  onDelete?: (systemId: string) => void; // Handler for delete button clicks
  onAssetEdit?: (assetId: string) => void; // Handler for compute asset edit
  onAssetDelete?: (assetId: string) => void; // Handler for compute asset delete
  onAssetExport?: (assetId: string) => void; // Handler for compute asset export
  onAssetBPMNClick?: (assetId: string) => void; // Handler for BPMN icon clicks on assets
  onAssetDMNClick?: (assetId: string) => void; // Handler for DMN icon clicks on assets
  currentView?: 'systems' | 'etl' | 'operational' | 'analytical' | 'products';
  isShared?: boolean; // True if this is a shared resource from another domain
}

export interface SystemNodeProps {
  data: SystemNodeData;
  selected?: boolean;
}

export const SystemNode: React.FC<SystemNodeProps> = ({ data, selected }) => {
  const {
    systemId,
    systemName,
    systemType,
    description,
    tables = [],
    computeAssets = [],
    onTableBPMNClick,
    tableHasBPMN,
    onAssetBPMNClick,
    onAssetDMNClick,
    onTableClick,
    onTableEdit,
    onTableDelete,
    onTableExport,
    onEdit,
    onDelete,
    onAssetEdit,
    onAssetDelete,
    onAssetExport,
    currentView,
    isShared = false,
  } = data;
  const isSystemsView = currentView === 'systems';

  const getSystemIcon = () => {
    // Relational Databases
    if (
      ['postgresql', 'mysql', 'mssql', 'oracle', 'db2', 'sqlite', 'mariadb', 'percona'].includes(
        systemType
      )
    ) {
      return '🗄️';
    }
    // Cloud Databases
    if (
      [
        'dynamodb',
        'cassandra',
        'mongodb',
        'redis',
        'elasticsearch',
        'influxdb',
        'timescaledb',
        'clickhouse',
        'bigquery',
        'snowflake',
        'redshift',
        'databricks',
        'deltalake',
        'duckdb',
        'motherduck',
      ].includes(systemType)
    ) {
      return '☁️';
    }
    // Data Warehouses & Analytics
    if (['hive', 'presto', 'trino'].includes(systemType)) {
      return '📊';
    }
    // NoSQL & Document Stores
    if (['couchdb', 'rethinkdb'].includes(systemType)) {
      return '📄';
    }
    // Graph Databases
    if (['neo4j', 'arangodb'].includes(systemType)) {
      return '🕸️';
    }
    // Message Bus & Event Streaming
    if (
      [
        'kafka',
        'pulsar',
        'eventbus',
        'rabbitmq',
        'activemq',
        'nats',
        'amazonmq',
        'azureservicebus',
        'googlepubsub',
      ].includes(systemType)
    ) {
      return '📨';
    }
    // Cache Services
    if (['elasticache', 'memcached', 'hazelcast', 'aerospike', 'couchbase'].includes(systemType)) {
      return '⚡';
    }
    // BI Applications
    if (
      [
        'looker',
        'quicksight',
        'tableau',
        'powerbi',
        'qlik',
        'metabase',
        'superset',
        'mode',
        'chartio',
        'periscope',
        'sisense',
        'domo',
        'thoughtspot',
        'microstrategy',
        'cognos',
        'businessobjects',
      ].includes(systemType)
    ) {
      return '📈';
    }
    // Cloud Infrastructure & Servers
    if (
      [
        'ec2',
        'eks',
        'docker',
        'kubernetes',
        'lambda',
        'azurefunctions',
        'gcpcloudfunctions',
        'azurevm',
        'gcpcomputeengine',
        'azurecontainerinstances',
        'gcpcloudrun',
        'fargate',
        'ecs',
      ].includes(systemType)
    ) {
      return '🖥️';
    }
    // Legacy/Generic types
    switch (systemType) {
      case 'database':
        return '🗄️';
      case 'schema':
        return '📦';
      case 'namespace':
        return '📁';
      case 'system':
        return '⚙️';
      default:
        return '⚙️';
    }
  };

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md
        ${isShared ? 'border-2 border-dashed' : 'border-2 border-solid'}
        ${selected ? 'border-blue-600 ring-2 ring-blue-200' : isShared ? 'border-gray-400' : 'border-gray-300'}
        ${isSystemsView ? 'min-w-[300px] max-w-[400px]' : 'min-w-[180px]'}
      `}
      role="group"
      aria-label={`System: ${systemName}`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="target" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="target" position={Position.Left} className="w-3 h-3" />
      <Handle type="target" position={Position.Right} className="w-3 h-3" />
      <Handle type="source" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="source" position={Position.Left} className="w-3 h-3" />
      <Handle type="source" position={Position.Right} className="w-3 h-3" />

      {/* System Header */}
      <div
        className={`flex items-center gap-2 ${isSystemsView ? 'p-3 border-b border-gray-200' : 'p-3'} relative group`}
      >
        <span className="text-2xl">{getSystemIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{systemName}</div>
          {description && (
            <div className="text-xs text-gray-500 truncate" title={description}>
              {description}
            </div>
          )}
        </div>
        {/* Edit/Delete buttons (only in Systems View) */}
        {isSystemsView && (onEdit || onDelete) && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex gap-1">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(systemId);
                  }}
                  className="p-1 bg-white rounded shadow text-blue-600 hover:text-blue-800"
                  title="Edit System"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(systemId);
                  }}
                  className="p-1 bg-white rounded shadow text-red-600 hover:text-red-800"
                  title="Delete System"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table Cards and Compute Asset Cards (only in Systems View) */}
      {isSystemsView && (tables.length > 0 || computeAssets.length > 0) && (
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
          {/* Tables Section */}
          {tables.length > 0 && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Tables
              </div>
              {tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onClick={() => onTableClick?.(table)}
                  onEdit={onTableEdit}
                  onDelete={onTableDelete}
                  onExport={onTableExport}
                  onBPMNClick={onTableBPMNClick}
                  hasBPMNLink={tableHasBPMN?.(table.id) || false}
                />
              ))}
            </>
          )}

          {/* Compute Assets Section */}
          {computeAssets.length > 0 && (
            <>
              {tables.length > 0 && <div className="pt-2 border-t border-gray-200 mt-2" />}
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Assets
              </div>
              {computeAssets.map((asset) => (
                <ComputeAssetCard
                  key={asset.id}
                  asset={asset}
                  onEdit={onAssetEdit}
                  onDelete={onAssetDelete}
                  onExport={onAssetExport}
                  onBPMNClick={onAssetBPMNClick}
                  onDMNClick={onAssetDMNClick}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Empty state for Systems View */}
      {isSystemsView && tables.length === 0 && computeAssets.length === 0 && (
        <div className="p-3 text-sm text-gray-400 text-center italic">
          No tables or assets in this system
        </div>
      )}
    </div>
  );
};
