import React, { useState } from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface KeyValuePair {
  key: string;
  value: string;
}

export const KeyValueField: React.FC<FieldComponentProps<Record<string, string> | KeyValuePair[]>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to array of pairs
  const getPairs = (): KeyValuePair[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return Object.entries(value).map(([key, val]) => ({ key, value: val }));
  };

  const [pairs, setPairs] = useState<KeyValuePair[]>(getPairs());
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const updateValue = (newPairs: KeyValuePair[]) => {
    setPairs(newPairs);
    // Convert to object for storage
    const obj: Record<string, string> = {};
    newPairs.forEach((p) => {
      if (p.key) obj[p.key] = p.value;
    });
    onChange(obj);
  };

  const addPair = () => {
    if (!newKey.trim()) return;
    updateValue([...pairs, { key: newKey.trim(), value: newValue }]);
    setNewKey('');
    setNewValue('');
  };

  const removePair = (index: number) => {
    updateValue(pairs.filter((_, i) => i !== index));
  };

  const updatePair = (index: number, field: 'key' | 'value', val: string) => {
    const newPairs = [...pairs];
    newPairs[index] = { ...newPairs[index], [field]: val };
    updateValue(newPairs);
  };

  if (readOnly) {
    return (
      <FieldWrapper label={field.label} required={false}>
        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
          {pairs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No values</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {pairs.map((pair, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-700 bg-slate-100/50 w-1/3">{pair.key}</td>
                    <td className="px-4 py-2 text-slate-600">{pair.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText || 'Add key-value pairs'}
    >
      <div className="space-y-2">
        {/* Existing pairs */}
        {pairs.map((pair, index) => (
          <div key={index} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />
            <input
              type="text"
              value={pair.key}
              onChange={(e) => updatePair(index, 'key', e.target.value)}
              disabled={disabled}
              placeholder="Key"
              className={`${getInputClasses({ disabled })} flex-1`}
            />
            <span className="text-slate-400">=</span>
            <input
              type="text"
              value={pair.value}
              onChange={(e) => updatePair(index, 'value', e.target.value)}
              disabled={disabled}
              placeholder="Value"
              className={`${getInputClasses({ disabled })} flex-1`}
            />
            <button
              type="button"
              onClick={() => removePair(index)}
              disabled={disabled}
              className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Add new pair */}
        {!disabled && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="New key"
              className={`${getInputClasses({})} flex-1`}
              onKeyDown={(e) => e.key === 'Enter' && addPair()}
            />
            <span className="text-slate-400">=</span>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              className={`${getInputClasses({})} flex-1`}
              onKeyDown={(e) => e.key === 'Enter' && addPair()}
            />
            <button
              type="button"
              onClick={addPair}
              disabled={!newKey.trim()}
              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};
