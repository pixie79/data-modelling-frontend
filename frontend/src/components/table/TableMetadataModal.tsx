/**
 * Table Metadata Modal Component
 * Editable form for table metadata (Owner, SLA, Tags, Metadata, Quality Rules)
 * Does NOT show schema/columns
 */

import React, { useState, useEffect } from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { useModelStore } from '@/stores/modelStore';
import { useUIStore } from '@/stores/uiStore';
import { useSDKModeStore } from '@/services/sdk/sdkMode';
import type { Table, Owner, SLA, Role, SupportChannel, Pricing, TeamMember } from '@/types/table';

export interface TableMetadataModalProps {
  table: Table | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TableMetadataModal: React.FC<TableMetadataModalProps> = ({
  table,
  isOpen,
  onClose,
}) => {
  const { updateTable, updateTableRemote, selectedDomainId } = useModelStore();
  const { addToast } = useUIStore();
  const { mode } = useSDKModeStore();

  const [owner, setOwner] = useState<Owner | undefined>(undefined);
  const [roles, setRoles] = useState<Role[]>([]);
  const [support, setSupport] = useState<SupportChannel[]>([]);
  const [pricing, setPricing] = useState<Pricing | undefined>(undefined);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [sla, setSLA] = useState<SLA | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [qualityRules, setQualityRules] = useState<Record<string, unknown>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when table changes
  useEffect(() => {
    if (table) {
      setOwner(table.owner || {});
      setRoles(table.roles || []);
      setSupport(table.support || []);
      setPricing(table.pricing || {});
      setTeam(table.team || []);
      setSLA(table.sla || {});
      // Filter out dm_level tags - these are managed by the Data Level dropdown, not the tags input
      const editableTags = (table.tags || []).filter(
        (tag) => !tag.toLowerCase().startsWith('dm_level:')
      );
      setTags(editableTags);
      setTagsInput(editableTags.join(', '));
      setMetadata(table.metadata || {});
      setQualityRules(table.quality_rules || {});
      setHasUnsavedChanges(false);
    }
  }, [table]);

  const handleSave = async () => {
    if (!table) return;

    setIsSaving(true);
    try {
      // Filter out roles without a role name (required field)
      const validRoles = roles.filter((r) => r.role && r.role.trim().length > 0);

      // Filter out support channels without required fields
      const validSupport = support.filter(
        (s) => s.channel && s.channel.trim().length > 0 && s.url && s.url.trim().length > 0
      );

      // Filter out team members without at least username or name
      const validTeam = team.filter(
        (t) => (t.username && t.username.trim().length > 0) || (t.name && t.name.trim().length > 0)
      );

      const updates: Partial<Table> = {
        owner: owner && (owner.name || owner.email) ? owner : undefined,
        roles: validRoles.length > 0 ? validRoles : undefined,
        support: validSupport.length > 0 ? validSupport : undefined,
        pricing:
          pricing &&
          (pricing.priceAmount !== undefined || pricing.priceCurrency || pricing.priceUnit)
            ? pricing
            : undefined,
        team: validTeam.length > 0 ? validTeam : undefined,
        sla:
          sla &&
          (sla.latency !== undefined ||
            sla.uptime !== undefined ||
            sla.response_time !== undefined ||
            sla.error_rate !== undefined ||
            sla.update_frequency)
            ? sla
            : undefined,
        // Preserve dm_level tag from original table (managed by Data Level dropdown)
        tags: (() => {
          const dmLevelTag = (table.tags || []).find((t) =>
            t.toLowerCase().startsWith('dm_level:')
          );
          const allTags = dmLevelTag ? [...tags, dmLevelTag] : tags;
          return allTags.length > 0 ? allTags : undefined;
        })(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        quality_rules: Object.keys(qualityRules).length > 0 ? qualityRules : undefined,
        last_modified_at: new Date().toISOString(),
      };

      // Update local state
      updateTable(table.id, updates);

      // Update remote if online
      if (mode === 'online' && selectedDomainId) {
        try {
          await updateTableRemote(selectedDomainId, table.id, updates);
        } catch (error) {
          console.warn('Remote update failed, changes saved locally', error);
        }
      }

      addToast({
        type: 'success',
        message: 'Table metadata saved successfully',
      });

      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save metadata',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagsInputChange = (value: string) => {
    setTagsInput(value);
    // Parse tags from input
    // Split on ", " (comma + space) to separate different tags
    // This allows "env:prod,staging" to be one tag, but "env:prod, product:food" to be two tags
    const newTags = value
      .split(/, /)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    setTags(newTags);
    setHasUnsavedChanges(true);
  };

  if (!table) return null;

  const isEditable = table.primary_domain_id === selectedDomainId;

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Table Metadata: ${table.name}`}
      size="lg"
      initialPosition={{
        x: Math.max(50, window.innerWidth / 2 - 400),
        y: Math.max(50, window.innerHeight / 2 - 300),
      }}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        {!isEditable && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              This table belongs to another domain and cannot be edited here.
            </p>
          </div>
        )}

        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Basic Information</h3>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium text-gray-600">Name:</span>{' '}
              <span className="text-gray-900">{table.name}</span>
            </div>
            {table.alias && (
              <div>
                <span className="font-medium text-gray-600">Alias:</span>{' '}
                <span className="text-gray-900">{table.alias}</span>
              </div>
            )}
            {table.description && (
              <div>
                <span className="font-medium text-gray-600">Description:</span>{' '}
                <span className="text-gray-900">{table.description}</span>
              </div>
            )}
            {table.data_level && (
              <div>
                <span className="font-medium text-gray-600">Data Level:</span>{' '}
                <span className="text-gray-900 capitalize">{table.data_level}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Tags</h3>
            <div className="relative group">
              <button
                type="button"
                className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 text-xs font-semibold"
                title="Tag format help"
              >
                ?
              </button>
              <div className="invisible group-hover:visible absolute left-0 top-6 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-xs">
                <h4 className="font-semibold text-gray-900 mb-2">Tag Formats</h4>
                <div className="space-y-2 text-gray-700">
                  <div>
                    <span className="font-medium">Simple:</span>
                    <code className="ml-2 px-1 bg-gray-100 rounded">production</code>
                    <p className="text-xs text-gray-600 mt-1">Single word tag</p>
                  </div>
                  <div>
                    <span className="font-medium">Keyword:</span>
                    <code className="ml-2 px-1 bg-gray-100 rounded">env:production</code>
                    <p className="text-xs text-gray-600 mt-1">Key-value pair</p>
                  </div>
                  <div>
                    <span className="font-medium">Keyword with list:</span>
                    <code className="ml-2 px-1 bg-gray-100 rounded">env:production,staging</code>
                    <p className="text-xs text-gray-600 mt-1">
                      Key with multiple values (no spaces)
                    </p>
                  </div>
                  <div className="pt-2 border-t border-gray-200 mt-2">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Multiple tags:</span> Separate with comma +
                      space
                    </p>
                    <code className="block mt-1 px-1 bg-gray-100 rounded">
                      env:production, product:food
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isEditable ? (
            <div>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => handleTagsInputChange(e.target.value)}
                placeholder="e.g., env:production, product:food or pii, sensitive"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500">No tags</span>
              )}
            </div>
          )}
        </div>

        {/* Owner Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Owner</h3>
          {isEditable ? (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={owner?.name || ''}
                  onChange={(e) => {
                    setOwner({ ...owner, name: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Owner name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={owner?.email || ''}
                  onChange={(e) => {
                    setOwner({ ...owner, email: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="owner@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Team</label>
                <input
                  type="text"
                  value={owner?.team || ''}
                  onChange={(e) => {
                    setOwner({ ...owner, team: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Team name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <input
                  type="text"
                  value={owner?.role || ''}
                  onChange={(e) => {
                    setOwner({ ...owner, role: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Data Owner, Data Steward"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {owner && (owner.name || owner.email || owner.team || owner.role) ? (
                <>
                  {owner.name && (
                    <div>
                      <span className="font-medium text-gray-600">Name:</span>{' '}
                      <span className="text-gray-900">{owner.name}</span>
                    </div>
                  )}
                  {owner.email && (
                    <div>
                      <span className="font-medium text-gray-600">Email:</span>{' '}
                      <span className="text-gray-900">{owner.email}</span>
                    </div>
                  )}
                  {owner.team && (
                    <div>
                      <span className="font-medium text-gray-600">Team:</span>{' '}
                      <span className="text-gray-900">{owner.team}</span>
                    </div>
                  )}
                  {owner.role && (
                    <div>
                      <span className="font-medium text-gray-600">Role:</span>{' '}
                      <span className="text-gray-900">{owner.role}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-500">No owner information</span>
              )}
            </div>
          )}
        </div>

        {/* Roles Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Roles</h3>
          {isEditable ? (
            <div className="space-y-3">
              {roles.map((role, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xs font-semibold text-gray-700">Role {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newRoles = roles.filter((_, i) => i !== index);
                        setRoles(newRoles);
                        setHasUnsavedChanges(true);
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Role Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={role.role || ''}
                        onChange={(e) => {
                          const newRoles = [...roles];
                          newRoles[index] = { ...role, role: e.target.value };
                          setRoles(newRoles);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="IAM role name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Description
                      </label>
                      <textarea
                        value={role.description || ''}
                        onChange={(e) => {
                          const newRoles = [...roles];
                          newRoles[index] = { ...role, description: e.target.value || undefined };
                          setRoles(newRoles);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Description of the IAM role and its permissions"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Access Type
                      </label>
                      <input
                        type="text"
                        value={role.access || ''}
                        onChange={(e) => {
                          const newRoles = [...roles];
                          newRoles[index] = { ...role, access: e.target.value || undefined };
                          setRoles(newRoles);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="e.g., read-only, read-write, admin"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        1st Level Approvers
                      </label>
                      <input
                        type="text"
                        value={
                          Array.isArray(role.firstLevelApprovers)
                            ? role.firstLevelApprovers.join(', ')
                            : role.firstLevelApprovers || ''
                        }
                        onChange={(e) => {
                          const newRoles = [...roles];
                          const value = e.target.value.trim();
                          newRoles[index] = {
                            ...role,
                            firstLevelApprovers: value
                              ? value.includes(',')
                                ? value.split(',').map((s) => s.trim())
                                : value
                              : undefined,
                          };
                          setRoles(newRoles);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Comma-separated names"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        2nd Level Approvers
                      </label>
                      <input
                        type="text"
                        value={
                          Array.isArray(role.secondLevelApprovers)
                            ? role.secondLevelApprovers.join(', ')
                            : role.secondLevelApprovers || ''
                        }
                        onChange={(e) => {
                          const newRoles = [...roles];
                          const value = e.target.value.trim();
                          newRoles[index] = {
                            ...role,
                            secondLevelApprovers: value
                              ? value.includes(',')
                                ? value.split(',').map((s) => s.trim())
                                : value
                              : undefined,
                          };
                          setRoles(newRoles);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Comma-separated names"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Custom Properties (JSON)
                      </label>
                      <textarea
                        value={
                          role.customProperties
                            ? JSON.stringify(role.customProperties, null, 2)
                            : ''
                        }
                        onChange={(e) => {
                          const newRoles = [...roles];
                          try {
                            const parsed = e.target.value.trim()
                              ? JSON.parse(e.target.value)
                              : undefined;
                            newRoles[index] = { ...role, customProperties: parsed };
                            setRoles(newRoles);
                            setHasUnsavedChanges(true);
                          } catch {
                            // Invalid JSON, don't update
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                        placeholder='{"key": "value"}'
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setRoles([...roles, { role: '' }]);
                  setHasUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                + Add Role
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {roles.length > 0 ? (
                roles.map((role, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-md">
                    <div className="font-medium text-gray-900 mb-1">{role.role}</div>
                    {role.description && (
                      <div className="text-gray-600 mb-1">{role.description}</div>
                    )}
                    {role.access && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Access:</span> {role.access}
                      </div>
                    )}
                    {role.firstLevelApprovers && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">1st Level Approvers:</span>{' '}
                        {Array.isArray(role.firstLevelApprovers)
                          ? role.firstLevelApprovers.join(', ')
                          : role.firstLevelApprovers}
                      </div>
                    )}
                    {role.secondLevelApprovers && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">2nd Level Approvers:</span>{' '}
                        {Array.isArray(role.secondLevelApprovers)
                          ? role.secondLevelApprovers.join(', ')
                          : role.secondLevelApprovers}
                      </div>
                    )}
                    {role.customProperties && Object.keys(role.customProperties).length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Custom Properties:</span>{' '}
                        <pre className="inline-block">
                          {JSON.stringify(role.customProperties, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-gray-500">No roles defined</span>
              )}
            </div>
          )}
        </div>

        {/* Support and Communication Channels */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Support and Communication Channels
          </h3>
          {isEditable ? (
            <div className="space-y-3">
              {support.map((channel, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xs font-semibold text-gray-700">Channel {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newSupport = support.filter((_, i) => i !== index);
                        setSupport(newSupport);
                        setHasUnsavedChanges(true);
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Channel Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={channel.channel || ''}
                        onChange={(e) => {
                          const newSupport = [...support];
                          newSupport[index] = { ...channel, channel: e.target.value };
                          setSupport(newSupport);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Channel name or identifier"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={channel.url || ''}
                        onChange={(e) => {
                          const newSupport = [...support];
                          newSupport[index] = { ...channel, url: e.target.value };
                          setSupport(newSupport);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="https://example.com or mailto:email@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={channel.description || ''}
                        onChange={(e) => {
                          const newSupport = [...support];
                          newSupport[index] = {
                            ...channel,
                            description: e.target.value || undefined,
                          };
                          setSupport(newSupport);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Description of the channel"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tool</label>
                        <select
                          value={channel.tool || ''}
                          onChange={(e) => {
                            const newSupport = [...support];
                            newSupport[index] = { ...channel, tool: e.target.value || undefined };
                            setSupport(newSupport);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Select tool...</option>
                          <option value="email">Email</option>
                          <option value="slack">Slack</option>
                          <option value="teams">Teams</option>
                          <option value="discord">Discord</option>
                          <option value="ticket">Ticket</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Scope
                        </label>
                        <select
                          value={channel.scope || ''}
                          onChange={(e) => {
                            const newSupport = [...support];
                            newSupport[index] = {
                              ...channel,
                              scope: e.target.value as
                                | 'interactive'
                                | 'announcements'
                                | 'issues'
                                | undefined,
                            };
                            setSupport(newSupport);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Select scope...</option>
                          <option value="interactive">Interactive</option>
                          <option value="announcements">Announcements</option>
                          <option value="issues">Issues</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Invitation URL
                      </label>
                      <input
                        type="url"
                        value={channel.invitationUrl || ''}
                        onChange={(e) => {
                          const newSupport = [...support];
                          newSupport[index] = {
                            ...channel,
                            invitationUrl: e.target.value || undefined,
                          };
                          setSupport(newSupport);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Invitation URL for requesting or subscribing"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSupport([...support, { channel: '', url: '' }]);
                  setHasUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                + Add Support Channel
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {support.length > 0 ? (
                support.map((channel, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-md">
                    <div className="font-medium text-gray-900 mb-1">{channel.channel}</div>
                    <div className="text-blue-600 hover:underline mb-1">
                      <a href={channel.url} target="_blank" rel="noopener noreferrer">
                        {channel.url}
                      </a>
                    </div>
                    {channel.description && (
                      <div className="text-gray-600 mb-1">{channel.description}</div>
                    )}
                    <div className="flex gap-2 text-xs text-gray-500">
                      {channel.tool && (
                        <span>
                          <span className="font-medium">Tool:</span> {channel.tool}
                        </span>
                      )}
                      {channel.scope && (
                        <span>
                          <span className="font-medium">Scope:</span> {channel.scope}
                        </span>
                      )}
                    </div>
                    {channel.invitationUrl && (
                      <div className="text-xs text-blue-600 hover:underline mt-1">
                        <a href={channel.invitationUrl} target="_blank" rel="noopener noreferrer">
                          Invitation URL
                        </a>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-gray-500">No support channels defined</span>
              )}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Pricing</h3>
          {isEditable ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Price Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricing?.priceAmount || ''}
                    onChange={(e) => {
                      setPricing({
                        ...pricing,
                        priceAmount: e.target.value ? Number(e.target.value) : undefined,
                      });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="9.95"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                  <input
                    type="text"
                    value={pricing?.priceCurrency || ''}
                    onChange={(e) => {
                      setPricing({ ...pricing, priceCurrency: e.target.value || undefined });
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="USD"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price Unit</label>
                <input
                  type="text"
                  value={pricing?.priceUnit || ''}
                  onChange={(e) => {
                    setPricing({ ...pricing, priceUnit: e.target.value || undefined });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., megabyte, gigabyte"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {pricing &&
              (pricing.priceAmount !== undefined || pricing.priceCurrency || pricing.priceUnit) ? (
                <>
                  {pricing.priceAmount !== undefined && (
                    <div>
                      <span className="font-medium text-gray-600">Price:</span>{' '}
                      <span className="text-gray-900">
                        {pricing.priceCurrency || 'USD'} {pricing.priceAmount}
                        {pricing.priceUnit && ` per ${pricing.priceUnit}`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-500">No pricing information</span>
              )}
            </div>
          )}
        </div>

        {/* Team */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Team</h3>
          {isEditable ? (
            <div className="space-y-3">
              {team.map((member, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xs font-semibold text-gray-700">Member {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newTeam = team.filter((_, i) => i !== index);
                        setTeam(newTeam);
                        setHasUnsavedChanges(true);
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Username/Email
                        </label>
                        <input
                          type="text"
                          value={member.username || ''}
                          onChange={(e) => {
                            const newTeam = [...team];
                            newTeam[index] = { ...member, username: e.target.value || undefined };
                            setTeam(newTeam);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="username or email"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={member.name || ''}
                          onChange={(e) => {
                            const newTeam = [...team];
                            newTeam[index] = { ...member, name: e.target.value || undefined };
                            setTeam(newTeam);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Full name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                      <input
                        type="text"
                        value={member.role || ''}
                        onChange={(e) => {
                          const newTeam = [...team];
                          newTeam[index] = { ...member, role: e.target.value || undefined };
                          setTeam(newTeam);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="e.g., Owner, Data Steward, Data Scientist"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Date In
                        </label>
                        <input
                          type="date"
                          value={member.dateIn || ''}
                          onChange={(e) => {
                            const newTeam = [...team];
                            newTeam[index] = { ...member, dateIn: e.target.value || undefined };
                            setTeam(newTeam);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Date Out
                        </label>
                        <input
                          type="date"
                          value={member.dateOut || ''}
                          onChange={(e) => {
                            const newTeam = [...team];
                            newTeam[index] = { ...member, dateOut: e.target.value || undefined };
                            setTeam(newTeam);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Replaced By Username
                      </label>
                      <input
                        type="text"
                        value={member.replacedByUsername || ''}
                        onChange={(e) => {
                          const newTeam = [...team];
                          newTeam[index] = {
                            ...member,
                            replacedByUsername: e.target.value || undefined,
                          };
                          setTeam(newTeam);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Username of replacement"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Comment
                      </label>
                      <textarea
                        value={member.comment || ''}
                        onChange={(e) => {
                          const newTeam = [...team];
                          newTeam[index] = { ...member, comment: e.target.value || undefined };
                          setTeam(newTeam);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Free text comment"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setTeam([...team, {}]);
                  setHasUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                + Add Team Member
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {team.length > 0 ? (
                team.map((member, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-md">
                    <div className="font-medium text-gray-900 mb-1">
                      {member.name || member.username || `Member ${index + 1}`}
                    </div>
                    {member.role && (
                      <div className="text-gray-600 mb-1">
                        <span className="font-medium">Role:</span> {member.role}
                      </div>
                    )}
                    {member.username && member.username !== member.name && (
                      <div className="text-xs text-gray-500 mb-1">
                        <span className="font-medium">Username:</span> {member.username}
                      </div>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500">
                      {member.dateIn && (
                        <span>
                          <span className="font-medium">Date In:</span> {member.dateIn}
                        </span>
                      )}
                      {member.dateOut && (
                        <span>
                          <span className="font-medium">Date Out:</span> {member.dateOut}
                        </span>
                      )}
                    </div>
                    {member.replacedByUsername && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Replaced By:</span>{' '}
                        {member.replacedByUsername}
                      </div>
                    )}
                    {member.comment && <div className="text-gray-600 mt-1">{member.comment}</div>}
                  </div>
                ))
              ) : (
                <span className="text-gray-500">No team members defined</span>
              )}
            </div>
          )}
        </div>

        {/* SLA Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Service Level Agreement (SLA)
          </h3>
          {isEditable ? (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latency (ms)</label>
                <input
                  type="number"
                  value={sla?.latency || ''}
                  onChange={(e) => {
                    setSLA({
                      ...sla,
                      latency: e.target.value ? Number(e.target.value) : undefined,
                    });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Latency in milliseconds"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Uptime (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sla?.uptime || ''}
                  onChange={(e) => {
                    setSLA({ ...sla, uptime: e.target.value ? Number(e.target.value) : undefined });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Uptime percentage (0-100)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Response Time (ms)
                </label>
                <input
                  type="number"
                  value={sla?.response_time || ''}
                  onChange={(e) => {
                    setSLA({
                      ...sla,
                      response_time: e.target.value ? Number(e.target.value) : undefined,
                    });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Response time in milliseconds"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Error Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={sla?.error_rate || ''}
                  onChange={(e) => {
                    setSLA({
                      ...sla,
                      error_rate: e.target.value ? Number(e.target.value) : undefined,
                    });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Error rate percentage (0-100)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Update Frequency
                </label>
                <input
                  type="text"
                  value={sla?.update_frequency || ''}
                  onChange={(e) => {
                    setSLA({ ...sla, update_frequency: e.target.value || undefined });
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., daily, hourly, real-time"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {sla &&
              (sla.latency !== undefined ||
                sla.uptime !== undefined ||
                sla.response_time !== undefined ||
                sla.error_rate !== undefined ||
                sla.update_frequency) ? (
                <>
                  {sla.latency !== undefined && (
                    <div>
                      <span className="font-medium text-gray-600">Latency:</span>{' '}
                      <span className="text-gray-900">{sla.latency} ms</span>
                    </div>
                  )}
                  {sla.uptime !== undefined && (
                    <div>
                      <span className="font-medium text-gray-600">Uptime:</span>{' '}
                      <span className="text-gray-900">{sla.uptime}%</span>
                    </div>
                  )}
                  {sla.response_time !== undefined && (
                    <div>
                      <span className="font-medium text-gray-600">Response Time:</span>{' '}
                      <span className="text-gray-900">{sla.response_time} ms</span>
                    </div>
                  )}
                  {sla.error_rate !== undefined && (
                    <div>
                      <span className="font-medium text-gray-600">Error Rate:</span>{' '}
                      <span className="text-gray-900">{sla.error_rate}%</span>
                    </div>
                  )}
                  {sla.update_frequency && (
                    <div>
                      <span className="font-medium text-gray-600">Update Frequency:</span>{' '}
                      <span className="text-gray-900">{sla.update_frequency}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-500">No SLA information</span>
              )}
            </div>
          )}
        </div>

        {/* Metadata (JSON) */}
        {isEditable && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Custom Metadata (JSON)</h3>
            <textarea
              value={JSON.stringify(metadata, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setMetadata(parsed);
                  setHasUnsavedChanges(true);
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              rows={6}
              placeholder='{"quality_tier": "gold", "data_modeling_method": "dimensional"}'
            />
            <p className="mt-1 text-xs text-gray-500">Enter valid JSON for custom metadata</p>
          </div>
        )}

        {/* Quality Rules (JSON) */}
        {isEditable && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Quality Rules (JSON)</h3>
            <textarea
              value={JSON.stringify(qualityRules, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setQualityRules(parsed);
                  setHasUnsavedChanges(true);
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              rows={6}
              placeholder='{"min_rows": 1000, "max_null_percentage": 5}'
            />
            <p className="mt-1 text-xs text-gray-500">Enter valid JSON for quality rules</p>
          </div>
        )}

        {/* Timestamps */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Timestamps</h3>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium text-gray-600">Created:</span>{' '}
              <span className="text-gray-900">{new Date(table.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Last Modified:</span>{' '}
              <span className="text-gray-900">
                {new Date(table.last_modified_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {isEditable && (
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
              disabled={isSaving || !hasUnsavedChanges}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Metadata'}
            </button>
          </div>
        )}
      </div>
    </DraggableModal>
  );
};
