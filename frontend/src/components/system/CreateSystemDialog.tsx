/**
 * Create System Dialog Component
 * Allows creating or importing a new system within a domain
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import type { System } from '@/types/system';

export interface CreateSystemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (systemId: string) => void;
  domainId: string;
  editingSystemId?: string | null; // If provided, edit mode is enabled
  linkTableId?: string | null; // If provided, link this table to the created system
}

export const CreateSystemDialog: React.FC<CreateSystemDialogProps> = ({
  isOpen,
  onClose,
  onCreated,
  domainId,
  editingSystemId,
  linkTableId,
}) => {
  const { addSystem, updateSystem, systems } = useModelStore();
  const { addToast } = useUIStore();
  const [name, setName] = useState('');
  const [systemType, setSystemType] = useState<System['system_type']>('postgresql');
  const [description, setDescription] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const isEditMode = !!editingSystemId;
  const editingSystem = editingSystemId ? systems.find((s) => s.id === editingSystemId) : null;

  // Load system data when editing
  useEffect(() => {
    if (isOpen && isEditMode && editingSystem) {
      setName(editingSystem.name);
      setSystemType(editingSystem.system_type);
      setDescription(editingSystem.description || '');
      setConnectionString(editingSystem.connection_string || '');
      setImportMode(false);
    } else if (isOpen && !isEditMode) {
      resetForm();
    }
  }, [isOpen, isEditMode, editingSystem]);

  const handleCreate = async () => {
    setError(null);

    if (!name.trim()) {
      setError('System name is required.');
      return;
    }

    // Check if system name already exists in this domain (excluding current system if editing)
    const domainSystems = systems.filter((s) => s.domain_id === domainId);
    const conflictingSystem = domainSystems.find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== editingSystemId
    );
    if (conflictingSystem) {
      setError('A system with this name already exists in this domain.');
      return;
    }

    setIsCreating(true);
    try {
      if (isEditMode && editingSystemId) {
        // Update existing system
        updateSystem(editingSystemId, {
          name: name.trim(),
          system_type: systemType,
          description: description.trim() || undefined,
          connection_string: connectionString.trim() || undefined,
        });
        addToast({
          type: 'success',
          message: `System '${name.trim()}' updated successfully!`,
        });
        onCreated(editingSystemId);
      } else {
        // Create new system - always use UUIDs
        const { generateUUID } = await import('@/utils/validation');
        const systemId = generateUUID();

        const newSystem: System = {
          id: systemId,
          domain_id: domainId,
          name: name.trim(),
          system_type: systemType,
          description: description.trim() || undefined,
          connection_string: connectionString.trim() || undefined,
          created_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString(),
          table_ids: linkTableId ? [linkTableId] : [],
          asset_ids: [],
        };

        addSystem(newSystem);
        addToast({
          type: 'success',
          message: `System '${name.trim()}' created successfully!`,
        });
        onCreated(systemId);
      }
      onClose();
      resetForm();
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} system:`, err);
      setError(
        err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} system.`
      );
      addToast({
        type: 'error',
        message: `Failed to ${isEditMode ? 'update' : 'create'} system: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setError('Please select a file to import.');
      return;
    }

    setIsCreating(true);
    try {
      // Read file content
      const text = await importFile.text();

      // Parse JSON/YAML (basic implementation - can be enhanced)
      let systemData: Partial<System>;
      try {
        systemData = JSON.parse(text);
      } catch {
        // Try YAML parsing if JSON fails (would need yaml library)
        setError('Import currently supports JSON format only. YAML support coming soon.');
        setIsCreating(false);
        return;
      }

      // Always use UUIDs for system IDs
      const { generateUUID } = await import('@/utils/validation');
      const systemId = generateUUID();
      const newSystem: System = {
        id: systemId,
        domain_id: domainId,
        name: systemData.name || importFile.name.replace(/\.[^/.]+$/, ''),
        system_type: systemData.system_type || 'postgresql',
        description: systemData.description,
        connection_string: systemData.connection_string,
        created_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
        table_ids: systemData.table_ids || [],
        asset_ids: systemData.asset_ids || [],
      };

      addSystem(newSystem);
      addToast({
        type: 'success',
        message: `System imported successfully!`,
      });
      onCreated(systemId);
      onClose();
      resetForm();
    } catch (err) {
      console.error('Failed to import system:', err);
      setError(err instanceof Error ? err.message : 'Failed to import system.');
      addToast({
        type: 'error',
        message: `Failed to import system: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setName('');
    setSystemType('postgresql');
    setDescription('');
    setConnectionString('');
    setImportMode(false);
    setImportFile(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Edit System' : importMode ? 'Import System' : 'Create New System'}
      size="md"
    >
      <div className="p-4 space-y-4">
        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
            role="alert"
          >
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {/* Mode Toggle - only show in create mode, not edit mode */}
        {!isEditMode && (
          <div className="flex gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => {
                setImportMode(false);
                // Reset form when switching modes to prevent focus issues
                if (importMode) {
                  setName('');
                  setSystemType('postgresql');
                  setDescription('');
                  setConnectionString('');
                  setImportFile(null);
                  setError(null);
                }
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                !importMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Create New
            </button>
            <button
              type="button"
              onClick={() => {
                setImportMode(true);
                // Reset form when switching modes to prevent focus issues
                if (!importMode) {
                  setName('');
                  setSystemType('system');
                  setDescription('');
                  setConnectionString('');
                  setError(null);
                }
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                importMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Import
            </button>
          </div>
        )}

        {importMode ? (
          /* Import Mode */
          <div className="space-y-4">
            <div>
              <label htmlFor="import-file" className="block text-sm font-medium text-gray-700 mb-2">
                System File (JSON)
              </label>
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreating || !importFile}
              >
                {isCreating ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        ) : (
          /* Create Mode */
          <div className="space-y-4">
            <div>
              <label htmlFor="system-name" className="block text-sm font-medium text-gray-700 mb-2">
                System Name *
              </label>
              <input
                key="system-name-input"
                id="system-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., PostgreSQL Production"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating && name.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>

            <div>
              <label htmlFor="system-type" className="block text-sm font-medium text-gray-700 mb-2">
                System Type *
              </label>
              <select
                id="system-type"
                value={systemType}
                onChange={(e) => setSystemType(e.target.value as System['system_type'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <optgroup label="Relational Databases">
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mssql">Microsoft SQL Server</option>
                  <option value="oracle">Oracle</option>
                  <option value="db2">DB2</option>
                  <option value="sqlite">SQLite</option>
                  <option value="mariadb">MariaDB</option>
                  <option value="percona">Percona</option>
                </optgroup>
                <optgroup label="Cloud Databases">
                  <option value="dynamodb">DynamoDB</option>
                  <option value="cassandra">Cassandra</option>
                  <option value="mongodb">MongoDB</option>
                  <option value="redis">Redis</option>
                  <option value="elasticsearch">Elasticsearch</option>
                  <option value="influxdb">InfluxDB</option>
                  <option value="timescaledb">TimescaleDB</option>
                  <option value="clickhouse">ClickHouse</option>
                  <option value="bigquery">BigQuery</option>
                  <option value="snowflake">Snowflake</option>
                  <option value="redshift">Amazon Redshift</option>
                  <option value="databricks">Databricks</option>
                  <option value="deltalake">Delta Lake</option>
                  <option value="duckdb">DuckDB</option>
                  <option value="motherduck">MotherDuck</option>
                </optgroup>
                <optgroup label="Data Warehouses & Analytics">
                  <option value="hive">Apache Hive</option>
                  <option value="presto">Presto</option>
                  <option value="trino">Trino</option>
                </optgroup>
                <optgroup label="NoSQL & Document Stores">
                  <option value="couchdb">CouchDB</option>
                  <option value="rethinkdb">RethinkDB</option>
                </optgroup>
                <optgroup label="Graph Databases">
                  <option value="neo4j">Neo4j</option>
                  <option value="arangodb">ArangoDB</option>
                </optgroup>
                <optgroup label="BI Applications">
                  <option value="looker">Looker</option>
                  <option value="quicksight">Amazon QuickSight</option>
                  <option value="tableau">Tableau</option>
                  <option value="powerbi">Power BI</option>
                  <option value="qlik">Qlik</option>
                  <option value="metabase">Metabase</option>
                  <option value="superset">Apache Superset</option>
                  <option value="mode">Mode</option>
                  <option value="chartio">Chartio</option>
                  <option value="periscope">Periscope</option>
                  <option value="sisense">Sisense</option>
                  <option value="domo">Domo</option>
                  <option value="thoughtspot">ThoughtSpot</option>
                  <option value="microstrategy">MicroStrategy</option>
                  <option value="cognos">IBM Cognos</option>
                  <option value="businessobjects">SAP BusinessObjects</option>
                </optgroup>
                <optgroup label="Message Bus & Event Streaming">
                  <option value="kafka">Apache Kafka</option>
                  <option value="pulsar">Apache Pulsar</option>
                  <option value="eventbus">EventBus</option>
                  <option value="rabbitmq">RabbitMQ</option>
                  <option value="activemq">Apache ActiveMQ</option>
                  <option value="nats">NATS</option>
                  <option value="amazonmq">Amazon MQ</option>
                  <option value="azureservicebus">Azure Service Bus</option>
                  <option value="googlepubsub">Google Pub/Sub</option>
                </optgroup>
                <optgroup label="Cache Services">
                  <option value="elasticache">AWS ElastiCache</option>
                  <option value="memcached">Memcached</option>
                  <option value="hazelcast">Hazelcast</option>
                  <option value="aerospike">Aerospike</option>
                  <option value="couchbase">Couchbase</option>
                </optgroup>
                <optgroup label="Cloud Infrastructure & Servers">
                  <option value="ec2">Amazon EC2</option>
                  <option value="eks">Amazon EKS</option>
                  <option value="docker">Docker</option>
                  <option value="kubernetes">Kubernetes</option>
                  <option value="lambda">AWS Lambda</option>
                  <option value="azurefunctions">Azure Functions</option>
                  <option value="gcpcloudfunctions">GCP Cloud Functions</option>
                  <option value="azurevm">Azure Virtual Machines</option>
                  <option value="gcpcomputeengine">GCP Compute Engine</option>
                  <option value="azurecontainerinstances">Azure Container Instances</option>
                  <option value="gcpcloudrun">GCP Cloud Run</option>
                  <option value="fargate">AWS Fargate</option>
                  <option value="ecs">Amazon ECS</option>
                </optgroup>
                <optgroup label="Legacy/Generic">
                  <option value="database">Database (Generic)</option>
                  <option value="schema">Schema (Generic)</option>
                  <option value="namespace">Namespace (Generic)</option>
                  <option value="system">System (Generic)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label
                htmlFor="system-description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="system-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Production PostgreSQL database for customer data"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div>
              <label
                htmlFor="connection-string"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Connection String (Optional)
              </label>
              <input
                id="connection-string"
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="e.g., postgresql://host:5432/dbname"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreating || !name.trim()}
              >
                {isCreating
                  ? isEditMode
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditMode
                    ? 'Update'
                    : 'Create'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DraggableModal>
  );
};
