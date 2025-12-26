import { useState } from 'react';
import { Sparkles, X, LayoutGrid, Kanban } from 'lucide-react';
import { CreateViewDto, viewApi } from '../../../services/viewApi';

interface CreateViewModalProps {
  collectionId: string;
  onClose: () => void;
  onSuccess: (viewId: string) => void;
}

export function CreateViewModal({ collectionId, onClose, onSuccess }: CreateViewModalProps) {
  const [formData, setFormData] = useState<Partial<CreateViewDto>>({
    label: '',
    viewType: 'grid',
    visibility: 'personal' // Default
  });
  const [avaPrompt, setAvaPrompt] = useState('');
  const [isUsingAva, setIsUsingAva] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let dataToSubmit = { ...formData, collectionId };

      if (isUsingAva && avaPrompt) {
        // Generate config from AVA
        const generated = await viewApi.generateFromPrompt(collectionId, avaPrompt);
        dataToSubmit = {
          ...dataToSubmit,
          ...generated,
          config: (generated.config || {}) as any, // Ensure config object
        };
      }

      const view = await viewApi.create(collectionId, dataToSubmit);
      onSuccess(view.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create view');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create View</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          {/* AVA Toggle */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Use AI Assistant</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Describe what you want to see</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isUsingAva} 
                onChange={e => setIsUsingAva(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {isUsingAva ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                What would you like to see?
              </label>
              <textarea
                value={avaPrompt}
                onChange={e => setAvaPrompt(e.target.value)}
                placeholder="e.g., Show me high priority tickets assigned to me..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px]"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  View Name
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={e => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., All Records"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  View Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <TypeOption
                    active={formData.viewType === 'grid'}
                    onClick={() => setFormData({ ...formData, viewType: 'grid' })}
                    icon={LayoutGrid}
                    label="Table"
                    description="Standard grid view"
                  />
                  <TypeOption
                    active={formData.viewType === 'board'}
                    onClick={() => setFormData({ ...formData, viewType: 'board' })}
                    icon={Kanban}
                    label="Board"
                    description="Kanban style board"
                  />
                  {/* Add more types later */}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (isUsingAva && !avaPrompt) || (!isUsingAva && !formData.label)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/30 font-medium"
            >
              {loading ? 'Creating...' : isUsingAva ? 'Generate & Create' : 'Create View'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TypeOption({ 
  active, 
  onClick, 
  icon: Icon, 
  label, 
  description 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string; 
  description: string; 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
        active
          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-600'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-gray-500'}`} />
      <div>
        <div className={`text-sm font-medium ${active ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'}`}>
          {label}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {description}
        </div>
      </div>
    </button>
  );
}
