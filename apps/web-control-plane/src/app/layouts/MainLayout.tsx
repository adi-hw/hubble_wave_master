import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Server,
  Package,
  FileText,
  Terminal,
  BarChart3,
  Settings,
  KeyRound,
  Bell,
  Search,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';

const DRAWER_WIDTH = 240;
const DRAWER_COLLAPSED_WIDTH = 72;

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
  { id: 'customers', label: 'Customers', icon: <Building2 size={20} />, path: '/customers' },
  { id: 'instances', label: 'Instances', icon: <Server size={20} />, path: '/instances' },
  { id: 'packs', label: 'Packs', icon: <Package size={20} />, path: '/packs' },
  { id: 'audit', label: 'Audit Logs', icon: <FileText size={20} />, path: '/audit' },
  { id: 'terraform', label: 'Terraform', icon: <Terminal size={20} />, path: '/terraform' },
  { id: 'metrics', label: 'Metrics', icon: <BarChart3 size={20} />, path: '/metrics' },
  { id: 'licenses', label: 'Licenses', icon: <KeyRound size={20} />, path: '/licenses' },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  { id: 'recovery', label: 'Recovery', icon: <ShieldAlert size={20} />, path: '/recovery' },
];

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const handleLogout = () => {
    logout();
  };

  const handleSearchSubmit = () => {
    const term = search.trim();
    if (!term) return;
    navigate(`/customers?q=${encodeURIComponent(term)}`);
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: colors.void.deepest }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 transition-all duration-200 overflow-hidden"
        style={{
          width: drawerWidth,
          backgroundColor: colors.void.deep,
          borderRight: `1px solid ${colors.glass.border}`,
        }}
      >
        {/* Logo */}
        <div
          className="p-4 flex items-center gap-3"
          style={{ minHeight: 64, justifyContent: collapsed ? 'center' : 'flex-start' }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            HW
          </div>
          {!collapsed && (
            <div>
              <div className="font-bold text-sm" style={{ color: colors.text.primary }}>
                HubbleWave
              </div>
              <div className="text-xs" style={{ color: colors.text.muted }}>
                Control Plane
              </div>
            </div>
          )}
        </div>

        <hr style={{ borderColor: colors.glass.border, margin: 0 }} />

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                className="w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-colors"
                style={{
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  backgroundColor: isActive ? colors.glass.medium : 'transparent',
                  color: isActive ? colors.text.primary : colors.text.secondary,
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.backgroundColor = colors.glass.subtle;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isActive
                    ? colors.glass.medium
                    : 'transparent';
                }}
              >
                <span style={{ color: isActive ? colors.brand.primary : colors.text.tertiary }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span
                    className="text-sm"
                    style={{ fontWeight: isActive ? 600 : 500 }}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse button */}
        <div className="p-2">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 rounded-lg transition-colors"
            style={{ backgroundColor: colors.glass.subtle, color: colors.text.secondary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.glass.medium)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.glass.subtle)}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* User profile */}
        <div
          className="p-4 flex items-center gap-3"
          style={{ borderTop: `1px solid ${colors.glass.border}` }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{
              backgroundColor: colors.brand.glow,
              color: colors.brand.primary,
            }}
          >
            {getUserInitials()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: colors.text.primary }}
                >
                  {user ? `${user.firstName} ${user.lastName}` : 'User'}
                </div>
                <div
                  className="text-xs capitalize truncate"
                  style={{ color: colors.text.muted }}
                >
                  {user?.role?.replace('_', ' ') || 'User'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 rounded transition-colors"
                style={{ color: colors.text.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.glass.medium)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <header
          className="sticky top-0 z-10 flex items-center gap-4 px-6 py-3"
          style={{
            backgroundColor: colors.void.deep,
            borderBottom: `1px solid ${colors.glass.border}`,
          }}
        >
          {/* Search */}
          <div
            className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{
              backgroundColor: colors.glass.medium,
              borderColor: colors.glass.border,
            }}
          >
            <Search size={16} style={{ color: colors.text.muted }} />
            <input
              type="text"
              placeholder="Search customers, instances..."
              className="flex-1 bg-transparent border-none outline-none text-sm"
              style={{ color: colors.text.primary }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
            />
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                color: colors.text.muted,
                backgroundColor: colors.glass.subtle,
              }}
            >
              ⌘K
            </span>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <button
            type="button"
            title="Notifications"
            onClick={() => navigate('/audit')}
            className="p-2 rounded transition-colors"
            style={{ color: colors.text.tertiary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.glass.medium)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Bell size={20} />
          </button>
          <button
            type="button"
            title="Settings"
            onClick={() => navigate('/settings')}
            className="p-2 rounded transition-colors"
            style={{ color: colors.text.tertiary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.glass.medium)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Settings size={20} />
          </button>
        </header>

        {/* Page content */}
        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
