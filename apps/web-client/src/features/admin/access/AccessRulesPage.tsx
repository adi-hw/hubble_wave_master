import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { accessApi, CollectionAccessRule, CreateRuleDto } from '../../../services/accessApi';
import { ConditionBuilder } from '../../../components/access/ConditionBuilder';

export const AccessRulesPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rules, setRules] = useState<CollectionAccessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<CreateRuleDto>>({
    principalType: 'role',
    canRead: true,
    condition: {},
    priority: 100
  });

  useEffect(() => {
    if (collectionId) {
      loadRules();
    }
  }, [collectionId]);

  const loadRules = async () => {
    if (!collectionId) return;
    try {
      setLoading(true);
      const data = await accessApi.getCollectionRules(collectionId);
      setRules(data);
    } catch (err) {
      console.error('Failed to load rules', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      try {
        await accessApi.deleteCollectionRule(ruleId);
        await loadRules();
      } catch (err) {
        console.error('Failed to delete rule', err);
      }
    }
  };

  const handleSave = async () => {
    if (!collectionId) return;
    try {
      await accessApi.createCollectionRule(collectionId, editingRule as CreateRuleDto);
      setShowEditor(false);
      setEditingRule({
        principalType: 'role',
        canRead: true,
        condition: {},
        priority: 100
      });
      await loadRules();
    } catch (err) {
      console.error('Failed to save rule', err);
    }
  };

  if (loading) return <div className="p-4" style={{ color: 'var(--text-secondary)' }}>Loading rules...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Access Rules</h1>
        <div className="space-x-2">
            <button
                onClick={() => navigate(`/studio/collections/${collectionId}`)}
                className="px-4 py-2 border rounded transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-secondary)'
                }}
            >
                Back to Collection
            </button>
            <button
                onClick={() => setShowEditor(true)}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-on-primary)'
                }}
            >
                Add Rule
            </button>
        </div>
      </div>

      {showEditor && (
        <div
          className="mb-6 p-4 border rounded"
          style={{
            backgroundColor: 'var(--bg-surface-secondary)',
            borderColor: 'var(--border-default)'
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>New Rule</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Principal Type</label>
              <select
                className="w-full border rounded p-2"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)'
                }}
                value={editingRule.principalType}
                onChange={e => setEditingRule({...editingRule, principalType: e.target.value as any})}
              >
                <option value="role">Role</option>
                <option value="user">User</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Principal ID (Role Name or User ID)</label>
              <input
                type="text"
                className="w-full border rounded p-2"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)'
                }}
                value={editingRule.principalId || ''}
                onChange={e => setEditingRule({...editingRule, principalId: e.target.value})}
                placeholder="e.g. admin, user, or UUID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Priority</label>
              <input
                type="number"
                className="w-full border rounded p-2"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)'
                }}
                value={editingRule.priority}
                onChange={e => setEditingRule({...editingRule, priority: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Permissions</label>
            <div className="flex space-x-4" style={{ color: 'var(--text-primary)' }}>
              <label className="flex items-center">
                <input
                    type="checkbox"
                    checked={editingRule.canRead}
                    onChange={e => setEditingRule({...editingRule, canRead: e.target.checked})}
                    className="mr-2"
                /> Read
              </label>
              <label className="flex items-center">
                <input
                    type="checkbox"
                    checked={editingRule.canCreate}
                    onChange={e => setEditingRule({...editingRule, canCreate: e.target.checked})}
                    className="mr-2"
                /> Create
              </label>
              <label className="flex items-center">
                <input
                    type="checkbox"
                    checked={editingRule.canUpdate}
                    onChange={e => setEditingRule({...editingRule, canUpdate: e.target.checked})}
                    className="mr-2"
                /> Update
              </label>
              <label className="flex items-center">
                <input
                    type="checkbox"
                    checked={editingRule.canDelete}
                    onChange={e => setEditingRule({...editingRule, canDelete: e.target.checked})}
                    className="mr-2"
                /> Delete
              </label>
            </div>
          </div>

          <div className="mb-4">
            <ConditionBuilder
                value={editingRule.condition}
                onChange={val => setEditingRule({...editingRule, condition: val})}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 border rounded transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-secondary)'
                }}
            >
                Cancel
            </button>
            <button
                onClick={handleSave}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: 'var(--bg-success)',
                  color: 'var(--text-on-primary)'
                }}
            >
                Save Rule
            </button>
          </div>
        </div>
      )}

      <div
        className="rounded shadow overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <table className="min-w-full">
          <thead
            className="border-b"
            style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              borderColor: 'var(--border-default)'
            }}
          >
            <tr>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Priority</th>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Principal</th>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Permissions</th>
              <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Conditions</th>
              <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <tr
                key={rule.id}
                className="border-b"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>{rule.priority}</td>
                <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>
                    <span
                      className="capitalize px-2 py-1 rounded text-xs mr-2"
                      style={{
                        backgroundColor: 'var(--bg-surface-secondary)',
                        color: 'var(--text-secondary)'
                      }}
                    >{rule.principalType}</span>
                    {rule.principalId || 'Everyone'}
                </td>
                <td className="py-3 px-4">
                  <div className="flex space-x-2 text-xs">
                    {rule.canRead && <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-success-subtle)', color: 'var(--text-success)' }}>Read</span>}
                    {rule.canCreate && <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-info-subtle)', color: 'var(--text-info)' }}>Create</span>}
                    {rule.canUpdate && <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-warning-subtle)', color: 'var(--text-warning)' }}>Update</span>}
                    {rule.canDelete && <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-danger-subtle)', color: 'var(--text-danger)' }}>Delete</span>}
                  </div>
                </td>
                <td className="py-3 px-4 text-xs font-mono truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>
                    {rule.condition ? JSON.stringify(rule.condition) : '-'}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--text-danger)' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
                <tr>
                    <td colSpan={5} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>No access rules defined. Collection allows default access (typically Deny All if no rules match).</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
