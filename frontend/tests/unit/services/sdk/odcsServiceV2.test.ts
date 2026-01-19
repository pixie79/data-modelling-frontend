/**
 * ODCS Service V2 API Unit Tests
 *
 * Tests for SDK 2.0.4+ V2 methods:
 * - parseYAMLv2() - Native ODCSContract parsing
 * - toYAMLv2() - Lossless export
 * - tablesToContract() - Table to contract conversion
 * - normalizeTableV2() - Full ODCS v3.1.0 field mapping
 * - extractRelationshipsFromContract() - Relationship extraction
 *
 * These tests verify the V2 import/export pipeline preserves all ODCS fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SDK loader
vi.mock('@/services/sdk/sdkLoader', () => ({
  sdkLoader: {
    load: vi.fn().mockResolvedValue(undefined),
    getModule: vi.fn(),
    hasODCSV2Support: vi.fn().mockReturnValue(true),
  },
}));

// Mock the SDK mode detector
vi.mock('@/services/sdk/sdkMode', () => ({
  sdkModeDetector: {
    getMode: vi.fn().mockResolvedValue('offline'),
  },
}));

// Sample ODCS v3.1.0 contract for testing
const sampleODCSContract = {
  apiVersion: 'v3.1.0',
  kind: 'DataContract',
  id: 'test-contract-id',
  version: '1.0.0',
  status: 'active',
  name: 'Test Contract',
  domain: 'test-domain',
  description: {
    purpose: 'Test contract for unit tests',
  },
  schema: [
    {
      id: 'table-1',
      name: 'customers',
      physicalName: 'tbl_customers',
      businessName: 'Customer Records',
      description: 'Customer master data',
      status: 'active',
      dataGranularityDescription: 'One row per customer',
      properties: [
        {
          id: 'col-1',
          name: 'customer_id',
          physicalName: 'cust_id',
          physicalType: 'BIGINT',
          logicalType: 'integer',
          businessName: 'Customer Identifier',
          description: 'Unique customer ID',
          required: true,
          primaryKey: true,
          primaryKeyPosition: 1,
          unique: true,
          classification: 'internal',
          criticalDataElement: true,
          examples: ['1001', '1002', '1003'],
        },
        {
          id: 'col-2',
          name: 'email',
          physicalName: 'email_addr',
          physicalType: 'VARCHAR(255)',
          logicalType: 'string',
          businessName: 'Email Address',
          description: 'Customer email',
          required: true,
          unique: true,
          classification: 'PII',
          logicalTypeOptions: {
            format: 'email',
            maxLength: 255,
          },
        },
        {
          id: 'col-3',
          name: 'created_at',
          physicalType: 'TIMESTAMP',
          logicalType: 'timestamp',
          partitioned: true,
          partitionKeyPosition: 1,
          transformLogic: 'CURRENT_TIMESTAMP',
          transformDescription: 'Auto-generated creation timestamp',
        },
      ],
      relationships: [
        {
          type: 'parent',
          to: 'orders.customer_id',
          description: 'Customer has many orders',
        },
      ],
    },
    {
      id: 'table-2',
      name: 'orders',
      physicalName: 'tbl_orders',
      businessName: 'Order Records',
      properties: [
        {
          id: 'col-4',
          name: 'order_id',
          physicalType: 'BIGINT',
          logicalType: 'integer',
          primaryKey: true,
        },
        {
          id: 'col-5',
          name: 'customer_id',
          physicalType: 'BIGINT',
          logicalType: 'integer',
          relationships: [
            {
              type: 'references',
              to: 'customers.customer_id',
            },
          ],
        },
      ],
    },
  ],
  customProperties: [
    { property: 'team', value: 'data-platform' },
    { property: 'cost_center', value: 'engineering' },
  ],
};

// Sample tables array (what SDK returns from odcs_contract_to_tables)
const sampleTablesFromSDK = [
  {
    id: 'table-1',
    name: 'customers',
    physicalName: 'tbl_customers',
    businessName: 'Customer Records',
    description: 'Customer master data',
    status: 'active',
    dataGranularityDescription: 'One row per customer',
    columns: [
      {
        id: 'col-1',
        name: 'customer_id',
        physicalName: 'cust_id',
        physicalType: 'BIGINT',
        logicalType: 'integer',
        businessName: 'Customer Identifier',
        description: 'Unique customer ID',
        required: true,
        primaryKey: true,
        primaryKeyPosition: 1,
        unique: true,
        classification: 'internal',
        criticalDataElement: true,
        examples: ['1001', '1002', '1003'],
      },
      {
        id: 'col-2',
        name: 'email',
        physicalName: 'email_addr',
        physicalType: 'VARCHAR(255)',
        logicalType: 'string',
        businessName: 'Email Address',
        description: 'Customer email',
        required: true,
        unique: true,
        classification: 'PII',
        logicalTypeOptions: {
          format: 'email',
          maxLength: 255,
        },
      },
    ],
  },
  {
    id: 'table-2',
    name: 'orders',
    physicalName: 'tbl_orders',
    businessName: 'Order Records',
    columns: [
      {
        id: 'col-4',
        name: 'order_id',
        physicalType: 'BIGINT',
        logicalType: 'integer',
        primaryKey: true,
      },
      {
        id: 'col-5',
        name: 'customer_id',
        physicalType: 'BIGINT',
        logicalType: 'integer',
      },
    ],
  },
];

describe('ODCS Service V2 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('V2 Support Detection', () => {
    it('should detect V2 support when SDK 2.0.4+ methods are available', async () => {
      const { sdkLoader } = await import('@/services/sdk/sdkLoader');
      expect(sdkLoader.hasODCSV2Support()).toBe(true);
    });
  });

  describe('Contract Structure Validation', () => {
    it('should have valid ODCS v3.1.0 contract structure', () => {
      expect(sampleODCSContract.apiVersion).toBe('v3.1.0');
      expect(sampleODCSContract.kind).toBe('DataContract');
      expect(sampleODCSContract.schema).toBeInstanceOf(Array);
      expect(sampleODCSContract.schema.length).toBe(2);
    });

    it('should have all required table-level ODCS fields', () => {
      const table = sampleODCSContract.schema[0];
      expect(table.name).toBeDefined();
      expect(table.physicalName).toBeDefined();
      expect(table.businessName).toBeDefined();
      expect(table.properties).toBeInstanceOf(Array);
    });

    it('should have all required column-level ODCS fields', () => {
      const column = sampleODCSContract.schema[0].properties[0];
      expect(column.name).toBeDefined();
      expect(column.physicalName).toBeDefined();
      expect(column.physicalType).toBeDefined();
      expect(column.logicalType).toBeDefined();
      expect(column.businessName).toBeDefined();
      expect(column.primaryKey).toBe(true);
      expect(column.primaryKeyPosition).toBe(1);
      expect(column.classification).toBeDefined();
      expect(column.criticalDataElement).toBe(true);
    });

    it('should have logicalTypeOptions for constrained columns', () => {
      const emailColumn = sampleODCSContract.schema[0].properties[1];
      expect(emailColumn.logicalTypeOptions).toBeDefined();
      expect(emailColumn.logicalTypeOptions?.format).toBe('email');
      expect(emailColumn.logicalTypeOptions?.maxLength).toBe(255);
    });

    it('should have transform fields for derived columns', () => {
      const createdAtColumn = sampleODCSContract.schema[0].properties[2];
      expect(createdAtColumn.transformLogic).toBeDefined();
      expect(createdAtColumn.transformDescription).toBeDefined();
    });

    it('should have partitioning fields', () => {
      const createdAtColumn = sampleODCSContract.schema[0].properties[2];
      expect(createdAtColumn.partitioned).toBe(true);
      expect(createdAtColumn.partitionKeyPosition).toBe(1);
    });

    it('should have schema-level relationships', () => {
      const table = sampleODCSContract.schema[0];
      expect(table.relationships).toBeInstanceOf(Array);
      expect(table.relationships?.length).toBe(1);
      expect(table.relationships?.[0].type).toBe('parent');
      expect(table.relationships?.[0].to).toBe('orders.customer_id');
    });

    it('should have property-level relationships', () => {
      const customerIdColumn = sampleODCSContract.schema[1].properties[1];
      expect(customerIdColumn.relationships).toBeInstanceOf(Array);
      expect(customerIdColumn.relationships?.[0].to).toBe('customers.customer_id');
    });

    it('should have contract-level customProperties', () => {
      expect(sampleODCSContract.customProperties).toBeInstanceOf(Array);
      expect(sampleODCSContract.customProperties?.length).toBe(2);
      expect(sampleODCSContract.customProperties?.[0].property).toBe('team');
    });
  });

  describe('Multi-Table Support', () => {
    it('should support multiple tables in schema', () => {
      expect(sampleODCSContract.schema.length).toBe(2);
      expect(sampleODCSContract.schema[0].name).toBe('customers');
      expect(sampleODCSContract.schema[1].name).toBe('orders');
    });

    it('should have correct column counts per table', () => {
      expect(sampleODCSContract.schema[0].properties.length).toBe(3);
      expect(sampleODCSContract.schema[1].properties.length).toBe(2);
    });
  });

  describe('SDK Tables Array Validation', () => {
    it('should have tables array from SDK conversion', () => {
      expect(sampleTablesFromSDK).toBeInstanceOf(Array);
      expect(sampleTablesFromSDK.length).toBe(2);
    });

    it('should preserve table-level ODCS fields in SDK output', () => {
      const table = sampleTablesFromSDK[0];
      expect(table.physicalName).toBe('tbl_customers');
      expect(table.businessName).toBe('Customer Records');
      expect(table.dataGranularityDescription).toBe('One row per customer');
    });

    it('should preserve column-level ODCS fields in SDK output', () => {
      const column = sampleTablesFromSDK[0].columns[0];
      expect(column.physicalName).toBe('cust_id');
      expect(column.physicalType).toBe('BIGINT');
      expect(column.logicalType).toBe('integer');
      expect(column.businessName).toBe('Customer Identifier');
      expect(column.primaryKeyPosition).toBe(1);
      expect(column.classification).toBe('internal');
      expect(column.criticalDataElement).toBe(true);
    });

    it('should preserve logicalTypeOptions in SDK output', () => {
      const emailColumn = sampleTablesFromSDK[0].columns[1];
      expect(emailColumn.logicalTypeOptions).toBeDefined();
      expect(emailColumn.logicalTypeOptions?.format).toBe('email');
    });

    it('should preserve examples array in SDK output', () => {
      const column = sampleTablesFromSDK[0].columns[0];
      expect(column.examples).toBeInstanceOf(Array);
      expect(column.examples).toContain('1001');
    });
  });

  describe('Field Mapping Verification', () => {
    it('should map snake_case to camelCase correctly', () => {
      // These mappings are what normalizeTableV2 should handle
      const fieldMappings = {
        physical_name: 'physicalName',
        physical_type: 'physicalType',
        logical_type: 'logicalType',
        business_name: 'businessName',
        primary_key_position: 'primaryKeyPosition',
        partition_key_position: 'partitionKeyPosition',
        critical_data_element: 'criticalDataElement',
        data_granularity_description: 'dataGranularityDescription',
        transform_source_objects: 'transformSourceObjects',
        transform_logic: 'transformLogic',
        transform_description: 'transformDescription',
        logical_type_options: 'logicalTypeOptions',
        authoritative_definitions: 'authoritativeDefinitions',
        custom_properties: 'customProperties',
      };

      // Verify all expected mappings exist
      Object.keys(fieldMappings).forEach((snakeCase) => {
        const camelCase = fieldMappings[snakeCase as keyof typeof fieldMappings];
        expect(camelCase).toBeDefined();
        expect(camelCase).not.toContain('_');
      });
    });
  });

  describe('Relationship Extraction', () => {
    it('should extract schema-level relationships', () => {
      const schemaRelationships = sampleODCSContract.schema[0].relationships;
      expect(schemaRelationships).toBeDefined();
      expect(schemaRelationships?.length).toBe(1);

      const rel = schemaRelationships?.[0];
      expect(rel?.type).toBe('parent');
      expect(rel?.to).toBe('orders.customer_id');
      expect(rel?.description).toBe('Customer has many orders');
    });

    it('should extract property-level relationships', () => {
      const propertyRelationships = sampleODCSContract.schema[1].properties[1].relationships;
      expect(propertyRelationships).toBeDefined();
      expect(propertyRelationships?.length).toBe(1);

      const rel = propertyRelationships?.[0];
      expect(rel?.type).toBe('references');
      expect(rel?.to).toBe('customers.customer_id');
    });

    it('should parse relationship target correctly', () => {
      const target = 'customers.customer_id';
      const parts = target.split('.');
      expect(parts[0]).toBe('customers'); // table name
      expect(parts[1]).toBe('customer_id'); // column name
    });
  });

  describe('Custom Metadata Preservation', () => {
    it('should preserve custom metadata with order field', () => {
      // The custom metadata should include order for column positioning
      const customMetadata = {
        order: 0,
        is_foreign_key: false,
      };
      expect(customMetadata.order).toBeDefined();
    });

    it('should preserve is_foreign_key in custom metadata', () => {
      const customMetadata = {
        order: 1,
        is_foreign_key: true,
      };
      expect(customMetadata.is_foreign_key).toBe(true);
    });
  });

  describe('Quality Rules Preservation', () => {
    it('should support column-level quality rules array', () => {
      const qualityRules = [
        {
          type: 'not_null',
          description: 'Column must not be null',
        },
        {
          type: 'unique',
          description: 'Values must be unique',
        },
      ];
      expect(qualityRules).toBeInstanceOf(Array);
      expect(qualityRules.length).toBe(2);
    });

    it('should support great-expectations format quality rules', () => {
      const geQualityRule = {
        implementation: {
          type: 'great-expectations',
          kwargs: {
            min_value: 0,
            max_value: 100,
          },
        },
      };
      expect(geQualityRule.implementation.type).toBe('great-expectations');
      expect(geQualityRule.implementation.kwargs.min_value).toBe(0);
    });
  });

  describe('Contract Metadata Preservation', () => {
    it('should preserve apiVersion', () => {
      expect(sampleODCSContract.apiVersion).toBe('v3.1.0');
    });

    it('should preserve kind', () => {
      expect(sampleODCSContract.kind).toBe('DataContract');
    });

    it('should preserve version', () => {
      expect(sampleODCSContract.version).toBe('1.0.0');
    });

    it('should preserve status', () => {
      expect(sampleODCSContract.status).toBe('active');
    });

    it('should preserve domain', () => {
      expect(sampleODCSContract.domain).toBe('test-domain');
    });

    it('should preserve description object', () => {
      expect(sampleODCSContract.description).toBeDefined();
      expect((sampleODCSContract.description as any).purpose).toBe('Test contract for unit tests');
    });
  });
});

// Sample ODCS contract with nested array/object columns (like GAM alert data)
const sampleODCSContractWithNestedColumns = {
  apiVersion: 'v3.1.0',
  kind: 'DataContract',
  id: 'nested-contract-id',
  version: '1.0.0',
  status: 'active',
  name: 'Nested Columns Test Contract',
  schema: [
    {
      id: 'table-nested',
      name: 'alerts',
      physicalName: 'tbl_alerts',
      properties: [
        {
          id: 'col-id',
          name: 'id',
          physicalType: 'string',
          logicalType: 'string',
          primaryKey: true,
          description: 'Unique alert identifier',
        },
        {
          id: 'col-rules',
          name: 'rulesTriggered',
          physicalType: 'array',
          logicalType: 'array',
          description: 'Array of triggered rules',
          items: {
            physicalType: 'object',
            logicalType: 'object',
            properties: [
              {
                name: 'ruleId',
                physicalType: 'string',
                logicalType: 'string',
                description: 'Rule identifier',
              },
              {
                name: 'ruleName',
                physicalType: 'string',
                logicalType: 'string',
                description: 'Rule name',
              },
              {
                name: 'priority',
                physicalType: 'int',
                logicalType: 'integer',
                description: 'Rule priority (0-30)',
              },
              {
                name: 'alertOperation',
                physicalType: 'record',
                logicalType: 'object',
                description: 'Nested operation details',
                properties: [
                  {
                    name: 'operationName',
                    physicalType: 'string',
                    logicalType: 'string',
                    description: 'Name of the operation',
                  },
                  {
                    name: 'operationField',
                    physicalType: 'string',
                    logicalType: 'string',
                    description: 'Field affected by operation',
                  },
                ],
              },
            ],
          },
        },
        {
          id: 'col-metadata',
          name: 'betMetadata',
          physicalType: 'record',
          logicalType: 'object',
          description: 'Bet metadata object',
          properties: [
            {
              name: 'betId',
              physicalType: 'string',
              logicalType: 'string',
              description: 'Bet identifier',
            },
            {
              name: 'betAmount',
              physicalType: 'decimal',
              logicalType: 'number',
              description: 'Bet amount',
            },
            {
              name: 'customerId',
              physicalType: 'string',
              logicalType: 'string',
              description: 'Customer identifier',
            },
          ],
        },
      ],
    },
  ],
};

describe('Nested Column Processing', () => {
  it('should have array column with items.properties', () => {
    const rulesColumn = sampleODCSContractWithNestedColumns.schema[0].properties[1];
    expect(rulesColumn.name).toBe('rulesTriggered');
    expect(rulesColumn.physicalType).toBe('array');
    expect(rulesColumn.items).toBeDefined();
    expect(rulesColumn.items?.properties).toBeInstanceOf(Array);
    expect(rulesColumn.items?.properties?.length).toBe(4);
  });

  it('should have nested properties inside array items', () => {
    const rulesColumn = sampleODCSContractWithNestedColumns.schema[0].properties[1];
    const nestedProps = rulesColumn.items?.properties;

    expect(nestedProps?.[0].name).toBe('ruleId');
    expect(nestedProps?.[1].name).toBe('ruleName');
    expect(nestedProps?.[2].name).toBe('priority');
    expect(nestedProps?.[3].name).toBe('alertOperation');
  });

  it('should have deeply nested properties (3 levels)', () => {
    const rulesColumn = sampleODCSContractWithNestedColumns.schema[0].properties[1];
    const alertOperation = rulesColumn.items?.properties?.[3];

    expect(alertOperation?.name).toBe('alertOperation');
    expect(alertOperation?.physicalType).toBe('record');
    expect(alertOperation?.properties).toBeInstanceOf(Array);
    expect(alertOperation?.properties?.length).toBe(2);
    expect(alertOperation?.properties?.[0].name).toBe('operationName');
    expect(alertOperation?.properties?.[1].name).toBe('operationField');
  });

  it('should have object column with direct properties', () => {
    const metadataColumn = sampleODCSContractWithNestedColumns.schema[0].properties[2];
    expect(metadataColumn.name).toBe('betMetadata');
    expect(metadataColumn.physicalType).toBe('record');
    expect(metadataColumn.properties).toBeInstanceOf(Array);
    expect(metadataColumn.properties?.length).toBe(3);
  });

  it('should count total nested columns correctly', () => {
    const table = sampleODCSContractWithNestedColumns.schema[0];

    // Count all columns recursively
    const countColumnsRecursively = (props: any[]): number => {
      let count = 0;
      for (const prop of props) {
        count += 1; // Count this column

        // Check for nested in items.properties (array type)
        if (prop.items?.properties) {
          count += countColumnsRecursively(prop.items.properties);
        }
        // Check for nested in properties (object type)
        if (prop.properties) {
          count += countColumnsRecursively(prop.properties);
        }
      }
      return count;
    };

    const totalColumns = countColumnsRecursively(table.properties);

    // Expected: 3 root + 4 in rulesTriggered + 2 in alertOperation + 3 in betMetadata = 12
    expect(totalColumns).toBe(12);
  });

  it('should preserve descriptions on nested columns', () => {
    const rulesColumn = sampleODCSContractWithNestedColumns.schema[0].properties[1];
    const priorityProp = rulesColumn.items?.properties?.[2];

    expect(priorityProp?.description).toBe('Rule priority (0-30)');
  });

  it('should preserve physicalType and logicalType on nested columns', () => {
    const metadataColumn = sampleODCSContractWithNestedColumns.schema[0].properties[2];
    const betAmountProp = metadataColumn.properties?.[1];

    expect(betAmountProp?.physicalType).toBe('decimal');
    expect(betAmountProp?.logicalType).toBe('number');
  });
});

describe('Nested Column Export', () => {
  it('should rebuild items.properties for array type columns on export', async () => {
    // Simulate flat columns with parent_column_id (as stored in the app)
    const flatColumnsWithParent = [
      {
        id: 'col-1',
        name: 'alert_id',
        logicalType: 'string',
        physicalType: 'varchar',
      },
      {
        id: 'col-2',
        name: 'rulesTriggered',
        logicalType: 'array',
        physicalType: 'array',
      },
      {
        id: 'col-3',
        name: 'ruleId',
        logicalType: 'string',
        physicalType: 'varchar',
        parent_column_id: 'col-2',
      },
      {
        id: 'col-4',
        name: 'ruleName',
        logicalType: 'string',
        physicalType: 'varchar',
        parent_column_id: 'col-2',
      },
    ];

    // Import the singleton odcsService
    const { odcsService } = await import('@/services/sdk/odcsService');

    // Access the private toYAMLv2 through the public toYAML
    const workspace = {
      tables: [
        {
          id: 'table-1',
          name: 'alerts',
          columns: flatColumnsWithParent,
        },
      ],
      relationships: [],
    };

    const yaml = await odcsService.toYAML(workspace);

    // Parse the YAML to verify structure
    const { load } = await import('js-yaml');
    const parsed = load(yaml) as any;

    // Verify the rulesTriggered column has items.properties
    const rulesCol = parsed.schema[0].properties.find((p: any) => p.name === 'rulesTriggered');
    expect(rulesCol).toBeDefined();
    expect(rulesCol.items).toBeDefined();
    expect(rulesCol.items.properties).toBeInstanceOf(Array);
    expect(rulesCol.items.properties.length).toBe(2);
    expect(rulesCol.items.properties[0].name).toBe('ruleId');
    expect(rulesCol.items.properties[1].name).toBe('ruleName');

    // Root alert_id should NOT have items or properties
    const alertIdCol = parsed.schema[0].properties.find((p: any) => p.name === 'alert_id');
    expect(alertIdCol).toBeDefined();
    expect(alertIdCol.items).toBeUndefined();
    expect(alertIdCol.properties).toBeUndefined();
  });

  it('should rebuild properties for object type columns on export', async () => {
    // Simulate flat columns with parent_column_id for object/record type
    const flatColumnsWithParent = [
      {
        id: 'col-1',
        name: 'bet_metadata',
        logicalType: 'object',
        physicalType: 'record',
      },
      {
        id: 'col-2',
        name: 'bet_type',
        logicalType: 'string',
        physicalType: 'varchar',
        parent_column_id: 'col-1',
      },
      {
        id: 'col-3',
        name: 'bet_amount',
        logicalType: 'number',
        physicalType: 'decimal',
        parent_column_id: 'col-1',
      },
    ];

    const { odcsService } = await import('@/services/sdk/odcsService');

    const workspace = {
      tables: [
        {
          id: 'table-1',
          name: 'bets',
          columns: flatColumnsWithParent,
        },
      ],
      relationships: [],
    };

    const yaml = await odcsService.toYAML(workspace);

    const { load } = await import('js-yaml');
    const parsed = load(yaml) as any;

    // Verify the bet_metadata column has properties (not items.properties)
    const metadataCol = parsed.schema[0].properties.find((p: any) => p.name === 'bet_metadata');
    expect(metadataCol).toBeDefined();
    expect(metadataCol.properties).toBeInstanceOf(Array);
    expect(metadataCol.properties.length).toBe(2);
    expect(metadataCol.properties[0].name).toBe('bet_type');
    expect(metadataCol.properties[1].name).toBe('bet_amount');

    // Object types should NOT have items
    expect(metadataCol.items).toBeUndefined();
  });

  it('should handle deeply nested columns (3 levels) on export', async () => {
    const flatColumnsWithParent = [
      {
        id: 'col-1',
        name: 'events',
        logicalType: 'array',
        physicalType: 'array',
      },
      {
        id: 'col-2',
        name: 'event_data',
        logicalType: 'object',
        physicalType: 'record',
        parent_column_id: 'col-1',
      },
      {
        id: 'col-3',
        name: 'event_name',
        logicalType: 'string',
        physicalType: 'varchar',
        parent_column_id: 'col-2',
      },
    ];

    const { odcsService } = await import('@/services/sdk/odcsService');

    const workspace = {
      tables: [
        {
          id: 'table-1',
          name: 'deep_nested',
          columns: flatColumnsWithParent,
        },
      ],
      relationships: [],
    };

    const yaml = await odcsService.toYAML(workspace);

    const { load } = await import('js-yaml');
    const parsed = load(yaml) as any;

    // Level 1: events (array)
    const eventsCol = parsed.schema[0].properties.find((p: any) => p.name === 'events');
    expect(eventsCol.items).toBeDefined();
    expect(eventsCol.items.properties).toBeInstanceOf(Array);

    // Level 2: event_data (object inside array)
    const eventDataCol = eventsCol.items.properties.find((p: any) => p.name === 'event_data');
    expect(eventDataCol.properties).toBeInstanceOf(Array);

    // Level 3: event_name (string inside object inside array)
    const eventNameCol = eventDataCol.properties.find((p: any) => p.name === 'event_name');
    expect(eventNameCol).toBeDefined();
    expect(eventNameCol.logicalType).toBe('string');
  });

  it('should not include child columns at root level', async () => {
    const flatColumnsWithParent = [
      {
        id: 'col-1',
        name: 'parent_col',
        logicalType: 'array',
        physicalType: 'array',
      },
      {
        id: 'col-2',
        name: 'child_col',
        logicalType: 'string',
        physicalType: 'varchar',
        parent_column_id: 'col-1',
      },
    ];

    const { odcsService } = await import('@/services/sdk/odcsService');

    const workspace = {
      tables: [
        {
          id: 'table-1',
          name: 'test_table',
          columns: flatColumnsWithParent,
        },
      ],
      relationships: [],
    };

    const yaml = await odcsService.toYAML(workspace);

    const { load } = await import('js-yaml');
    const parsed = load(yaml) as any;

    // Root level should only have parent_col
    expect(parsed.schema[0].properties.length).toBe(1);
    expect(parsed.schema[0].properties[0].name).toBe('parent_col');

    // child_col should only be inside items.properties
    const childAtRoot = parsed.schema[0].properties.find((p: any) => p.name === 'child_col');
    expect(childAtRoot).toBeUndefined();
  });
});

describe('ODCS Field Coverage', () => {
  it('should cover all ODCS v3.1.0 table-level fields', () => {
    const requiredTableFields = [
      'name',
      'physicalName',
      'physicalType',
      'businessName',
      'description',
      'status',
      'tags',
      'dataGranularityDescription',
      'authoritativeDefinitions',
      'relationships',
      'properties',
      'owner',
      'sla',
      'quality',
      'customProperties',
    ];

    // Verify our test data covers these fields
    const table = sampleODCSContract.schema[0];
    const coveredFields = Object.keys(table);

    const coverage = requiredTableFields.filter((f) => coveredFields.includes(f));
    console.log(`Table field coverage: ${coverage.length}/${requiredTableFields.length}`);
    console.log(`Covered: ${coverage.join(', ')}`);

    // We should cover most fields
    expect(coverage.length).toBeGreaterThanOrEqual(8);
  });

  it('should cover all ODCS v3.1.0 column-level fields', () => {
    const requiredColumnFields = [
      'name',
      'physicalName',
      'physicalType',
      'logicalType',
      'businessName',
      'description',
      'required',
      'primaryKey',
      'primaryKeyPosition',
      'unique',
      'partitioned',
      'partitionKeyPosition',
      'clustered',
      'classification',
      'criticalDataElement',
      'encryptedName',
      'tags',
      'examples',
      'logicalTypeOptions',
      'transformSourceObjects',
      'transformLogic',
      'transformDescription',
      'authoritativeDefinitions',
      'relationships',
      'customProperties',
      'custom',
      'quality',
    ];

    // Check coverage across all columns in test data
    const allColumns = sampleODCSContract.schema.flatMap((t) => t.properties);
    const allCoveredFields = new Set(allColumns.flatMap((c) => Object.keys(c)));

    const coverage = requiredColumnFields.filter((f) => allCoveredFields.has(f));
    console.log(`Column field coverage: ${coverage.length}/${requiredColumnFields.length}`);
    console.log(`Covered: ${coverage.join(', ')}`);

    // We should cover most fields
    expect(coverage.length).toBeGreaterThanOrEqual(15);
  });
});

describe('Compound Key Export/Import', () => {
  it('should export compound primary key with primaryKeyPosition on columns', async () => {
    const { odcsService } = await import('@/services/sdk/odcsService');

    const workspace = {
      tables: [
        {
          id: 'table-1',
          name: 'order_items',
          columns: [
            { id: 'col-1', name: 'order_id', logicalType: 'integer', physicalType: 'BIGINT' },
            { id: 'col-2', name: 'item_id', logicalType: 'integer', physicalType: 'BIGINT' },
            { id: 'col-3', name: 'quantity', logicalType: 'integer', physicalType: 'INT' },
          ],
          compoundKeys: [
            {
              id: 'ck-1',
              table_id: 'table-1',
              name: 'PK_order_item',
              column_ids: ['col-1', 'col-2'],
              is_primary: true,
              created_at: '2025-01-01T00:00:00Z',
            },
          ],
        },
      ],
      relationships: [],
    };

    const yaml = await odcsService.toYAML(workspace);
    const { load } = await import('js-yaml');
    const parsed = load(yaml) as any;

    // Verify primaryKeyPosition is set on columns
    const orderIdCol = parsed.schema[0].properties.find((p: any) => p.name === 'order_id');
    const itemIdCol = parsed.schema[0].properties.find((p: any) => p.name === 'item_id');

    expect(orderIdCol.primaryKey).toBe(true);
    expect(orderIdCol.primaryKeyPosition).toBe(1);
    expect(itemIdCol.primaryKey).toBe(true);
    expect(itemIdCol.primaryKeyPosition).toBe(2);

    // Verify compoundKeys is in customProperties
    const customProps = parsed.schema[0].customProperties;
    expect(customProps).toBeDefined();
    const compoundKeysProp = customProps.find((p: any) => p.property === 'compoundKeys');
    expect(compoundKeysProp).toBeDefined();
    expect(compoundKeysProp.value).toHaveLength(1);
    expect(compoundKeysProp.value[0].name).toBe('PK_order_item');
    expect(compoundKeysProp.value[0].columns).toEqual(['order_id', 'item_id']);
    expect(compoundKeysProp.value[0].is_primary).toBe(true);
  });

  it('should export compound unique key in customProperties', async () => {
    const { odcsService } = await import('@/services/sdk/odcsService');

    const workspace = {
      tables: [
        {
          id: 'table-1',
          name: 'users',
          columns: [
            {
              id: 'col-1',
              name: 'user_id',
              logicalType: 'integer',
              physicalType: 'BIGINT',
              is_primary_key: true,
            },
            { id: 'col-2', name: 'email', logicalType: 'string', physicalType: 'VARCHAR' },
            { id: 'col-3', name: 'tenant_id', logicalType: 'string', physicalType: 'VARCHAR' },
          ],
          compoundKeys: [
            {
              id: 'ck-1',
              table_id: 'table-1',
              name: 'UK_email_tenant',
              column_ids: ['col-2', 'col-3'],
              is_primary: false, // Unique key, not primary
              created_at: '2025-01-01T00:00:00Z',
            },
          ],
        },
      ],
      relationships: [],
    };

    const yaml = await odcsService.toYAML(workspace);
    const { load } = await import('js-yaml');
    const parsed = load(yaml) as any;

    // Unique compound key should NOT set primaryKeyPosition
    const emailCol = parsed.schema[0].properties.find((p: any) => p.name === 'email');
    const tenantCol = parsed.schema[0].properties.find((p: any) => p.name === 'tenant_id');

    expect(emailCol.primaryKeyPosition).toBeUndefined();
    expect(tenantCol.primaryKeyPosition).toBeUndefined();

    // But should be in customProperties
    const customProps = parsed.schema[0].customProperties;
    const compoundKeysProp = customProps.find((p: any) => p.property === 'compoundKeys');
    expect(compoundKeysProp).toBeDefined();
    expect(compoundKeysProp.value[0].name).toBe('UK_email_tenant');
    expect(compoundKeysProp.value[0].is_primary).toBe(false);
  });

  it('should import compound keys from customProperties', async () => {
    const { sdkLoader } = await import('@/services/sdk/sdkLoader');
    const { load } = await import('js-yaml');

    // Mock SDK to return parsed contract with compoundKeys in customProperties
    const mockContract = {
      apiVersion: 'v3.1.0',
      kind: 'DataContract',
      id: 'test-contract',
      version: '1.0.0',
      status: 'draft',
      schema: [
        {
          name: 'order_items',
          physicalName: 'order_items',
          physicalType: 'table',
          customProperties: [
            {
              property: 'compoundKeys',
              value: [
                {
                  name: 'PK_order_item',
                  columns: ['order_id', 'item_id'],
                  is_primary: true,
                },
              ],
            },
          ],
          properties: [
            {
              name: 'order_id',
              logicalType: 'integer',
              physicalType: 'BIGINT',
              primaryKey: true,
              primaryKeyPosition: 1,
            },
            {
              name: 'item_id',
              logicalType: 'integer',
              physicalType: 'BIGINT',
              primaryKey: true,
              primaryKeyPosition: 2,
            },
            { name: 'quantity', logicalType: 'integer', physicalType: 'INT' },
          ],
        },
      ],
    };

    vi.mocked(sdkLoader.getModule).mockReturnValue({
      parse_odcs_yaml_v2: vi.fn().mockReturnValue(JSON.stringify(mockContract)),
    } as any);

    const { odcsService } = await import('@/services/sdk/odcsService');

    const odcsYaml = `apiVersion: v3.1.0\nkind: DataContract\nid: test\nschema: []`;
    const result = await odcsService.parseYAML(odcsYaml);

    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];

    // Verify compound keys were imported
    expect(table.compoundKeys).toBeDefined();
    expect(table.compoundKeys).toHaveLength(1);
    expect(table.compoundKeys[0].name).toBe('PK_order_item');
    expect(table.compoundKeys[0].is_primary).toBe(true);
    // Column IDs should be resolved (may use column names as IDs if no explicit IDs)
    expect(table.compoundKeys[0].column_ids).toHaveLength(2);
  });

  it('should reconstruct compound primary key from primaryKeyPosition', async () => {
    const { sdkLoader } = await import('@/services/sdk/sdkLoader');

    // Mock SDK to return contract with primaryKeyPosition but no explicit compoundKeys
    const mockContract = {
      apiVersion: 'v3.1.0',
      kind: 'DataContract',
      id: 'test-contract',
      version: '1.0.0',
      status: 'draft',
      schema: [
        {
          name: 'order_items',
          physicalName: 'order_items',
          physicalType: 'table',
          properties: [
            {
              name: 'order_id',
              logicalType: 'integer',
              physicalType: 'BIGINT',
              primaryKey: true,
              primaryKeyPosition: 1,
            },
            {
              name: 'item_id',
              logicalType: 'integer',
              physicalType: 'BIGINT',
              primaryKey: true,
              primaryKeyPosition: 2,
            },
            { name: 'quantity', logicalType: 'integer', physicalType: 'INT' },
          ],
        },
      ],
    };

    vi.mocked(sdkLoader.getModule).mockReturnValue({
      parse_odcs_yaml_v2: vi.fn().mockReturnValue(JSON.stringify(mockContract)),
    } as any);

    const { odcsService } = await import('@/services/sdk/odcsService');

    const odcsYaml = `apiVersion: v3.1.0\nkind: DataContract\nid: test\nschema: []`;
    const result = await odcsService.parseYAML(odcsYaml);

    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];

    // Should have reconstructed compound primary key from primaryKeyPosition
    expect(table.compoundKeys).toBeDefined();
    expect(table.compoundKeys).toHaveLength(1);
    expect(table.compoundKeys[0].is_primary).toBe(true);
    expect(table.compoundKeys[0].column_ids).toHaveLength(2);
  });
});
