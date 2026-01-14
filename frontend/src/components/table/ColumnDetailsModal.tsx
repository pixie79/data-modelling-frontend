/**
 * Column Details Modal
 * Pop-out modal for editing column properties including ODCS v3.1.0 fields,
 * quality rules, and metadata with tooltips and dropdowns
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useUIStore } from '@/stores/uiStore';
import type { Column, AuthoritativeDefinition, CustomProperty } from '@/types/table';

export interface ColumnDetailsModalProps {
  column: Column;
  tableId: string;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (columnId: string, updates: Partial<Column>) => Promise<void>;
}

export interface QualityRule {
  type:
    | 'duplicate_count'
    | 'valid_values'
    | 'string_constraints'
    | 'numeric_constraints'
    | 'pattern'
    | 'format';
  enabled: boolean;
  value?: string | number | string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'email' | 'uuid' | 'url' | 'date' | 'datetime' | 'phone';
  minimum?: number;
  maximum?: number;
  validValues?: string[];
}

// Tooltip component for field descriptions
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="group relative inline-flex items-center">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal max-w-xs z-50 shadow-lg">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
    </div>
  </div>
);

// Info icon for tooltips
const InfoIcon: React.FC = () => (
  <svg
    className="w-4 h-4 text-gray-400 ml-1 cursor-help"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// Label with tooltip
const LabelWithTooltip: React.FC<{ label: string; tooltip: string; required?: boolean }> = ({
  label,
  tooltip,
  required,
}) => (
  <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
    {label}
    {required && <span className="text-red-500 ml-1">*</span>}
    <Tooltip text={tooltip}>
      <InfoIcon />
    </Tooltip>
  </label>
);

// Classification options (ODCS standard)
const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'Select classification...' },
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'pii', label: 'PII (Personal Identifiable Information)' },
  { value: 'phi', label: 'PHI (Protected Health Information)' },
  { value: 'pci', label: 'PCI (Payment Card Industry)' },
  { value: 'sensitive', label: 'Sensitive' },
];

// ODCS v3.1.0 Logical Types
const LOGICAL_TYPE_OPTIONS = [
  { value: '', label: 'Select logical type...' },
  { value: 'string', label: 'String' },
  { value: 'date', label: 'Date' },
  { value: 'timestamp', label: 'Timestamp' },
  { value: 'time', label: 'Time' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
  { value: 'boolean', label: 'Boolean' },
];

// Common Physical Types by Database
const PHYSICAL_TYPE_OPTIONS = [
  { value: '', label: 'Select physical type...' },
  // String types
  { value: 'VARCHAR', label: 'VARCHAR' },
  { value: 'VARCHAR(255)', label: 'VARCHAR(255)' },
  { value: 'TEXT', label: 'TEXT' },
  { value: 'CHAR', label: 'CHAR' },
  { value: 'STRING', label: 'STRING (Databricks/Cassandra)' },
  // Numeric types
  { value: 'INT', label: 'INT' },
  { value: 'INTEGER', label: 'INTEGER' },
  { value: 'BIGINT', label: 'BIGINT' },
  { value: 'SMALLINT', label: 'SMALLINT' },
  { value: 'TINYINT', label: 'TINYINT' },
  { value: 'FLOAT', label: 'FLOAT' },
  { value: 'DOUBLE', label: 'DOUBLE' },
  { value: 'DECIMAL', label: 'DECIMAL' },
  { value: 'DECIMAL(10,2)', label: 'DECIMAL(10,2)' },
  { value: 'NUMERIC', label: 'NUMERIC' },
  { value: 'REAL', label: 'REAL' },
  // Date/Time types
  { value: 'DATE', label: 'DATE' },
  { value: 'TIME', label: 'TIME' },
  { value: 'TIMESTAMP', label: 'TIMESTAMP' },
  { value: 'DATETIME', label: 'DATETIME' },
  { value: 'TIMESTAMP_NTZ', label: 'TIMESTAMP_NTZ (Databricks)' },
  { value: 'TIMESTAMP_LTZ', label: 'TIMESTAMP_LTZ (Databricks)' },
  // Boolean
  { value: 'BOOLEAN', label: 'BOOLEAN' },
  { value: 'BIT', label: 'BIT (MSSQL)' },
  // Binary
  { value: 'BINARY', label: 'BINARY' },
  { value: 'VARBINARY', label: 'VARBINARY' },
  { value: 'BLOB', label: 'BLOB' },
  { value: 'BYTEA', label: 'BYTEA (PostgreSQL)' },
  // UUID
  { value: 'UUID', label: 'UUID' },
  { value: 'UNIQUEIDENTIFIER', label: 'UNIQUEIDENTIFIER (MSSQL)' },
  // JSON/Complex
  { value: 'JSON', label: 'JSON' },
  { value: 'JSONB', label: 'JSONB (PostgreSQL)' },
  { value: 'ARRAY', label: 'ARRAY' },
  { value: 'MAP', label: 'MAP (Databricks/Cassandra)' },
  { value: 'STRUCT', label: 'STRUCT (Databricks)' },
  // Cassandra specific
  { value: 'COUNTER', label: 'COUNTER (Cassandra)' },
  { value: 'TIMEUUID', label: 'TIMEUUID (Cassandra)' },
  { value: 'INET', label: 'INET (Cassandra/PostgreSQL)' },
  { value: 'VARINT', label: 'VARINT (Cassandra)' },
];

// Authoritative definition type options
const AUTH_DEFINITION_TYPES = [
  { value: 'business-glossary', label: 'Business Glossary' },
  { value: 'data-dictionary', label: 'Data Dictionary' },
  { value: 'data-catalog', label: 'Data Catalog' },
  { value: 'master-data', label: 'Master Data Management' },
  { value: 'regulatory', label: 'Regulatory Definition' },
  { value: 'industry-standard', label: 'Industry Standard' },
  { value: 'custom', label: 'Custom' },
];

// Section header component
const SectionHeader: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="border-b border-gray-200 pb-2 mb-4">
    <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
  </div>
);

export const ColumnDetailsModal: React.FC<ColumnDetailsModalProps> = ({
  column,
  isOpen,
  onClose,
  onSave,
}) => {
  const { addToast } = useUIStore();

  // Basic Properties
  const [description, setDescription] = useState<string>('');
  const [defaultValue, setDefaultValue] = useState<string>(column.default_value || '');

  // ODCS Naming
  const [businessName, setBusinessName] = useState<string>('');
  const [physicalName, setPhysicalName] = useState<string>('');
  const [physicalType, setPhysicalType] = useState<string>('');
  const [logicalType, setLogicalType] = useState<string>('');

  // Data Governance
  const [classification, setClassification] = useState<string>('');
  const [criticalDataElement, setCriticalDataElement] = useState<boolean>(false);
  const [authoritativeDefinitions, setAuthoritativeDefinitions] = useState<
    AuthoritativeDefinition[]
  >([]);

  // Data Engineering
  const [partitioned, setPartitioned] = useState<boolean>(false);
  const [partitionKeyPosition, setPartitionKeyPosition] = useState<number | undefined>();
  const [clustered, setClustered] = useState<boolean>(false);
  const [encryptedName, setEncryptedName] = useState<string>('');

  // Transformations
  const [transformSourceObjects, setTransformSourceObjects] = useState<string[]>([]);
  const [transformLogic, setTransformLogic] = useState<string>('');
  const [transformDescription, setTransformDescription] = useState<string>('');

  // Documentation
  const [examples, setExamples] = useState<string[]>([]);
  const [tags, setTags] = useState<Array<{ key?: string; value: string }>>([]);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>([]);

  // Quality Rules
  const [qualityRules, setQualityRules] = useState<QualityRule[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'basic' | 'governance' | 'engineering' | 'transform' | 'quality'
  >('basic');

  // Initialize from column data
  useEffect(() => {
    // Basic properties
    setDescription(column.description || '');
    setDefaultValue(column.default_value || '');

    // ODCS Naming
    setBusinessName(column.businessName || '');
    setPhysicalName(column.physicalName || '');
    setPhysicalType(column.physicalType || '');
    setLogicalType(column.logicalType || '');

    // Data Governance
    setClassification(column.classification || '');
    setCriticalDataElement(column.criticalDataElement || false);
    setAuthoritativeDefinitions(column.authoritativeDefinitions || []);

    // Data Engineering
    setPartitioned(column.partitioned || false);
    setPartitionKeyPosition(column.partitionKeyPosition);
    setClustered(column.clustered || false);
    setEncryptedName(column.encryptedName || '');

    // Transformations
    setTransformSourceObjects(column.transformSourceObjects || []);
    setTransformLogic(column.transformLogic || '');
    setTransformDescription(column.transformDescription || '');

    // Documentation
    setExamples(column.examples || []);
    setTags(column.tags || []);
    setCustomProperties(column.customProperties || []);

    // Parse quality rules from constraints
    const allConstraints: Record<string, unknown> = {
      ...(column.constraints || {}),
    };

    // Helper to extract quality rules from great-expectations format
    const extractFromQualityArray = (qualityArray: unknown[]) => {
      qualityArray.forEach((qualityRule: any) => {
        if (qualityRule.implementation && qualityRule.implementation.kwargs) {
          if (
            qualityRule.implementation.kwargs.value_set &&
            Array.isArray(qualityRule.implementation.kwargs.value_set)
          ) {
            allConstraints.validValues = qualityRule.implementation.kwargs.value_set;
          }
          if (qualityRule.implementation.kwargs.min_value !== undefined) {
            allConstraints.minimum = qualityRule.implementation.kwargs.min_value;
          }
          if (qualityRule.implementation.kwargs.max_value !== undefined) {
            allConstraints.maximum = qualityRule.implementation.kwargs.max_value;
          }
          if (qualityRule.implementation.kwargs.regex) {
            allConstraints.pattern = qualityRule.implementation.kwargs.regex;
          }
        }
      });
    };

    if (Array.isArray(column.quality_rules)) {
      extractFromQualityArray(column.quality_rules);
    } else if (column.quality_rules && typeof column.quality_rules === 'object') {
      Object.assign(allConstraints, column.quality_rules);
    }

    const rawQuality = (column as any).quality;
    if (Array.isArray(rawQuality)) {
      extractFromQualityArray(rawQuality);
    }

    if (column.constraints) {
      if (column.constraints.validValues) {
        allConstraints.validValues = column.constraints.validValues;
      }
      if (column.constraints.valid_values) {
        allConstraints.validValues = column.constraints.valid_values;
      }
    }

    if (Object.keys(allConstraints).length > 0) {
      const rules: QualityRule[] = [];

      if (allConstraints.minLength !== undefined || allConstraints.maxLength !== undefined) {
        rules.push({
          type: 'string_constraints',
          enabled: true,
          minLength: allConstraints.minLength as number,
          maxLength: allConstraints.maxLength as number,
        });
      }

      if (allConstraints.pattern) {
        rules.push({
          type: 'pattern',
          enabled: true,
          pattern: allConstraints.pattern as string,
        });
      }

      if (allConstraints.format) {
        rules.push({
          type: 'format',
          enabled: true,
          format: allConstraints.format as QualityRule['format'],
        });
      }

      if (allConstraints.minimum !== undefined || allConstraints.maximum !== undefined) {
        rules.push({
          type: 'numeric_constraints',
          enabled: true,
          minimum: allConstraints.minimum as number,
          maximum: allConstraints.maximum as number,
        });
      }

      if (allConstraints.validValues || allConstraints.valid_values) {
        const validValuesArray = Array.isArray(allConstraints.validValues)
          ? allConstraints.validValues
          : Array.isArray(allConstraints.valid_values)
            ? allConstraints.valid_values
            : [];
        if (validValuesArray.length > 0) {
          rules.push({
            type: 'valid_values',
            enabled: true,
            validValues: validValuesArray,
          });
        }
      }

      setQualityRules(rules);
    }

    // Store other metadata
    const otherMetadata: Record<string, unknown> = {};
    if (Object.keys(allConstraints).length > 0) {
      Object.keys(allConstraints).forEach((key) => {
        if (
          ![
            'minLength',
            'maxLength',
            'pattern',
            'format',
            'minimum',
            'maximum',
            'validValues',
            'valid_values',
            'description',
          ].includes(key)
        ) {
          otherMetadata[key] = allConstraints[key];
        }
      });
    }
    setMetadata(otherMetadata);
  }, [column]);

  // Authoritative Definition handlers
  const handleAddAuthDefinition = () => {
    setAuthoritativeDefinitions([
      ...authoritativeDefinitions,
      { type: 'business-glossary', url: '' },
    ]);
  };

  const handleUpdateAuthDefinition = (index: number, updates: Partial<AuthoritativeDefinition>) => {
    setAuthoritativeDefinitions((defs) =>
      defs.map((def, i) => (i === index ? { ...def, ...updates } : def))
    );
  };

  const handleRemoveAuthDefinition = (index: number) => {
    setAuthoritativeDefinitions((defs) => defs.filter((_, i) => i !== index));
  };

  // Tag handlers
  const handleAddTag = () => {
    setTags([...tags, { key: '', value: '' }]);
  };

  const handleUpdateTag = (index: number, updates: Partial<{ key: string; value: string }>) => {
    setTags((t) => t.map((tag, i) => (i === index ? { ...tag, ...updates } : tag)));
  };

  const handleRemoveTag = (index: number) => {
    setTags((t) => t.filter((_, i) => i !== index));
  };

  // Custom property handlers (using ODCS v3.1.0 array format)
  const handleAddCustomProperty = () => {
    const newProp: CustomProperty = {
      property: `property_${customProperties.length + 1}`,
      value: '',
    };
    setCustomProperties([...customProperties, newProp]);
  };

  const handleUpdateCustomProperty = (index: number, property: string, value: unknown) => {
    setCustomProperties((props) => props.map((p, i) => (i === index ? { property, value } : p)));
  };

  const handleRemoveCustomProperty = (index: number) => {
    setCustomProperties((props) => props.filter((_, i) => i !== index));
  };

  // Quality rule handlers
  const handleAddQualityRule = (type: QualityRule['type']) => {
    setQualityRules([...qualityRules, { type, enabled: true }]);
  };

  const handleUpdateQualityRule = (index: number, updates: Partial<QualityRule>) => {
    setQualityRules((rules) =>
      rules.map((rule, i) => (i === index ? { ...rule, ...updates } : rule))
    );
  };

  const handleRemoveQualityRule = (index: number) => {
    setQualityRules((rules) => rules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build constraints object from quality rules
      const constraints: Record<string, unknown> = {};

      if (description) {
        constraints.description = description;
      }

      qualityRules.forEach((rule) => {
        if (!rule.enabled) return;

        switch (rule.type) {
          case 'string_constraints':
            if (rule.minLength !== undefined) constraints.minLength = rule.minLength;
            if (rule.maxLength !== undefined) constraints.maxLength = rule.maxLength;
            break;
          case 'pattern':
            if (rule.pattern) constraints.pattern = rule.pattern;
            break;
          case 'format':
            if (rule.format) constraints.format = rule.format;
            break;
          case 'numeric_constraints':
            if (rule.minimum !== undefined) constraints.minimum = rule.minimum;
            if (rule.maximum !== undefined) constraints.maximum = rule.maximum;
            break;
          case 'valid_values':
            if (rule.validValues && rule.validValues.length > 0) {
              constraints.validValues = rule.validValues;
            }
            break;
        }
      });

      // Merge with existing metadata
      const updatedConstraints = { ...constraints, ...metadata };

      // Build the complete column update
      const columnUpdate: Partial<Column> = {
        // Basic Properties
        default_value: defaultValue || undefined,
        description: description || undefined,
        constraints: Object.keys(updatedConstraints).length > 0 ? updatedConstraints : undefined,
        quality_rules: Object.keys(updatedConstraints).length > 0 ? updatedConstraints : undefined,

        // ODCS Naming
        businessName: businessName || undefined,
        physicalName: physicalName || undefined,
        physicalType: physicalType || undefined,
        logicalType: logicalType || undefined,

        // Data Governance
        classification: classification || undefined,
        criticalDataElement: criticalDataElement || undefined,
        authoritativeDefinitions:
          authoritativeDefinitions.length > 0
            ? authoritativeDefinitions.filter((d) => d.url)
            : undefined,

        // Data Engineering
        partitioned: partitioned || undefined,
        partitionKeyPosition: partitionKeyPosition,
        clustered: clustered || undefined,
        encryptedName: encryptedName || undefined,

        // Transformations
        transformSourceObjects:
          transformSourceObjects.length > 0 ? transformSourceObjects.filter((s) => s) : undefined,
        transformLogic: transformLogic || undefined,
        transformDescription: transformDescription || undefined,

        // Documentation
        examples: examples.length > 0 ? examples.filter((e) => e) : undefined,
        tags: tags.length > 0 ? tags.filter((t) => t.value) : undefined,
        customProperties: customProperties.length > 0 ? customProperties : undefined,
      };

      await onSave(column.id, columnUpdate);

      addToast({
        type: 'success',
        message: 'Column details saved successfully',
      });
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to save column details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'basic' as const, label: 'Basic', icon: '📝' },
    { id: 'governance' as const, label: 'Governance', icon: '🔒' },
    { id: 'engineering' as const, label: 'Engineering', icon: '⚙️' },
    { id: 'transform' as const, label: 'Transform', icon: '🔄' },
    { id: 'quality' as const, label: 'Quality', icon: '✓' },
  ];

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Column Details: ${column.name}`}
      size="lg"
      initialPosition={{ x: 100, y: 50 }}
    >
      <div className="flex flex-col h-[600px]">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-2">
          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <SectionHeader
                title="Naming & Identity"
                description="Define how this column is identified across different contexts"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithTooltip
                    label="Business Name"
                    tooltip="A human-friendly name for business users. Used in reports and documentation."
                  />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g., Customer Full Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <LabelWithTooltip
                    label="Physical Name"
                    tooltip="The actual column name in the physical database. May differ from logical name due to naming conventions."
                  />
                  <input
                    type="text"
                    value={physicalName}
                    onChange={(e) => setPhysicalName(e.target.value)}
                    placeholder="e.g., cust_full_nm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <LabelWithTooltip
                  label="Description"
                  tooltip="Detailed description of the column's purpose, content, and business meaning."
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this column contains and how it should be used..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <LabelWithTooltip
                  label="Default Value"
                  tooltip="The default value assigned when no value is provided during insert operations."
                />
                <input
                  type="text"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="e.g., 0, 'N/A', CURRENT_TIMESTAMP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <LabelWithTooltip
                  label="Examples"
                  tooltip="Example values to help understand the expected data format and content."
                />
                <input
                  type="text"
                  value={examples.join(', ')}
                  onChange={(e) =>
                    setExamples(
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s)
                    )
                  }
                  placeholder="e.g., John Doe, Jane Smith, Bob Wilson"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list of example values</p>
              </div>
            </div>
          )}

          {/* Governance Tab */}
          {activeTab === 'governance' && (
            <div className="space-y-6">
              <SectionHeader
                title="Data Classification"
                description="Define security and compliance requirements for this column"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithTooltip
                    label="Classification"
                    tooltip="Data sensitivity level that determines access controls and handling requirements."
                  />
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CLASSIFICATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <LabelWithTooltip
                    label="Critical Data Element"
                    tooltip="Mark if this column is essential for business operations and requires additional oversight."
                  />
                  <div className="flex items-center h-10">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={criticalDataElement}
                        onChange={(e) => setCriticalDataElement(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Yes, this is a critical data element
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <LabelWithTooltip
                  label="Encrypted Column Name"
                  tooltip="If this column has an encrypted version, specify its name here."
                />
                <input
                  type="text"
                  value={encryptedName}
                  onChange={(e) => setEncryptedName(e.target.value)}
                  placeholder="e.g., customer_ssn_encrypted"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <SectionHeader
                title="Authoritative Definitions"
                description="Link to official sources that define this data element"
              />

              <div className="space-y-3">
                {authoritativeDefinitions.map((def, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Type</label>
                        <select
                          value={def.type}
                          onChange={(e) =>
                            handleUpdateAuthDefinition(index, { type: e.target.value })
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          {AUTH_DEFINITION_TYPES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">URL</label>
                        <input
                          type="url"
                          value={def.url}
                          onChange={(e) =>
                            handleUpdateAuthDefinition(index, { url: e.target.value })
                          }
                          placeholder="https://..."
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAuthDefinition(index)}
                      className="text-red-600 hover:text-red-800 text-sm mt-5"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddAuthDefinition}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>+</span> Add Authoritative Definition
                </button>
              </div>

              <SectionHeader
                title="Tags"
                description="Add metadata tags for categorization and discovery"
              />

              <div className="space-y-3">
                {tags.map((tag, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={tag.key || ''}
                      onChange={(e) => handleUpdateTag(index, { key: e.target.value })}
                      placeholder="Key (optional)"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <span className="text-gray-400">=</span>
                    <input
                      type="text"
                      value={tag.value}
                      onChange={(e) => handleUpdateTag(index, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <button
                      onClick={() => handleRemoveTag(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddTag}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>+</span> Add Tag
                </button>
              </div>
            </div>
          )}

          {/* Engineering Tab */}
          {activeTab === 'engineering' && (
            <div className="space-y-6">
              <SectionHeader
                title="Physical & Logical Types"
                description="Define physical storage type and logical data type for this column"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithTooltip
                    label="Physical Type"
                    tooltip="The actual database column type (e.g., VARCHAR(255), INT8, DECIMAL(10,2)). This is the type used in the physical database."
                  />
                  <select
                    value={physicalType}
                    onChange={(e) => setPhysicalType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PHYSICAL_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <LabelWithTooltip
                    label="Logical Type"
                    tooltip="The abstract data type (e.g., string, integer, boolean, date). Used for logical data modeling independent of database."
                  />
                  <select
                    value={logicalType}
                    onChange={(e) => setLogicalType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {LOGICAL_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <SectionHeader
                title="Storage & Performance"
                description="Configure how this column is stored and optimized"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithTooltip
                    label="Partitioned"
                    tooltip="Enable if this column is used for table partitioning to improve query performance."
                  />
                  <div className="flex items-center h-10">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={partitioned}
                        onChange={(e) => setPartitioned(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Used for partitioning</span>
                    </label>
                  </div>
                </div>
                {partitioned && (
                  <div>
                    <LabelWithTooltip
                      label="Partition Key Position"
                      tooltip="Position in composite partition key (1-indexed). Use 1 for single-column partition."
                    />
                    <input
                      type="number"
                      min={1}
                      value={partitionKeyPosition || ''}
                      onChange={(e) =>
                        setPartitionKeyPosition(
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                      placeholder="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <LabelWithTooltip
                  label="Clustered"
                  tooltip="Enable if this column is used for table clustering to co-locate related data."
                />
                <div className="flex items-center h-10">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clustered}
                      onChange={(e) => setClustered(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Used for clustering</span>
                  </label>
                </div>
              </div>

              <SectionHeader
                title="Custom Properties"
                description="Add custom metadata properties for this column"
              />

              <div className="space-y-3">
                {customProperties.map((prop, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={prop.property}
                      onChange={(e) =>
                        handleUpdateCustomProperty(index, e.target.value, prop.value)
                      }
                      placeholder="Property name"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <span className="text-gray-400">:</span>
                    <input
                      type="text"
                      value={String(prop.value)}
                      onChange={(e) =>
                        handleUpdateCustomProperty(index, prop.property, e.target.value)
                      }
                      placeholder="Value"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <button
                      onClick={() => handleRemoveCustomProperty(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddCustomProperty}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>+</span> Add Custom Property
                </button>
              </div>
            </div>
          )}

          {/* Transform Tab */}
          {activeTab === 'transform' && (
            <div className="space-y-6">
              <SectionHeader
                title="Transformation Logic"
                description="Document how this column is derived or transformed"
              />

              <div>
                <LabelWithTooltip
                  label="Source Objects"
                  tooltip="List of source tables, columns, or objects used to derive this column's value."
                />
                <input
                  type="text"
                  value={transformSourceObjects.join(', ')}
                  onChange={(e) =>
                    setTransformSourceObjects(
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s)
                    )
                  }
                  placeholder="e.g., orders.total_amount, customers.discount_rate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list of source objects</p>
              </div>

              <div>
                <LabelWithTooltip
                  label="Transform Logic"
                  tooltip="The formula, SQL expression, or code used to calculate this column's value."
                />
                <textarea
                  value={transformLogic}
                  onChange={(e) => setTransformLogic(e.target.value)}
                  placeholder="e.g., COALESCE(orders.total_amount * (1 - customers.discount_rate), 0)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={4}
                />
              </div>

              <div>
                <LabelWithTooltip
                  label="Transform Description"
                  tooltip="A plain-language explanation of the transformation logic for documentation."
                />
                <textarea
                  value={transformDescription}
                  onChange={(e) => setTransformDescription(e.target.value)}
                  placeholder="Describe the transformation in plain language..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Quality Tab */}
          {activeTab === 'quality' && (
            <div className="space-y-6">
              <SectionHeader
                title="Quality Rules"
                description="Define data quality constraints and validation rules"
              />

              <div className="flex items-center gap-2 mb-4">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddQualityRule(e.target.value as QualityRule['type']);
                      e.target.value = '';
                    }
                  }}
                  className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Add Quality Rule...</option>
                  <option value="string_constraints">String Constraints (min/max length)</option>
                  <option value="numeric_constraints">Numeric Constraints (min/max value)</option>
                  <option value="pattern">Pattern (regex validation)</option>
                  <option value="format">Format (email, UUID, date, etc.)</option>
                  <option value="valid_values">Valid Values (enumeration)</option>
                </select>
              </div>

              {qualityRules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No quality rules defined</p>
                  <p className="text-xs mt-1">Use the dropdown above to add validation rules</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qualityRules.map((rule, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) =>
                              handleUpdateQualityRule(index, { enabled: e.target.checked })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {rule.type.replace(/_/g, ' ')}
                          </span>
                        </label>
                        <button
                          onClick={() => handleRemoveQualityRule(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      {rule.type === 'string_constraints' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <LabelWithTooltip
                              label="Min Length"
                              tooltip="Minimum number of characters allowed"
                            />
                            <input
                              type="number"
                              min={0}
                              value={rule.minLength ?? ''}
                              onChange={(e) =>
                                handleUpdateQualityRule(index, {
                                  minLength: e.target.value
                                    ? parseInt(e.target.value, 10)
                                    : undefined,
                                })
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <LabelWithTooltip
                              label="Max Length"
                              tooltip="Maximum number of characters allowed"
                            />
                            <input
                              type="number"
                              min={0}
                              value={rule.maxLength ?? ''}
                              onChange={(e) =>
                                handleUpdateQualityRule(index, {
                                  maxLength: e.target.value
                                    ? parseInt(e.target.value, 10)
                                    : undefined,
                                })
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="255"
                            />
                          </div>
                        </div>
                      )}

                      {rule.type === 'numeric_constraints' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <LabelWithTooltip
                              label="Minimum"
                              tooltip="Minimum numeric value allowed"
                            />
                            <input
                              type="number"
                              value={rule.minimum ?? ''}
                              onChange={(e) =>
                                handleUpdateQualityRule(index, {
                                  minimum: e.target.value ? parseFloat(e.target.value) : undefined,
                                })
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <LabelWithTooltip
                              label="Maximum"
                              tooltip="Maximum numeric value allowed"
                            />
                            <input
                              type="number"
                              value={rule.maximum ?? ''}
                              onChange={(e) =>
                                handleUpdateQualityRule(index, {
                                  maximum: e.target.value ? parseFloat(e.target.value) : undefined,
                                })
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="100"
                            />
                          </div>
                        </div>
                      )}

                      {rule.type === 'pattern' && (
                        <div>
                          <LabelWithTooltip
                            label="Regex Pattern"
                            tooltip="Regular expression pattern that values must match"
                          />
                          <input
                            type="text"
                            value={rule.pattern || ''}
                            onChange={(e) =>
                              handleUpdateQualityRule(index, { pattern: e.target.value })
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                            placeholder="^[A-Z]{2}[0-9]{4}$"
                          />
                        </div>
                      )}

                      {rule.type === 'format' && (
                        <div>
                          <LabelWithTooltip
                            label="Format"
                            tooltip="Predefined format that values must conform to"
                          />
                          <select
                            value={rule.format || ''}
                            onChange={(e) =>
                              handleUpdateQualityRule(index, {
                                format: e.target.value as QualityRule['format'],
                              })
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value="">Select format...</option>
                            <option value="email">Email Address</option>
                            <option value="uuid">UUID</option>
                            <option value="url">URL</option>
                            <option value="date">Date (YYYY-MM-DD)</option>
                            <option value="datetime">DateTime (ISO 8601)</option>
                            <option value="phone">Phone Number</option>
                          </select>
                        </div>
                      )}

                      {rule.type === 'valid_values' && (
                        <div>
                          <LabelWithTooltip
                            label="Valid Values"
                            tooltip="List of allowed values (enumeration)"
                          />
                          <input
                            type="text"
                            value={rule.validValues?.join(', ') || ''}
                            onChange={(e) =>
                              handleUpdateQualityRule(index, {
                                validValues: e.target.value
                                  .split(',')
                                  .map((v) => v.trim())
                                  .filter((v) => v.length > 0),
                              })
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            placeholder="active, inactive, pending"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Comma-separated list of valid values
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </DraggableModal>
  );
};
