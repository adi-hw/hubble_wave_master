import { Plus, Check, Trash2, Edit2, MoreHorizontal } from 'lucide-react';
import { ViewDefinition } from '../../../services/viewApi';
import { useState } from 'react';

interface ViewSelectorProps {
  views: ViewDefinition[];
  currentViewId: string | null;
  onViewChange: (viewId: string) => void;
  onCreateView: () => void;
  onEditView: (view: ViewDefinition) => void;
  onDeleteView: (view: ViewDefinition) => void;
}

export function ViewSelector({ 
  views, 
  currentViewId, 
  onViewChange, 
  onCreateView,
  onEditView,
  onDeleteView
}: ViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentView = views.find(v => v.id === currentViewId) || views[0];

  return (
    <div className="relative">
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1 items-center">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors shadow-sm"
        >
          {currentView?.label || 'All Records'}
          <MoreHorizontal className="w-4 h-4 text-gray-500" />
        </button>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <button
          onClick={onCreateView}
          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all"
          title="Create View"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 py-2">
            <div className="px-3 pb-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Views</span>
            </div>
            
            <div className="max-h-64 overflow-y-auto py-1">
              {views.map(view => (
                <div 
                  key={view.id}
                  className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    currentViewId === view.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                  onClick={() => {
                    onViewChange(view.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {currentViewId === view.id && <Check className="w-3 h-3 text-indigo-600 flex-shrink-0" />}
                    <span className={`text-sm truncate ${
                      currentViewId === view.id ? 'text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {view.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!view.isSystem && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditView(view);
                          }}
                          className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteView(view);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-1 pt-2 border-t border-gray-100 dark:border-gray-700 px-3">
              <button
                onClick={() => {
                  onCreateView();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create new view
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
