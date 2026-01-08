/**
 * Column Details Modal
 * Pop-out modal for editing column properties including quality rules and metadata
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useUIStore } from '@/stores/uiStore';
import type { Column } from '@/types/table';

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

export const ColumnDetailsModal: React.FC<ColumnDetailsModalProps> = ({
  column,
  isOpen,
  onClose,
  onSave,
}) => {
  const { addToast } = useUIStore();
  const [description, setDescription] = useState<string>('');
  const [defaultValue, setDefaultValue] = useState<string>(column.default_value || '');
  const [qualityRules, setQualityRules] = useState<QualityRule[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from column constraints, quality_rules, quality, and metadata
  useEffect(() => {
    console.log('[ColumnDetailsModal] Initializing with column:', {
      name: column.name,
      description: column.description,
      constraints: column.constraints,
      quality_rules: column.quality_rules,
      quality: (column as any).quality, // Raw SDK quality array
    });

    // Combine constraints and quality_rules
    const allConstraints: Record<string, unknown> = {
      ...(column.constraints || {}),
    };

    // Helper to extract quality rules from great-expectations format
    const extractFromQualityArray = (qualityArray: unknown[]) => {
      qualityArray.forEach((qualityRule: any) => {
        if (qualityRule.implementation && qualityRule.implementation.kwargs) {
          // Extract value_set from great-expectations format
          if (
            qualityRule.implementation.kwargs.value_set &&
            Array.isArray(qualityRule.implementation.kwargs.value_set)
          ) {
            allConstraints.validValues = qualityRule.implementation.kwargs.value_set;
            console.log(
              '[ColumnDetailsModal] Extracted validValues from quality:',
              allConstraints.validValues
            );
          }
          // Extract min/max values
          if (qualityRule.implementation.kwargs.min_value !== undefined) {
            allConstraints.minimum = qualityRule.implementation.kwargs.min_value;
          }
          if (qualityRule.implementation.kwargs.max_value !== undefined) {
            allConstraints.maximum = qualityRule.implementation.kwargs.max_value;
          }
          // Extract regex pattern
          if (qualityRule.implementation.kwargs.regex) {
            allConstraints.pattern = qualityRule.implementation.kwargs.regex;
          }
        }
      });
    };

    // Handle quality array format (ODCL) - extract rules from array
    if (Array.isArray(column.quality_rules)) {
      console.log('[ColumnDetailsModal] Processing quality_rules array:', column.quality_rules);
      extractFromQualityArray(column.quality_rules);
    } else if (column.quality_rules && typeof column.quality_rules === 'object') {
      // Handle quality_rules as an object
      Object.assign(allConstraints, column.quality_rules);
    }

    // Also check raw 'quality' array from SDK (ODCL format)
    const rawQuality = (column as any).quality;
    if (Array.isArray(rawQuality)) {
      console.log('[ColumnDetailsModal] Processing raw quality array:', rawQuality);
      extractFromQualityArray(rawQuality);
    }

    // Also check constraints for validValues
    if (column.constraints) {
      if (column.constraints.validValues) {
        allConstraints.validValues = column.constraints.validValues;
      }
      if (column.constraints.valid_values) {
        allConstraints.validValues = column.constraints.valid_values;
      }
    }

    console.log('[ColumnDetailsModal] All constraints after processing:', allConstraints);

    if (Object.keys(allConstraints).length > 0) {
      // Parse quality rules from constraints
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

    // Extract description from column or constraints
    if (column.description) {
      setDescription(column.description);
      console.log(
        '[ColumnDetailsModal] Set description from column.description:',
        column.description
      );
    } else if (allConstraints.description) {
      setDescription(allConstraints.description as string);
      console.log(
        '[ColumnDetailsModal] Set description from constraints:',
        allConstraints.description
      );
    } else {
      console.warn('[ColumnDetailsModal] No description found for column:', column.name);
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

  const handleAddQualityRule = (type: QualityRule['type']) => {
    const newRule: QualityRule = {
      type,
      enabled: true,
    };
    setQualityRules([...qualityRules, newRule]);
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

      await onSave(column.id, {
        default_value: defaultValue || undefined,
        description: description || undefined,
        constraints: Object.keys(updatedConstraints).length > 0 ? updatedConstraints : undefined,
        quality_rules: Object.keys(updatedConstraints).length > 0 ? updatedConstraints : undefined,
      });

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

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Column Details: ${column.name}`}
      size="md"
      initialPosition={{ x: 100, y: 100 }}
    >
      <div className="space-y-6">
        {/* Basic Properties */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Properties</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Column description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
              <input
                type="text"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="Default value..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Quality Rules */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Quality Rules</h3>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddQualityRule(e.target.value as QualityRule['type']);
                    e.target.value = '';
                  }
                }}
                className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Add Quality Rule...</option>
                <option value="string_constraints">String Constraints</option>
                <option value="numeric_constraints">Numeric Constraints</option>
                <option value="pattern">Pattern</option>
                <option value="format">Format</option>
                <option value="valid_values">Valid Values</option>
              </select>
            </div>
          </div>

          {qualityRules.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No quality rules defined</p>
          ) : (
            <div className="space-y-3">
              {qualityRules.map((rule, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) =>
                          handleUpdateQualityRule(index, { enabled: e.target.checked })
                        }
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {rule.type.replace('_', ' ')}
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
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Min Length</label>
                        <input
                          type="number"
                          value={rule.minLength || ''}
                          onChange={(e) =>
                            handleUpdateQualityRule(index, {
                              minLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            })
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="Min"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Max Length</label>
                        <input
                          type="number"
                          value={rule.maxLength || ''}
                          onChange={(e) =>
                            handleUpdateQualityRule(index, {
                              maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            })
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                  )}

                  {rule.type === 'numeric_constraints' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Minimum</label>
                        <input
                          type="number"
                          value={rule.minimum || ''}
                          onChange={(e) =>
                            handleUpdateQualityRule(index, {
                              minimum: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="Min"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Maximum</label>
                        <input
                          type="number"
                          value={rule.maximum || ''}
                          onChange={(e) =>
                            handleUpdateQualityRule(index, {
                              maximum: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                  )}

                  {rule.type === 'pattern' && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 mb-1">Regex Pattern</label>
                      <input
                        type="text"
                        value={rule.pattern || ''}
                        onChange={(e) =>
                          handleUpdateQualityRule(index, { pattern: e.target.value })
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="^[A-Z]+$"
                      />
                    </div>
                  )}

                  {rule.type === 'format' && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 mb-1">Format</label>
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
                        <option value="email">Email</option>
                        <option value="uuid">UUID</option>
                        <option value="url">URL</option>
                        <option value="date">Date</option>
                        <option value="datetime">DateTime</option>
                        <option value="phone">Phone</option>
                      </select>
                    </div>
                  )}

                  {rule.type === 'valid_values' && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 mb-1">
                        Valid Values (comma-separated)
                      </label>
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
                        placeholder="value1, value2, value3"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </DraggableModal>
  );
};
