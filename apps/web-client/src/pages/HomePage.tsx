import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';

const MAX_QUICK_LINKS = 6;

export const HomePage: React.FC = () => {
  const { auth } = useAuth();
  const { navigation } = useNavigation();
  const user = auth.user;
  const navigate = useNavigate();
  const quickLinks = useMemo(() => {
    const nodes = navigation?.nodes ?? [];
    if (nodes.length === 0) return [];
    const links: Array<{
      title: string;
      description: string;
      href: string;
      icon: React.FC<{ className?: string }>;
    }> = [];
    const seen = new Set<string>();
    const navigableTypes = new Set(['module', 'link', 'table', 'form', 'report', 'dashboard']);

    const walk = (items: typeof nodes, trail: string[]) => {
      items.forEach((node) => {
        const nextTrail = node.type === 'group' ? [...trail, node.label] : trail;
        if (node.children?.length) {
          walk(node.children, nextTrail);
        }
        if (!navigableTypes.has(node.type)) return;
        const href = node.route || node.url;
        if (!href || links.length >= MAX_QUICK_LINKS || seen.has(href)) return;
        seen.add(href);
        links.push({
          title: node.label,
          description: nextTrail.length ? nextTrail.join(' / ') : 'Open module',
          href,
          icon: LayoutDashboard,
        });
      });
    };

    walk(nodes, []);
    return links;
  }, [navigation]);

  const handleQuickLink = (href: string) => {
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    navigate(href);
  };

  return (
    <div className="min-h-full p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-semibold uppercase tracking-wide text-primary">
              Welcome
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {user?.displayName || user?.email || 'Home'}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Quickly jump to key areas of the workspace or continue where you left off.
              </p>
            </div>
          </div>
        </div>

        {quickLinks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.title}
                  type="button"
                  onClick={() => handleQuickLink(link.href)}
                  className="group text-left w-full rounded-2xl border border-border bg-card hover:border-primary hover:shadow-lg transition-all duration-150 p-5 flex items-start gap-4"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">
                        {link.title}
                      </h2>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {link.description}
                    </p>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
