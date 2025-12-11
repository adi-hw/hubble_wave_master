import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getTableMetadata } from '../services/platform.service';
import api from '../services/metadataApi';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { ChoiceEditor } from '../components/ChoiceEditor';
import { FieldTemplateSelector } from '../components/FieldTemplateSelector';
import { FIELD_TEMPLATES, FieldTemplate } from '../config/fieldTemplates';
import { ValidationRulesEditor } from '../components/ValidationRulesEditor';

export const FieldManagerPage: React.FC = () => {
  const { tableCode } = useParams<{ tableCode: string }>();
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);

  const loadFields = async () => {
    if (!tableCode) return;
    const metadata = await getTableMetadata(tableCode);
    setFields(metadata.fields);
    setLoading(false);
  };

  useEffect(() => {
    loadFields();
  }, [tableCode]);

  const handleDelete = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    await api.delete(`/models/${tableCode}/fields/${fieldId}`);
    await loadFields();
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Field Manager: {tableCode}</h1>
          <p className="text-gray-600">Manage fields for this table</p>
        </div>
        <button
          onClick={() => { setEditingField(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>

      {showForm && (
        <FieldEditorForm
          tableCode={tableCode!}
          field={editingField}
          onSave={() => { setShowForm(false); loadFields(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="bg-white rounded-md shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Label</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Storage Path</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Nullable</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.code} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono">{field.code}</td>
                <td className="px-4 py-3 text-sm">{field.label}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {field.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{field.storagePath}</td>
                <td className="px-4 py-3 text-sm">{field.nullable ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setEditingField(field); setShowForm(true); }}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(field.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface FieldEditorFormProps {
  tableCode: string;
  field?: any;
  onSave: () => void;
  onCancel: () => void;
}

const FieldEditorForm: React.FC<FieldEditorFormProps> = ({ tableCode, field, onSave, onCancel }) => {
  const [code, setCode] = useState(field?.code || '');
  const [label, setLabel] = useState(field?.label || '');
  const [fieldType, setFieldType] = useState(field?.type || 'string');
  const [storageType, setStorageType] = useState(field?.storagePath?.startsWith('column:') ? 'column' : 'json');
  const [storagePath, setStoragePath] = useState('');
  const [nullable, setNullable] = useState(field?.nullable ?? true);
  const [config, setConfig] = useState<any>(field?.config || {});
  const [showTemplates, setShowTemplates] = useState(!field); // Show templates only for new fields

  useEffect(() => {
    if (field?.storagePath) {
      const [type, path] = field.storagePath.split(':');
      setStorageType(type);
      setStoragePath(path);
    }
  }, [field]);

  const applyTemplate = (template: FieldTemplate) => {
    setFieldType(template.defaults.fieldType);
    setConfig({ ...config, ...template.defaults.config });
    if (template.defaults.validators) {
      setConfig((prev: any) => ({ ...prev, validators: template.defaults.validators }));
    }
    if (template.defaults.storageType) {
      setStorageType(template.defaults.storageType);
    }
    // Auto-suggest code and label if not set
    if (!code) {
      setCode(template.id);
      setLabel(template.name);
    }
    setShowTemplates(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullStoragePath = storageType === 'column'
      ? `column:${storagePath || code}`
      : `json:custom_data.${storagePath || code}`;

    const dto = {
      code,
      label,
      fieldTypeCode: fieldType,
      nullable,
      storagePath: fullStoragePath,
      config,
    };

    if (field) {
      await api.patch(`/models/${tableCode}/fields/${field.id}`, dto);
    } else {
      await api.post(`/models/${tableCode}/fields`, dto);
    }

    onSave();
  };

  return (
    <div className="mb-6 p-6 bg-gray-50 rounded-md border">
      <h2 className="text-lg font-semibold mb-4">{field ? 'Edit Field' : 'New Field'}</h2>
      
      {showTemplates && !field && (
        <FieldTemplateSelector
          templates={FIELD_TEMPLATES}
          onSelect={applyTemplate}
          onSkip={() => setShowTemplates(false)}
        />
      )}

      {(!showTemplates || field) && (
        <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fm-code" className="block text-sm font-medium mb-1">Code *</label>
            <input
              id="fm-code"
              name="code"
              type="text"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              disabled={!!field}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label htmlFor="fm-label" className="block text-sm font-medium mb-1">Label *</label>
            <input
              id="fm-label"
              name="label"
              type="text"
              autoComplete="off"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fm-field-type" className="block text-sm font-medium mb-1">Field Type *</label>
            <select
              id="fm-field-type"
              name="fieldType"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              disabled={!!field}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="string">String</option>
              <option value="integer">Integer</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
              <option value="datetime">DateTime</option>
              <option value="choice">Choice</option>
              <option value="reference">Reference</option>
            </select>
          </div>
          <div>
            <label htmlFor="fm-nullable" className="flex items-center gap-2">
              <input
                id="fm-nullable"
                name="nullable"
                type="checkbox"
                checked={nullable}
                onChange={(e) => setNullable(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">Nullable</span>
            </label>
          </div>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium mb-2">Storage Type *</legend>
          <div className="flex gap-4">
            <label htmlFor="fm-storage-column" className="flex items-center gap-2">
              <input
                id="fm-storage-column"
                name="storageType"
                type="radio"
                value="column"
                checked={storageType === 'column'}
                onChange={(e) => setStorageType(e.target.value)}
                disabled={!!field}
              />
              <span>Database Column</span>
            </label>
            <label htmlFor="fm-storage-json" className="flex items-center gap-2">
              <input
                id="fm-storage-json"
                name="storageType"
                type="radio"
                value="json"
                checked={storageType === 'json'}
                onChange={(e) => setStorageType(e.target.value)}
                disabled={!!field}
              />
              <span>Custom (JSONB)</span>
            </label>
          </div>
        </fieldset>

        {storageType === 'column' && (
          <div>
            <label htmlFor="fm-column-name" className="block text-sm font-medium mb-1">Column Name</label>
            <input
              id="fm-column-name"
              name="columnName"
              type="text"
              autoComplete="off"
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              placeholder={`Default: ${code}`}
              disabled={!!field}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        )}

        {storageType === 'json' && (
          <div>
            <label htmlFor="fm-jsonb-key" className="block text-sm font-medium mb-1">JSONB Key</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">custom_data.</span>
              <input
                id="fm-jsonb-key"
                name="jsonbKey"
                type="text"
                autoComplete="off"
                value={storagePath}
                onChange={(e) => setStoragePath(e.target.value)}
                placeholder={code}
                disabled={!!field}
                className="flex-1 px-3 py-2 border rounded-md"
              />
            </div>
          </div>
        )}

        <ValidationRulesEditor
          fieldType={fieldType}
          rules={config.validators || {}}
          onChange={(validators) => setConfig({ ...config, validators })}
        />

        {fieldType === 'choice' && (
          <ChoiceEditor
            choices={config.choices || []}
            onChange={(choices) => setConfig({ ...config, choices })}
          />
        )}

        <div className="flex gap-2 justify-end pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {field ? 'Update' : 'Create'} Field
          </button>
        </div>
      </form>
      )}
    </div>
  );
};
