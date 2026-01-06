/**
 * System Type Definition
 * Represents a physical system (database, schema, namespace) within a domain
 */

export type SystemType =
  // Relational Databases
  | 'postgresql'
  | 'mysql'
  | 'mssql'
  | 'oracle'
  | 'db2'
  | 'sqlite'
  | 'mariadb'
  | 'percona'
  // Cloud Databases
  | 'dynamodb'
  | 'cassandra'
  | 'mongodb'
  | 'redis'
  | 'elasticsearch'
  | 'influxdb'
  | 'timescaledb'
  | 'clickhouse'
  | 'bigquery'
  | 'snowflake'
  | 'redshift'
  | 'databricks'
  | 'deltalake'
  | 'duckdb'
  | 'motherduck'
  // Data Warehouses & Analytics
  | 'hive'
  | 'presto'
  | 'trino'
  // NoSQL & Document Stores
  | 'couchdb'
  | 'rethinkdb'
  // Graph Databases
  | 'neo4j'
  | 'arangodb'
  // Message Bus & Event Streaming
  | 'kafka'
  | 'pulsar'
  | 'eventbus'
  | 'rabbitmq'
  | 'activemq'
  | 'nats'
  | 'amazonmq'
  | 'azureservicebus'
  | 'googlepubsub'
  // Cache Services
  | 'elasticache'
  | 'memcached'
  | 'hazelcast'
  | 'aerospike'
  | 'couchbase'
  // BI Applications
  | 'looker'
  | 'quicksight'
  | 'tableau'
  | 'powerbi'
  | 'qlik'
  | 'metabase'
  | 'superset'
  | 'mode'
  | 'chartio'
  | 'periscope'
  | 'sisense'
  | 'domo'
  | 'thoughtspot'
  | 'microstrategy'
  | 'cognos'
  | 'businessobjects'
  // Cloud Infrastructure & Servers
  | 'ec2'
  | 'eks'
  | 'docker'
  | 'kubernetes'
  | 'lambda'
  | 'azurefunctions'
  | 'gcpcloudfunctions'
  | 'azurevm'
  | 'gcpcomputeengine'
  | 'azurecontainerinstances'
  | 'gcpcloudrun'
  | 'fargate'
  | 'ecs'
  // Legacy/Generic types for backward compatibility
  | 'database'
  | 'schema'
  | 'namespace'
  | 'system';

export interface System {
  id: string; // UUID
  domain_id: string; // UUID - parent domain
  name: string; // System name (e.g., "PostgreSQL Production", "Snowflake Analytics")
  system_type: SystemType;
  description?: string;
  connection_string?: string; // Optional connection info
  position_x?: number; // Canvas position X
  position_y?: number; // Canvas position Y
  created_at: string; // ISO timestamp
  last_modified_at: string; // ISO timestamp

  // System contains tables and assets
  table_ids?: string[]; // Array of table IDs in this system
  asset_ids?: string[]; // Array of CADS asset IDs in this system
}

export interface CreateSystemRequest {
  domain_id: string;
  name: string;
  system_type: SystemType;
  description?: string;
  connection_string?: string;
}

export interface UpdateSystemRequest {
  name?: string;
  system_type?: SystemType;
  description?: string;
  connection_string?: string;
  position_x?: number;
  position_y?: number;
  table_ids?: string[];
  asset_ids?: string[];
}
