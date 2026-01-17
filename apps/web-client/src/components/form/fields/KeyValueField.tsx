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
        <div className="rounded-lg overflow-hidden bg-muted border border-border">
          {pairs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No values</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {pairs.map((pair, i) => (
                  <tr
                    key={i}
                    className={i < pairs.length - 1 ? 'border-b border-border/50' : ''}
                  >
                    <td className="px-4 py-2 font-medium w-1/3 text-foreground bg-muted/80">
                      {pair.key}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{pair.value}</td>
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
        {pairs.map((pair, index) => (
          <div key={index} className="flex items-center gap-2" role="listitem">
            <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              value={pair.key}
              onChange={(e) => updatePair(index, 'key', e.target.value)}
              disabled={disabled}
              placeholder="Key"
              className={`${getInputClasses({ disabled })} flex-1`}
              aria-label={`Key for pair ${index + 1}`}
            />
            <span className="text-muted-foreground" aria-hidden="true">=</span>
            <input
              type="text"
              value={pair.value}
              onChange={(e) => updatePair(index, 'value', e.target.value)}
              disabled={disabled}
              placeholder="Value"
              className={`${getInputClasses({ disabled })} flex-1`}
              aria-label={`Value for pair ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removePair(index)}
              disabled={disabled}
              className="p-2 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label={`Remove pair ${pair.key}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {!disabled && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="New key"
              className={`${getInputClasses({})} flex-1`}
              onKeyDown={(e) => e.key === 'Enter' && addPair()}
              aria-label="New key"
            />
            <span className="text-muted-foreground" aria-hidden="true">=</span>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              className={`${getInputClasses({})} flex-1`}
              onKeyDown={(e) => e.key === 'Enter' && addPair()}
              aria-label="New value"
            />
            <button
              type="button"
              onClick={addPair}
              disabled={!newKey.trim()}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors text-primary hover:bg-primary/10"
              aria-label="Add key-value pair"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};
