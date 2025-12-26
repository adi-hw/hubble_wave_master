import { PropertyDefinition } from '../../../services/viewApi';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

interface BoardViewProps {
  data: Record<string, unknown>[];
  properties: PropertyDefinition[];
  loading: boolean;
  collectionCode: string;
  config?: any; // BoardViewConfig
}

export function BoardView({ data, properties, loading, collectionCode, config }: BoardViewProps) {
  const navigate = useNavigate();

  // 1. Identify Grouping Field
  const groupingField = useMemo(() => {
    // defaults to first choice field or status
    if (config?.groupByPropertyCode) return config.groupByPropertyCode;

    const statusField = properties.find(p => p.code === 'status' || p.code === 'stage');
    if (statusField) return statusField.code;
    
    const choiceField = properties.find(p => p.propertyType === 'choice' || p['dataType'] === 'choice');
    return choiceField ? choiceField.code : null;
  }, [properties, config]);

  // 2. Group Data
  const lanes = useMemo(() => {
    if (!groupingField) return { 'Uncategorized': data };

    const groups: Record<string, Record<string, unknown>[]> = {};
    
    // Initialize groups from choice list if available
    const prop = properties.find(p => p.code === groupingField);
    if (prop && prop.choiceList) {
        prop.choiceList.forEach(c => {
            groups[c.label || c.value] = [];
        });
    }
    groups['Uncategorized'] = [];

    data.forEach(item => {
        const val = item[groupingField];
        const key = val ? String(val) : 'Uncategorized';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    return groups;
  }, [data, groupingField, properties]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading board...</div>;

  if (!groupingField) {
      return (
        <div className="p-8 text-center text-gray-500">
            No grouping field found (Choice or Status). Please configure the view.
        </div>
      );
  }

  return (
    <div className="flex h-full overflow-x-auto p-4 gap-4 bg-gray-50 dark:bg-gray-900/50">
      {Object.entries(lanes).map(([laneTitle, items]) => (
        <div key={laneTitle} className="flex-none w-72 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    {laneTitle}
                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">
                        {items.length}
                    </span>
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px]">
                {items.map(item => (
                    <div 
                        key={item.id as string}
                        onClick={() => navigate(`/data/${collectionCode}/${item.id}`)}
                        className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
                    >
                        <div className="font-medium text-gray-900 dark:text-white mb-2">
                             {/* Title: Try 'title', 'name', 'subject' or first text field */}
                             {String(item.title || item.name || item.subject || item.label || item[properties.find(p=>p.propertyType==='text')?.code || 'id'] || 'Untitled')}
                        </div>
                        
                        {/* Summary fields */}
                        <div className="space-y-1">
                             {properties.slice(0, 3).filter(p => p.code !== groupingField).map(p => {
                                 const val = item[p.code];
                                 if (!val) return null;
                                 return (
                                     <div key={p.code} className="text-xs text-gray-500 flex justify-between">
                                         <span className="opacity-75">{p.label}:</span>
                                         <span>{String(val)}</span>
                                     </div>
                                 );
                             })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      ))}
    </div>
  );
}
