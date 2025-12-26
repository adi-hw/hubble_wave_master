import React, { useState } from 'react';
import { AccessCondition, AccessConditionGroup } from '../../services/accessApi';

interface ConditionBuilderProps {
  value?: AccessCondition | AccessConditionGroup;
  onChange: (value: AccessCondition | AccessConditionGroup) => void;
  propertyTypes?: Record<string, string>; // Map of property code to data type
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ value, onChange }) => {
  // Simple JSON text mode for fallback/initial implementation
  const [jsonMode, setJsonMode] = useState<boolean>(true);
  const [jsonText, setJsonText] = useState<string>('{}');

  React.useEffect(() => {
    setJsonText(JSON.stringify(value || {}, null, 2));
  }, [value]);
  const [error, setError] = useState<string | null>(null);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setJsonText(newText);
    try {
      const parsed = JSON.parse(newText);
      onChange(parsed);
      setError(null);
    } catch (err) {
      setError('Invalid JSON');
    }
  };

  const handleModeToggle = () => {
    // If switching to visual, ensure JSON is valid. If switching to JSON, update text.
    if (!jsonMode) {
        setJsonText(JSON.stringify(value || {}, null, 2));
    }
    setJsonMode(!jsonMode);
  };

  if (jsonMode) {
    return (
      <div className="condition-builder-json">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">Condition Logic (JSON)</label>
          <button 
            type="button"
            onClick={handleModeToggle}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Switch to Visual Builder (Beta)
          </button>
        </div>
        <textarea
          className={`w-full h-40 font-mono text-xs p-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded`}
          value={jsonText}
          onChange={handleJsonChange}
          placeholder='e.g. { "property": "status", "operator": "equals", "value": "active" }'
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
        <p className="text-xs text-gray-500 mt-1">
          Supports simple conditions or groups with "and"/"or" arrays.
          Special values: "@currentUser.id", "@currentUser.email"
        </p>
      </div>
    );
  }

  // Visual Builder Placeholder
  return (
    <div className="condition-builder-visual border border-gray-200 rounded p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <span className="font-medium">Visual Builder</span>
          <button 
            type="button"
            onClick={handleModeToggle}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Switch to JSON
          </button>
        </div>
        <div className="text-center text-gray-500 italic py-8">
            Visual builder is coming soon. Please use JSON mode for complex rules.
        </div>
    </div>
  );
};
