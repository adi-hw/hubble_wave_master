import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deriveTenantSlug } from '../services/token';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const moduleBase = useMemo(() => {
    const tenantSlug = deriveTenantSlug(window.location.hostname) || 'default';
    return `/${tenantSlug}/ui/modules`;
  }, []);

  const commands = useMemo(
    () => [
      { label: 'Go to Modules', shortcut: 'H', path: `${moduleBase}` },
      { label: 'Go to Assets', shortcut: 'A', path: `${moduleBase}/assets` },
      { label: 'Go to Workflows', shortcut: 'W', path: `${moduleBase}/workflows` },
      { label: 'Go to Forms', shortcut: 'F', path: `${moduleBase}/forms` },
      { label: 'Go to Data Models', shortcut: 'M', path: `${moduleBase}/model_table` },
      { label: 'Go to Settings', shortcut: 'S', path: `${moduleBase}/settings` },
    ],
    [moduleBase]
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/30 backdrop-blur-sm pt-24">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-500">No matches.</div>
          )}
          {filtered.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={() => {
                navigate(cmd.path);
                onClose();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
            >
              <span>{cmd.label}</span>
              <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1 py-0.5">
                {cmd.shortcut}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
