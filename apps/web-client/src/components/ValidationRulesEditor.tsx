import React from 'react';

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customError?: string;
}

interface ValidationRulesEditorProps {
  fieldType: string;
  rules: ValidationRule;
  onChange: (rules: ValidationRule) => void;
}

const COMMON_PATTERNS = [
  { label: 'Email', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
  { label: 'Phone', pattern: '^[0-9+\\-\\(\\)\\s]+$' },
  { label: 'URL', pattern: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b' },
  { label: 'Alphanumeric', pattern: '^[a-zA-Z0-9]+$' },
  { label: 'Letters Only', pattern: '^[a-zA-Z\\s]+$' },
  { label: 'Numbers Only', pattern: '^[0-9]+$' },
];

export const ValidationRulesEditor: React.FC<ValidationRulesEditorProps> = ({
  fieldType,
  rules,
  onChange,
}) => {
  const updateRule = (key: keyof ValidationRule, value: any) => {
    onChange({ ...rules, [key]: value });
  };

  const applyPattern = (pattern: string) => {
    updateRule('pattern', pattern);
  };

  const isStringType = fieldType === 'string';
  const isNumberType = fieldType === 'integer';
  const isDateType = fieldType === 'date' || fieldType === 'datetime';

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h3 className="text-sm font-semibold">Validation Rules</h3>

      {/* Required Checkbox - All Types */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rules.required || false}
          onChange={(e) => updateRule('required', e.target.checked)}
          className="rounded"
        />
        <span className="text-sm font-medium">Required field</span>
      </label>

      {/* String Validations */}
      {isStringType && (
        <div className="space-y-3 p-3 bg-blue-50 rounded">
          <p className="text-xs font-medium text-blue-900">String Constraints</p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Min Length</label>
              <input
                type="number"
                value={rules.minLength || ''}
                onChange={(e) => updateRule('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="No minimum"
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Length</label>
              <input
                type="number"
                value={rules.maxLength || ''}
                onChange={(e) => updateRule('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="No maximum"
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Pattern (Regex)</label>
            <input
              type="text"
              value={rules.pattern || ''}
              onChange={(e) => updateRule('pattern', e.target.value)}
              placeholder="^[a-zA-Z]+$"
              className="w-full px-2 py-1 border rounded text-sm font-mono"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {COMMON_PATTERNS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPattern(p.pattern)}
                  className="px-2 py-1 text-xs bg-white border rounded hover:bg-blue-100"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Number Validations */}
      {isNumberType && (
        <div className="space-y-3 p-3 bg-green-50 rounded">
          <p className="text-xs font-medium text-green-900">Number Constraints</p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Min Value</label>
              <input
                type="number"
                value={rules.min !== undefined ? rules.min : ''}
                onChange={(e) => updateRule('min', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="No minimum"
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Value</label>
              <input
                type="number"
                value={rules.max !== undefined ? rules.max : ''}
                onChange={(e) => updateRule('max', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="No maximum"
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Date Validations */}
      {isDateType && (
        <div className="space-y-3 p-3 bg-purple-50 rounded">
          <p className="text-xs font-medium text-purple-900">Date Constraints</p>
          <p className="text-xs text-gray-600">
            Date validation support coming soon. Use custom validators in config for now.
          </p>
        </div>
      )}

      {/* Custom Error Message - All Types */}
      <div>
        <label className="block text-xs font-medium mb-1">Custom Error Message</label>
        <input
          type="text"
          value={rules.customError || ''}
          onChange={(e) => updateRule('customError', e.target.value)}
          placeholder="Enter a user-friendly error message"
          className="w-full px-2 py-1 border rounded text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          This message will be shown when validation fails
        </p>
      </div>
    </div>
  );
};
