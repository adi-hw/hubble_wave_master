import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { schemaService, TableDefinition, TablesResponse } from '../../services/schema';
import { Plus, Database, Loader2, ChevronRight, Filter, Eye, EyeOff, Shield } from 'lucide-react';

const categoryColors: Record<string, string> = {
  application: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
  system: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
  workflow: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  security: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  notification: 'bg-green-500/10 border-green-500/30 text-green-400',
  event: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  audit: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  identity: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
};

export const SchemaList = () => {
  const [tables, setTables] = useState<TableDefinition[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showHidden, setShowHidden] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadTables();
  }, [selectedCategory, showHidden]);

  const loadTables = async () => {
    try {
      setIsLoading(true);
      const data: TablesResponse = await schemaService.getTablesWithMeta(showHidden, selectedCategory || undefined);
      setTables(data.items);
      setCategories(data.categories);
      setTotalCount(data.total);
    } catch (err) {
      setError('Failed to load tables');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryStyle = (category: string) => {
    return categoryColors[category] || categoryColors.application;
  };

  if (isLoading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Studio</p>
            <h1 className="text-2xl font-bold text-slate-100">Schema</h1>
            <p className="mt-1 text-sm text-slate-400">
              {tables.length} of {totalCount} tables{selectedCategory ? ` in ${selectedCategory}` : ''}
            </p>
          </div>
          <Link
            to="/studio/schema/new"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Table
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              showHidden
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showHidden ? 'Showing Hidden' : 'Show Hidden'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl shadow-slate-950/40 overflow-hidden">
          {tables.length === 0 ? (
            <div className="p-12 text-center space-y-3 text-slate-300">
              <Database className="mx-auto h-12 w-12 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-100">No tables found</h3>
              <p className="text-sm text-slate-400">
                {selectedCategory
                  ? `No tables in the "${selectedCategory}" category.`
                  : 'Get started by creating a new table.'}
              </p>
              {!selectedCategory && (
                <div className="mt-4">
                  <Link
                    to="/studio/schema/new"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-800 text-slate-100 text-sm font-medium hover:bg-slate-700 border border-slate-700"
                  >
                    <Plus className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                    Create Table
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {tables.map((table) => (
                <li key={table.tableName}>
                  <Link
                    to={`/studio/schema/${table.tableName}`}
                    className="block hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-lg border flex items-center justify-center ${getCategoryStyle(table.category)}`}>
                          <Database className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-100">
                              {table.label}
                            </p>
                            {table.isSystem && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Shield className="h-3 w-3" />
                                System
                              </span>
                            )}
                            {table.isHidden && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400 border border-slate-500/30">
                                <EyeOff className="h-3 w-3" />
                                Hidden
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-slate-500">{table.tableName}</p>
                            <span className="text-slate-600">•</span>
                            <p className="text-xs text-slate-400">{table.columnCount} columns</p>
                            <span className="text-slate-600">•</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getCategoryStyle(table.category)}`}>
                              {table.category}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
