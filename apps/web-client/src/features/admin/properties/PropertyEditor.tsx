/**
 * PropertyEditor
 * HubbleWave Platform - Phase 3
 *
 * Dialog for creating and editing property definitions.
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, X, AlertCircle } from 'lucide-react';
import { TypeSelector } from './TypeSelector';
import { PropertyDefinition, propertyApi, CreatePropertyDto } from '../../../services/propertyApi';

interface PropertyEditorProps {
  open: boolean;
  collectionId: string;
  property?: PropertyDefinition;
  onClose: () => void;
  onSave: () => void;
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between py-2 cursor-pointer">
    <span className="text-sm text-foreground">
      {label}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`toggle-track h-5 w-9 ${checked ? 'toggle-track-on' : ''}`}
    >
      <span
        className={`toggle-thumb inline-block h-4 w-4 transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  </label>
);

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  open,
  collectionId,
  property,
  onClose,
  onSave,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<CreatePropertyDto>>({
    label: '',
    code: '',
    dataType: 'text',
    isRequired: false,
    isUnique: false,
    description: '',
    showInGrid: true,
  });

  useEffect(() => {
    if (open) {
      if (property) {
        setFormData(property);
        setActiveStep(1);
      } else {
        setFormData({
          label: '',
          code: '',
          dataType: 'text',
          isRequired: false,
          isUnique: false,
          description: '',
          showInGrid: true,
        });
        setActiveStep(0);
      }
      setError(null);
    }
  }, [open, property]);

  const handleLabelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const label = e.target.value;
    setFormData((prev) => ({ ...prev, label }));

    if (!property && label.length > 2) {
      const code = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      setFormData((prev) => ({ ...prev, code }));

      setSuggestionLoading(true);
      try {
        const suggestion = await propertyApi.suggest(collectionId, label);
        if (suggestion.dataType) {
          setFormData((prev) => ({
            ...prev,
            dataType: suggestion.dataType as string,
          }));
        }
      } catch {
        // Ignore suggestion errors
      } finally {
        setSuggestionLoading(false);
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      if (property) {
        await propertyApi.update(collectionId, property.id, {
          label: formData.label,
          description: formData.description,
          isRequired: formData.isRequired,
          isUnique: formData.isUnique,
          showInGrid: formData.showInGrid,
        });
      } else {
        await propertyApi.create(collectionId, formData as CreatePropertyDto);
      }
      onSave();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save property';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const steps = property ? ['Configuration'] : ['Select Type', 'Configuration'];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-overlay/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-lg shadow-xl flex flex-col bg-card"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {property ? 'Edit Property' : 'New Property'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-hover"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {!property && (
            <div className="flex mb-6">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
                    activeStep >= index
                      ? 'border-current text-primary'
                      : 'border-transparent text-muted-foreground'
                  }`}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded border bg-danger-subtle border-danger-border text-danger-text">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!property && activeStep === 0 && (
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Employee Email"
                  value={formData.label || ''}
                  onChange={handleLabelChange}
                  className="w-full px-3 py-2 pr-10 rounded border text-sm bg-muted border-border text-foreground"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Property Name
                </label>
                {suggestionLoading && (
                  <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-pulse text-primary" />
                )}
              </div>

              <TypeSelector
                selectedType={formData.dataType}
                onSelect={(type) => {
                  setFormData((prev) => ({ ...prev, dataType: type }));
                  setActiveStep(1);
                }}
              />
            </div>
          )}

          {(property || activeStep === 1) && (
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={formData.label || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, label: e.target.value }))
                    }
                    required
                    className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                  />
                  <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                    Label
                  </label>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.code || ''}
                      disabled={!!property}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, code: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 rounded border text-sm disabled:opacity-60 bg-muted border-border text-foreground"
                    />
                    <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                      Code
                    </label>
                    <span className="text-xs mt-1 block text-muted-foreground">
                      System name (snake_case)
                    </span>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.dataType || ''}
                      disabled
                      className="w-full px-3 py-2 rounded border text-sm opacity-60 bg-muted border-border text-foreground"
                    />
                    <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                      Type
                    </label>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded border text-sm resize-none bg-muted border-border text-foreground"
                  />
                  <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                    Description
                  </label>
                </div>
              </div>

              <div className="w-full md:w-72 p-4 rounded bg-muted">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Settings
                </span>
                <div className="mt-2 space-y-1">
                  <ToggleSwitch
                    checked={formData.isRequired || false}
                    onChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isRequired: checked }))
                    }
                    label="Required"
                  />
                  <ToggleSwitch
                    checked={formData.isUnique || false}
                    onChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isUnique: checked }))
                    }
                    label="Unique"
                  />
                  <ToggleSwitch
                    checked={formData.showInGrid || false}
                    onChange={(checked) =>
                      setFormData((prev) => ({ ...prev, showInGrid: checked }))
                    }
                    label="Show in Grid"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border transition-colors hover:bg-hover border-border text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || (!property && !formData.code)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
