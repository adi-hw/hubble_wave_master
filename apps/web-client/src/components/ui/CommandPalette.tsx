import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Search, Command, Hash, Settings, FileText, Workflow, Shield, Bell, Zap, History, ChevronRight, Loader2, Star } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  category?: string;
  keywords?: string[];
  action: () => void;
}

export interface CommandGroup {
  id: string;
  label: string;
  commands: CommandItem[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands?: CommandItem[];
  groups?: CommandGroup[];
  placeholder?: string;
  emptyMessage?: string;
  recentCommands?: CommandItem[];
  favoriteCommands?: CommandItem[];
  isLoading?: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  commands = [],
  groups = [],
  placeholder = 'Type a command or search...',
  emptyMessage = 'No results found.',
  recentCommands = [],
  favoriteCommands = [],
  isLoading = false,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten all commands for searching
  const allCommands = useMemo(() => {
    const fromGroups = groups.flatMap((g) => g.commands);
    return [...commands, ...fromGroups];
  }, [commands, groups]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands when no query
      if (recentCommands.length > 0) {
        return recentCommands;
      }
      return allCommands.slice(0, 10);
    }

    const lowerQuery = query.toLowerCase();
    return allCommands.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(lowerQuery);
      const matchDescription = cmd.description?.toLowerCase().includes(lowerQuery);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery));
      const matchCategory = cmd.category?.toLowerCase().includes(lowerQuery);
      return matchLabel || matchDescription || matchKeywords || matchCategory;
    });
  }, [query, allCommands, recentCommands]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    if (!query.trim()) {
      // Show favorites first, then recent when no query
      const sections: { label: string; commands: CommandItem[] }[] = [];

      if (favoriteCommands.length > 0) {
        sections.push({ label: 'Favorites', commands: favoriteCommands.slice(0, 5) });
      }

      if (recentCommands.length > 0) {
        sections.push({ label: 'Recent', commands: recentCommands.slice(0, 5) });
      }

      if (sections.length > 0) {
        return sections;
      }

      // Fall back to showing first 10 commands
      return [{ label: 'Commands', commands: allCommands.slice(0, 10) }];
    }

    const grouped = new Map<string, CommandItem[]>();
    filteredCommands.forEach((cmd) => {
      const category = cmd.category || 'Commands';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(cmd);
    });

    return Array.from(grouped.entries()).map(([label, cmds]) => ({
      label,
      commands: cmds,
    }));
  }, [filteredCommands, query, recentCommands, favoriteCommands, allCommands]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    } else {
      inputRef.current?.focus();
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = filteredCommands.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-command-palette]')) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          // This would need to be handled by parent
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      />

      {/* Dialog */}
      <div
        data-command-palette
        className="relative w-full max-w-xl overflow-hidden rounded-xl shadow-2xl animate-fade-in"
        style={{
          backgroundColor: 'var(--hw-surface)',
          border: '1px solid var(--hw-border)',
        }}
      >
        {/* Search Input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--hw-border)' }}
        >
          <Search className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--hw-text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--hw-text)' }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto scrollbar-thin py-2"
        >
          {isLoading ? (
            <div className="px-4 py-8 text-center" style={{ color: 'var(--hw-text-muted)' }}>
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
              <p className="text-sm">Loading commands...</p>
            </div>
          ) : groupedCommands.length === 0 ? (
            <div className="px-4 py-8 text-center" style={{ color: 'var(--hw-text-muted)' }}>
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{emptyMessage}</p>
            </div>
          ) : (
            groupedCommands.map((group) => (
              <div key={group.label}>
                <div
                  className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  {group.label}
                </div>
                {group.commands.map((cmd) => {
                  const currentIndex = flatIndex++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      data-index={currentIndex}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                      style={{
                        backgroundColor: isSelected ? 'var(--hw-bg-subtle)' : 'transparent',
                        color: isSelected ? 'var(--hw-text)' : 'var(--hw-text-secondary)',
                      }}
                    >
                      {cmd.icon && (
                        <span
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{
                            backgroundColor: 'var(--hw-bg-subtle)',
                            color: 'var(--hw-text-muted)',
                          }}
                        >
                          {cmd.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div
                            className="text-xs truncate"
                            style={{ color: 'var(--hw-text-muted)' }}
                          >
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {group.label === 'Favorites' && (
                        <Star
                          className="h-3.5 w-3.5 flex-shrink-0"
                          style={{ color: 'var(--hw-warning)', fill: 'var(--hw-warning)' }}
                        />
                      )}
                      {cmd.shortcut && <kbd className="kbd">{cmd.shortcut}</kbd>}
                      <ChevronRight
                        className="h-4 w-4 flex-shrink-0 opacity-0 transition-opacity"
                        style={{
                          opacity: isSelected ? 0.5 : 0,
                          color: 'var(--hw-text-muted)',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t text-xs"
          style={{
            borderColor: 'var(--hw-border)',
            color: 'var(--hw-text-muted)',
            backgroundColor: 'var(--hw-bg-subtle)',
          }}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="kbd">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">↵</kbd>
              <span>Select</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>K to open</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Pre-built admin commands for the admin console
export const createAdminCommands = (navigate: (path: string) => void, basePath: string): CommandGroup[] => [
  {
    id: 'navigation',
    label: 'Navigation',
    commands: [
      {
        id: 'goto-dashboard',
        label: 'Go to Dashboard',
        description: 'Admin console overview',
        icon: <Hash className="h-4 w-4" />,
        shortcut: 'D',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin`),
      },
      {
        id: 'goto-tables',
        label: 'Go to Tables',
        description: 'Manage table configurations',
        icon: <FileText className="h-4 w-4" />,
        shortcut: 'T',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin/tables`),
      },
      {
        id: 'goto-workflows',
        label: 'Go to Workflows',
        description: 'Workflow designer',
        icon: <Workflow className="h-4 w-4" />,
        shortcut: 'W',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin/workflows`),
      },
      {
        id: 'goto-acls',
        label: 'Go to Access Control',
        description: 'ACL and permissions',
        icon: <Shield className="h-4 w-4" />,
        shortcut: 'A',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin/acl`),
      },
      {
        id: 'goto-notifications',
        label: 'Go to Notifications',
        description: 'Notification templates',
        icon: <Bell className="h-4 w-4" />,
        shortcut: 'N',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin/notifications`),
      },
      {
        id: 'goto-events',
        label: 'Go to Events',
        description: 'Event definitions',
        icon: <Zap className="h-4 w-4" />,
        shortcut: 'E',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin/events`),
      },
      {
        id: 'goto-history',
        label: 'Go to Change History',
        description: 'Audit trail and rollback',
        icon: <History className="h-4 w-4" />,
        shortcut: 'H',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin/history`),
      },
      {
        id: 'goto-settings',
        label: 'Go to Settings',
        description: 'Admin console settings',
        icon: <Settings className="h-4 w-4" />,
        shortcut: 'S',
        category: 'Navigation',
        action: () => navigate(`${basePath}/admin/settings`),
      },
    ],
  },
  {
    id: 'actions',
    label: 'Quick Actions',
    commands: [
      {
        id: 'create-table',
        label: 'Create New Table',
        description: 'Add a new data table',
        icon: <FileText className="h-4 w-4" />,
        category: 'Actions',
        keywords: ['add', 'new', 'table', 'create'],
        action: () => navigate(`${basePath}/admin/tables/new`),
      },
      {
        id: 'create-workflow',
        label: 'Create New Workflow',
        description: 'Design a new workflow',
        icon: <Workflow className="h-4 w-4" />,
        category: 'Actions',
        keywords: ['add', 'new', 'workflow', 'create'],
        action: () => navigate(`${basePath}/admin/workflows/new`),
      },
    ],
  },
];

export default CommandPalette;
