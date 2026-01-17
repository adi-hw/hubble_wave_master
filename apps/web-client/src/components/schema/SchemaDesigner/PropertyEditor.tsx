/**
 * PropertyEditor Component
 * HubbleWave Platform - Phase 2
 *
 * Detailed property configuration editor.
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';
import { SchemaCollection, SchemaProperty, PropertyType, PropertyConfig } from './types';

interface PropertyEditorProps {
  property: SchemaProperty;
  collection: SchemaCollection;
  collections: SchemaCollection[];
  onUpdate: (updates: Partial<SchemaProperty>) => void;
  onClose: () => void;
}

const REFERENCE_TYPES: PropertyType[] = ['reference', 'multi_reference'];
const CHOICE_TYPES: PropertyType[] = ['choice', 'multi_choice', 'tags'];

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  property,
  collection,
  collections,
  onUpdate,
  onClose,
}) => {
  const [name, setName] = useState(property.name);
  const [description, setDescription] = useState(property.description || '');
  const [required, setRequired] = useState(property.required || false);
  const [unique, setUnique] = useState(property.unique || false);
  const [indexed, setIndexed] = useState(property.indexed || false);
  const [hidden, setHidden] = useState(property.hidden || false);
  const [defaultValue, setDefaultValue] = useState(
    property.config?.defaultValue !== undefined ? String(property.config.defaultValue) : ''
  );
  const [placeholder, setPlaceholder] = useState(property.config?.placeholder || '');
  const [helpText, setHelpText] = useState(property.config?.helpText || '');

  // Reference config
  const [referenceCollection, setReferenceCollection] = useState(
    property.config?.referenceCollection || ''
  );
  const [referenceDisplayProperty, setReferenceDisplayProperty] = useState(
    property.config?.referenceDisplayProperty || ''
  );

  // Formula config
  const [formula, setFormula] = useState(property.config?.formula || '');

  // Rollup config
  const [rollupRelation, setRollupRelation] = useState(
    property.config?.rollupConfig?.relationProperty || ''
  );
  const [rollupAggregation, setRollupAggregation] = useState<'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last'>(
    property.config?.rollupConfig?.aggregation || 'sum'
  );
  const [rollupProperty, setRollupProperty] = useState(
    property.config?.rollupConfig?.aggregateProperty || ''
  );

  // Lookup config
  const [lookupReference, setLookupReference] = useState(
    property.config?.lookupConfig?.referenceProperty || ''
  );
  const [lookupSource, setLookupSource] = useState(
    property.config?.lookupConfig?.sourceProperty || ''
  );

  // Validation config - setters reserved for future validation editor UI
  const [minLength] = useState(
    property.config?.validators?.minLength?.toString() || ''
  );
  const [maxLength] = useState(
    property.config?.validators?.maxLength?.toString() || ''
  );
  const [min] = useState(property.config?.validators?.min?.toString() || '');
  const [max] = useState(property.config?.validators?.max?.toString() || '');
  const [pattern] = useState(property.config?.validators?.pattern || '');

  // Choices
  const [choices, setChoices] = useState(
    property.config?.choices || []
  );
  const [newChoiceValue, setNewChoiceValue] = useState('');
  const [newChoiceLabel, setNewChoiceLabel] = useState('');

  useEffect(() => {
    setName(property.name);
    setDescription(property.description || '');
    setRequired(property.required || false);
    setUnique(property.unique || false);
    setIndexed(property.indexed || false);
    setHidden(property.hidden || false);
  }, [property]);

  const handleSave = () => {
    const config: PropertyConfig = {
      defaultValue: defaultValue || undefined,
      placeholder: placeholder || undefined,
      helpText: helpText || undefined,
      validators: {
        required,
        minLength: minLength ? parseInt(minLength) : undefined,
        maxLength: maxLength ? parseInt(maxLength) : undefined,
        min: min ? parseFloat(min) : undefined,
        max: max ? parseFloat(max) : undefined,
        pattern: pattern || undefined,
      },
    };

    if (REFERENCE_TYPES.includes(property.type)) {
      config.referenceCollection = referenceCollection;
      config.referenceDisplayProperty = referenceDisplayProperty;
    }

    if (property.type === 'formula') {
      config.formula = formula;
    }

    if (property.type === 'rollup') {
      config.rollupConfig = {
        relationProperty: rollupRelation,
        aggregation: rollupAggregation as 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last',
        aggregateProperty: rollupProperty,
      };
    }

    if (property.type === 'lookup') {
      config.lookupConfig = {
        referenceProperty: lookupReference,
        sourceProperty: lookupSource,
      };
    }

    if (CHOICE_TYPES.includes(property.type)) {
      config.choices = choices;
    }

    onUpdate({
      name,
      description: description || undefined,
      required,
      unique,
      indexed,
      hidden,
      config,
    });
  };

  const addChoice = () => {
    if (newChoiceValue.trim()) {
      setChoices([
        ...choices,
        {
          value: newChoiceValue.trim(),
          label: newChoiceLabel.trim() || newChoiceValue.trim(),
        },
      ]);
      setNewChoiceValue('');
      setNewChoiceLabel('');
    }
  };

  const removeChoice = (index: number) => {
    setChoices(choices.filter((_, i) => i !== index));
  };

  const isReference = REFERENCE_TYPES.includes(property.type);
  const isChoice = CHOICE_TYPES.includes(property.type);

  // Get reference properties for lookup
  const referenceProperties = collection.properties.filter((p) =>
    REFERENCE_TYPES.includes(p.type)
  );

  return (
    <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground">
          Edit Property
        </h4>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* System property warning */}
        {property.system && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-subtle text-warning-text">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="text-sm">
              This is a system property. Some settings cannot be changed.
            </span>
          </div>
        )}

        {/* Basic info */}
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={property.system}
            className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50 bg-muted border border-border text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Code
          </label>
          <input
            type="text"
            value={property.code}
            disabled
            className="w-full px-3 py-2 rounded-lg text-sm font-mono opacity-50 bg-muted border border-border text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-muted border border-border text-foreground"
            rows={2}
          />
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              disabled={property.system}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-foreground">
              Required
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={unique}
              onChange={(e) => setUnique(e.target.checked)}
              disabled={property.system}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-foreground">
              Unique
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={indexed}
              onChange={(e) => setIndexed(e.target.checked)}
              disabled={property.system}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-foreground">
              Indexed
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-foreground">
              Hidden from UI
            </span>
          </label>
        </div>

        {/* Reference configuration */}
        {isReference && (
          <>
            <div className="pt-4 border-t border-border">
              <h5 className="text-sm font-medium mb-3 text-muted-foreground">
                Reference Settings
              </h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1 text-muted-foreground">
                    Target Collection
                  </label>
                  <select
                    value={referenceCollection}
                    onChange={(e) => setReferenceCollection(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                  >
                    <option value="">Select collection...</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-muted-foreground">
                    Display Property
                  </label>
                  <select
                    value={referenceDisplayProperty}
                    onChange={(e) => setReferenceDisplayProperty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                    disabled={!referenceCollection}
                  >
                    <option value="">Select property...</option>
                    {collections
                      .find((c) => c.id === referenceCollection)
                      ?.properties.map((p) => (
                        <option key={p.id} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Formula configuration */}
        {property.type === 'formula' && (
          <div className="pt-4 border-t border-border">
            <h5 className="text-sm font-medium mb-3 text-muted-foreground">
              Formula
            </h5>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g., {quantity} * {unit_price}"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono resize-none bg-muted border border-border text-foreground"
              rows={4}
            />
            <div className="flex items-start gap-1 mt-2 text-xs text-muted-foreground">
              <Info size={12} className="flex-shrink-0 mt-0.5" />
              <span>Use {'{property_code}'} to reference other fields</span>
            </div>
          </div>
        )}

        {/* Rollup configuration */}
        {property.type === 'rollup' && (
          <div className="pt-4 border-t border-border">
            <h5 className="text-sm font-medium mb-3 text-muted-foreground">
              Rollup Settings
            </h5>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1 text-muted-foreground">
                  Relation Property
                </label>
                <select
                  value={rollupRelation}
                  onChange={(e) => setRollupRelation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                >
                  <option value="">Select relation...</option>
                  {referenceProperties.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 text-muted-foreground">
                  Aggregation
                </label>
                <select
                  value={rollupAggregation}
                  onChange={(e) => setRollupAggregation(e.target.value as 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last')}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="count">Count</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                  <option value="first">First</option>
                  <option value="last">Last</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 text-muted-foreground">
                  Property to Aggregate
                </label>
                <input
                  type="text"
                  value={rollupProperty}
                  onChange={(e) => setRollupProperty(e.target.value)}
                  placeholder="e.g., amount"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* Lookup configuration */}
        {property.type === 'lookup' && (
          <div className="pt-4 border-t border-border">
            <h5 className="text-sm font-medium mb-3 text-muted-foreground">
              Lookup Settings
            </h5>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1 text-muted-foreground">
                  Reference Property
                </label>
                <select
                  value={lookupReference}
                  onChange={(e) => setLookupReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                >
                  <option value="">Select reference...</option>
                  {referenceProperties.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 text-muted-foreground">
                  Source Property
                </label>
                <input
                  type="text"
                  value={lookupSource}
                  onChange={(e) => setLookupSource(e.target.value)}
                  placeholder="e.g., name"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* Choice configuration */}
        {isChoice && (
          <div className="pt-4 border-t border-border">
            <h5 className="text-sm font-medium mb-3 text-muted-foreground">
              Choices
            </h5>
            <div className="space-y-2 mb-3">
              {choices.map((choice, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex-1 px-2 py-1 rounded text-sm bg-muted text-foreground">
                    {choice.label}
                  </span>
                  <button
                    onClick={() => removeChoice(index)}
                    className="p-1 rounded hover:bg-muted text-destructive"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newChoiceLabel}
                onChange={(e) => setNewChoiceLabel(e.target.value)}
                placeholder="Label"
                className="flex-1 px-2 py-1 rounded text-sm bg-muted border border-border text-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!newChoiceValue) setNewChoiceValue(newChoiceLabel);
                    addChoice();
                  }
                }}
              />
              <input
                type="text"
                value={newChoiceValue}
                onChange={(e) => setNewChoiceValue(e.target.value)}
                placeholder="Value"
                className="w-20 px-2 py-1 rounded text-sm font-mono bg-muted border border-border text-foreground"
              />
              <button
                onClick={addChoice}
                className="px-2 py-1 rounded text-sm bg-primary text-primary-foreground"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* UI Settings */}
        <div className="pt-4 border-t border-border">
          <h5 className="text-sm font-medium mb-3 text-muted-foreground">
            UI Settings
          </h5>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1 text-muted-foreground">
                Placeholder
              </label>
              <input
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-muted-foreground">
                Help Text
              </label>
              <textarea
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-muted border border-border text-foreground"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-muted-foreground">
                Default Value
              </label>
              <input
                type="text"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex justify-end gap-2 flex-shrink-0 border-t border-border">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground"
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
};

export default PropertyEditor;
