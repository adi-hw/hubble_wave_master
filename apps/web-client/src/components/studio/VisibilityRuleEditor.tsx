/**
 * VisibilityRuleEditor Component
 *
 * Editor for navigation item visibility rules.
 * Supports roles, permissions, feature flags, and DSL expressions.
 */

import React, { useState } from 'react';
import { X, Shield, Key, Flag, Code, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';

export interface VisibilityRules {
  rolesAny?: string[];
  rolesAll?: string[];
  permissionsAny?: string[];
  featureFlagsAny?: string[];
  expression?: string;
}

interface VisibilityRuleEditorProps {
  value: VisibilityRules;
  onChange: (value: VisibilityRules) => void;
  availableRoles?: string[];
  availablePermissions?: string[];
  availableFlags?: string[];
  disabled?: boolean;
}

interface TagInputProps {
  label: string;
  icon: React.ReactNode;
  description: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({
  label,
  icon,
  description,
  values,
  onChange,
  suggestions = [],
  placeholder,
  disabled,
}) => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = suggestions.filter(
    (s) => !values.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  const handleAdd = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const handleRemove = (value: string) => {
    onChange(values.filter((v) => v !== value));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      handleAdd(input);
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      handleRemove(values[values.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <span className="text-xs font-semibold uppercase text-slate-400">{label}</span>
        <span className="text-xs text-slate-500" title={description}>
          <HelpCircle className="h-3 w-3" />
        </span>
      </div>

      <div className="relative">
        <div
          className={`
            flex flex-wrap gap-1.5 p-2 rounded-lg border min-h-[40px]
            ${disabled ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300'}
            focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500
          `}
        >
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
            >
              {value}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(value)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {!disabled && (
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={values.length === 0 ? placeholder : ''}
              className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-slate-700"
            />
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredSuggestions.slice(0, 10).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleAdd(suggestion)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const VisibilityRuleEditor: React.FC<VisibilityRuleEditorProps> = ({
  value,
  onChange,
  availableRoles = [],
  availablePermissions = [],
  availableFlags = [],
  disabled = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(!!value.expression);

  const updateField = <K extends keyof VisibilityRules>(
    field: K,
    fieldValue: VisibilityRules[K]
  ) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const hasAnyRules =
    (value.rolesAny?.length ?? 0) > 0 ||
    (value.rolesAll?.length ?? 0) > 0 ||
    (value.permissionsAny?.length ?? 0) > 0 ||
    (value.featureFlagsAny?.length ?? 0) > 0 ||
    !!value.expression;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Visibility Rules</span>
        {hasAnyRules && (
          <span className="text-xs text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
            {[
              value.rolesAny?.length && `${value.rolesAny.length} roles (any)`,
              value.rolesAll?.length && `${value.rolesAll.length} roles (all)`,
              value.permissionsAny?.length && `${value.permissionsAny.length} permissions`,
              value.featureFlagsAny?.length && `${value.featureFlagsAny.length} flags`,
              value.expression && 'expression',
            ]
              .filter(Boolean)
              .join(', ')}
          </span>
        )}
      </div>

      {/* Roles Any */}
      <TagInput
        label="Roles (Any)"
        icon={<Shield className="h-4 w-4" />}
        description="User must have at least ONE of these roles"
        values={value.rolesAny ?? []}
        onChange={(v) => updateField('rolesAny', v.length > 0 ? v : undefined)}
        suggestions={availableRoles}
        placeholder="Add roles..."
        disabled={disabled}
      />

      {/* Roles All */}
      <TagInput
        label="Roles (All)"
        icon={<Shield className="h-4 w-4" />}
        description="User must have ALL of these roles"
        values={value.rolesAll ?? []}
        onChange={(v) => updateField('rolesAll', v.length > 0 ? v : undefined)}
        suggestions={availableRoles}
        placeholder="Add required roles..."
        disabled={disabled}
      />

      {/* Permissions */}
      <TagInput
        label="Permissions (Any)"
        icon={<Key className="h-4 w-4" />}
        description="User must have at least ONE of these permissions"
        values={value.permissionsAny ?? []}
        onChange={(v) => updateField('permissionsAny', v.length > 0 ? v : undefined)}
        suggestions={availablePermissions}
        placeholder="Add permissions..."
        disabled={disabled}
      />

      {/* Feature Flags */}
      <TagInput
        label="Feature Flags (Any)"
        icon={<Flag className="h-4 w-4" />}
        description="At least ONE of these feature flags must be enabled"
        values={value.featureFlagsAny ?? []}
        onChange={(v) => updateField('featureFlagsAny', v.length > 0 ? v : undefined)}
        suggestions={availableFlags}
        placeholder="Add feature flags..."
        disabled={disabled}
      />

      {/* Advanced Expression */}
      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
          disabled={disabled}
        >
          {showAdvanced ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Code className="h-4 w-4" />
          <span>Advanced Expression</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">
              DSL expression for complex visibility rules. Uses JavaScript-like syntax.
            </p>
            <textarea
              value={value.expression ?? ''}
              onChange={(e) => updateField('expression', e.target.value || undefined)}
              disabled={disabled}
              rows={3}
              placeholder="hasRole('admin') || (hasPermission('asset.view') && hasFeature('beta'))"
              className={`
                w-full px-3 py-2 rounded-lg border text-sm font-mono
                ${disabled
                  ? 'bg-slate-100 border-slate-200 text-slate-500'
                  : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
                }
              `}
            />
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong>Available functions:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li><code>hasRole('role_name')</code> - Check if user has role</li>
                <li><code>hasPermission('perm.name')</code> - Check if user has permission</li>
                <li><code>hasFeature('flag_name')</code> - Check if feature flag is enabled</li>
                <li><code>hasTag('tag')</code> - Check if context tag is active</li>
              </ul>
              <p><strong>Operators:</strong> <code>&&</code>, <code>||</code>, <code>!</code>, <code>()</code></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisibilityRuleEditor;
