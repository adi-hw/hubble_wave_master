/**
 * CommandPalette - Command Palette (⌘K)
 *
 * A powerful command palette with:
 * - Fuzzy search across navigation, actions, and records
 * - Recent items and favorites
 * - Keyboard navigation
 * - Category filtering
 * - AVA integration fallback
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Command,
  ChevronRight,
  Loader2,
  Star,
  Clock,
  Plus,
  FileText,
  Settings,
  Home,
  Layout,
  Wrench,
  Box,
  MapPin,
  Package,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigation } from '../../contexts/NavigationContext';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  category?: string;
  keywords?: string[];
  action: () => void;
  isFavorite?: boolean;
  isRecent?: boolean;
}

export interface CommandGroup {
  id: string;
  label: string;
  commands: CommandItem[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenAva?: () => void;
}

// Fuzzy match scoring
const fuzzyMatch = (query: string, target: string): number => {
  if (!query) return 1;
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  // Exact match
  if (lowerTarget === lowerQuery) return 100;
  // Starts with
  if (lowerTarget.startsWith(lowerQuery)) return 80;
  // Contains
  if (lowerTarget.includes(lowerQuery)) return 60;

  // Fuzzy character match
  let score = 0;
  let queryIndex = 0;
  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length ? 40 + score : 0;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onOpenAva,
}) => {
  const navigate = useNavigate();
  // location available for context-aware commands
  void useLocation;
  const { navigation, recordNavigation, searchNavigation } = useNavigation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list from navigation
  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Quick Actions - using ServiceNow-style collection routes
    items.push(
      {
        id: 'create-work-order',
        label: 'Create Work Order',
        description: 'Create a new work order',
        icon: <Plus className="h-4 w-4" />,
        category: 'Quick Actions',
        keywords: ['new', 'wo', 'maintenance'],
        action: () => {
          navigate('/work_orders.list');
          onClose();
        },
      },
      {
        id: 'create-asset',
        label: 'Create Asset',
        description: 'Add a new asset to the system',
        icon: <Box className="h-4 w-4" />,
        category: 'Quick Actions',
        keywords: ['new', 'equipment', 'add'],
        action: () => {
          navigate('/assets.list');
          onClose();
        },
      },
      {
        id: 'search-assets',
        label: 'Search Assets',
        description: 'Find assets in the system',
        icon: <Search className="h-4 w-4" />,
        category: 'Quick Actions',
        keywords: ['find', 'lookup'],
        action: () => {
          navigate('/assets.list');
          onClose();
        },
      }
    );

    // Navigation items
    const navItems: CommandItem[] = [
      {
        id: 'nav-home',
        label: 'Go to Home',
        description: 'Dashboard overview',
        icon: <Home className="h-4 w-4" />,
        category: 'Navigation',
        shortcut: 'G H',
        keywords: ['dashboard', 'main'],
        action: () => {
          navigate('/');
          onClose();
        },
      },
      {
        id: 'nav-assets',
        label: 'Go to Assets',
        description: 'Asset management',
        icon: <Box className="h-4 w-4" />,
        category: 'Navigation',
        shortcut: 'G A',
        keywords: ['equipment', 'items'],
        action: () => {
          navigate('/assets.list');
          onClose();
        },
      },
      {
        id: 'nav-work-orders',
        label: 'Go to Work Orders',
        description: 'Work order management',
        icon: <Wrench className="h-4 w-4" />,
        category: 'Navigation',
        shortcut: 'G W',
        keywords: ['wo', 'maintenance', 'tasks'],
        action: () => {
          navigate('/work_orders.list');
          onClose();
        },
      },
      {
        id: 'nav-locations',
        label: 'Go to Locations',
        description: 'Location hierarchy',
        icon: <MapPin className="h-4 w-4" />,
        category: 'Navigation',
        shortcut: 'G L',
        keywords: ['sites', 'buildings', 'areas'],
        action: () => {
          navigate('/locations.list');
          onClose();
        },
      },
      {
        id: 'nav-parts',
        label: 'Go to Parts',
        description: 'Parts inventory',
        icon: <Package className="h-4 w-4" />,
        category: 'Navigation',
        shortcut: 'G P',
        keywords: ['inventory', 'stock', 'spare'],
        action: () => {
          navigate('/parts.list');
          onClose();
        },
      },
      {
        id: 'nav-studio',
        label: 'Go to Studio',
        description: 'Platform configuration',
        icon: <Layout className="h-4 w-4" />,
        category: 'Navigation',
        shortcut: 'G S',
        keywords: ['admin', 'config', 'settings'],
        action: () => {
          navigate('/studio');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        description: 'User preferences',
        icon: <Settings className="h-4 w-4" />,
        category: 'Navigation',
        keywords: ['preferences', 'profile', 'account'],
        action: () => {
          navigate('/settings');
          onClose();
        },
      },
    ];
    items.push(...navItems);

    // Add navigation nodes if available
    if (navigation?.nodes) {
      const processNode = (node: any, depth = 0) => {
        if (node.route && node.type === 'module') {
          items.push({
            id: `nav-${node.key}`,
            label: `Go to ${node.label}`,
            description: node.description,
            icon: <FileText className="h-4 w-4" />,
            category: 'Navigation',
            keywords: [node.key, node.label.toLowerCase()],
            action: () => {
              navigate(node.route);
              if (node.moduleKey) {
                recordNavigation?.(node.moduleKey);
              }
              onClose();
            },
          });
        }
        if (node.children) {
          node.children.forEach((child: any) => processNode(child, depth + 1));
        }
      };
      navigation.nodes.forEach((node: any) => processNode(node));
    }

    // AVA Integration
    if (onOpenAva) {
      items.push({
        id: 'ask-ava',
        label: 'Ask AVA',
        description: 'Get help from your AI assistant',
        icon: <Sparkles className="h-4 w-4" />,
        category: 'Help',
        shortcut: '⌘J',
        keywords: ['ai', 'help', 'assistant', 'chat'],
        action: () => {
          onClose();
          onOpenAva();
        },
      });
    }

    return items;
  }, [navigation, navigate, onClose, onOpenAva, recordNavigation]);

  // Recent / favorites from navigation context
  const recentCommands = useMemo(() => {
    if (!navigation?.recentModules?.length) return [];
    return navigation.recentModules.slice(0, 5).map(
      (module): CommandItem => ({
        id: `recent-${module.key}`,
        label: module.label,
        description: 'Recent',
        category: 'Recent',
        icon: <Clock className="h-4 w-4" />,
        action: () => {
          if (module.route) {
            navigate(module.route);
          }
          recordNavigation?.(module.key);
          onClose();
        },
        isRecent: true,
      })
    );
  }, [navigation?.recentModules, navigate, onClose, recordNavigation]);

  const favoriteCommands = useMemo(() => {
    if (!navigation?.favorites?.length || !navigation?.nodes) return [];
    const items: CommandItem[] = [];
    const collect = (node: any) => {
      if (node.moduleKey && navigation.favorites?.includes(node.moduleKey) && node.route) {
        items.push({
          id: `fav-${node.moduleKey}`,
          label: node.label,
          description: 'Favorite',
          category: 'Favorites',
          icon: <Star className="h-4 w-4" />,
          action: () => {
            navigate(node.route);
            recordNavigation?.(node.moduleKey);
            onClose();
          },
          isFavorite: true,
        });
      }
      node.children?.forEach(collect);
    };
    navigation.nodes.forEach(collect);
    return items;
  }, [navigation?.favorites, navigation?.nodes, navigate, onClose, recordNavigation]);

  const searchCommands = useMemo(() => {
    if (!query.trim() || query.trim().length < 2 || !searchNavigation) return [];
    return searchNavigation(query)
      .slice(0, 10)
      .map<CommandItem>((result) => ({
        id: `search-${result.key}`,
        label: result.label,
        description: result.path?.join(' / '),
        category: 'Records',
        icon: <Search className="h-4 w-4" />,
        keywords: [result.key, result.label],
        action: () => {
          if (result.route) {
            navigate(result.route);
            if (result.key) {
              recordNavigation?.(result.key);
            }
          }
          onClose();
        },
      }));
  }, [query, searchNavigation, navigate, onClose, recordNavigation]);

  // Filter and score commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show favorites, recents, quick actions by default
      const combined = [...favoriteCommands, ...recentCommands, ...commands];
      return combined.slice(0, 15);
    }

    const base = [...commands, ...favoriteCommands, ...recentCommands, ...searchCommands];

    return base
      .map((cmd) => {
        const labelScore = fuzzyMatch(query, cmd.label);
        const descScore = cmd.description ? fuzzyMatch(query, cmd.description) * 0.5 : 0;
        const keywordScore = cmd.keywords
          ? Math.max(...cmd.keywords.map((k) => fuzzyMatch(query, k))) * 0.3
          : 0;
        return { ...cmd, score: Math.max(labelScore, descScore, keywordScore) };
      })
      .filter((cmd) => cmd.score && cmd.score > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 20);
  }, [commands, query, favoriteCommands, recentCommands, searchCommands]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();

    filteredCommands.forEach((cmd) => {
      const category = cmd.isRecent ? 'Recent' : cmd.isFavorite ? 'Favorites' : (cmd.category || 'General');
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(cmd);
    });

    return Array.from(groups.entries()).map(([label, cmds]) => ({
      label,
      commands: cmds,
    }));
  }, [filteredCommands]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
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

  // Scroll selected into view
  useEffect(() => {
    const selected = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Global shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // This is handled by parent
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-command-palette]')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[var(--z-spotlight)] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm bg-overlay/50"
      />

      {/* Dialog */}
      <div
        data-command-palette
        className="relative w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl animate-scale-in glass-surface-elevated border border-border"
      >
        {/* Search Input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-border"
        >
          <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent outline-none text-sm text-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto scrollbar-thin py-2">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
              <p className="text-sm">Searching...</p>
            </div>
          ) : groupedCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No results found</p>
              {onOpenAva && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAva();
                  }}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AVA for help
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            groupedCommands.map((group) => (
              <div key={group.label}>
                <div
                  className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors',
                        isSelected
                          ? 'bg-muted text-foreground'
                          : 'bg-transparent text-muted-foreground'
                      )}
                    >
                      {cmd.icon && (
                        <span
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-muted text-muted-foreground"
                        >
                          {cmd.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div
                            className="text-xs truncate text-muted-foreground"
                          >
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.isFavorite && (
                        <Star
                          className="h-3.5 w-3.5 flex-shrink-0 text-warning-text fill-warning-text"
                        />
                      )}
                      {cmd.isRecent && (
                        <Clock
                          className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                        />
                      )}
                      {cmd.shortcut && <kbd className="kbd">{cmd.shortcut}</kbd>}
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 flex-shrink-0 transition-opacity text-muted-foreground',
                          isSelected ? 'opacity-50' : 'opacity-0'
                        )}
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
          className="flex items-center justify-between px-4 py-2 text-xs border-t border-border text-muted-foreground bg-muted"
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

export default CommandPalette;
