import React, { useState } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';

export interface Choice {
  value: string;
  label: string;
}

interface ChoiceEditorProps {
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}

export const ChoiceEditor: React.FC<ChoiceEditorProps> = ({ choices, onChange }) => {
  const [newChoice, setNewChoice] = useState<Choice>({ value: '', label: '' });

  const addChoice = () => {
    if (!newChoice.value || !newChoice.label) return;
    
    // Check for duplicate value
    if (choices.some(c => c.value === newChoice.value)) {
      alert('Value must be unique');
      return;
    }

    onChange([...choices, newChoice]);
    setNewChoice({ value: '', label: '' });
  };

  const updateChoice = (index: number, field: 'value' | 'label', value: string) => {
    const updated = [...choices];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const deleteChoice = (index: number) => {
    onChange(choices.filter((_, i) => i !== index));
  };

  const moveChoice = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= choices.length) return;

    const updated = [...choices];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Dropdown Options</label>
        
        <div className="space-y-2">
          {choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-white border rounded">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={choice.value}
                  onChange={(e) => updateChoice(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="px-2 py-1 border rounded text-sm"
                />
                <input
                  type="text"
                  value={choice.label}
                  onChange={(e) => updateChoice(index, 'label', e.target.value)}
                  placeholder="Label"
                  className="px-2 py-1 border rounded text-sm"
                />
              </div>
              
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveChoice(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveChoice(index, 'down')}
                  disabled={index === choices.length - 1}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteChoice(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new choice */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newChoice.value}
            onChange={(e) => setNewChoice({ ...newChoice, value: e.target.value })}
            placeholder="Value"
            className="flex-1 px-3 py-2 border rounded"
          />
          <input
            type="text"
            value={newChoice.label}
            onChange={(e) => setNewChoice({ ...newChoice, label: e.target.value })}
            placeholder="Label"
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            type="button"
            onClick={addChoice}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Preview */}
      {choices.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">Preview</label>
          <select className="w-full px-3 py-2 border rounded bg-white">
            <option value="">Select...</option>
            {choices.map((choice, index) => (
              <option key={index} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            This is how the dropdown will appear in forms
          </p>
        </div>
      )}
    </div>
  );
};
