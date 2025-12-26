import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  LayoutDashboard,
  Building2,
  Server,
  FileText,
  Terminal,
  BarChart3,
  Settings,
  KeyRound,
  Bell,
  Search,
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
  { id: 'audit', label: 'Audit Logs', icon: <FileText size={20} />, path: '/audit' },
  { id: 'terraform', label: 'Terraform', icon: <Terminal size={20} />, path: '/terraform' },
  { id: 'metrics', label: 'Metrics', icon: <BarChart3 size={20} />, path: '/metrics' },
  { id: 'licenses', label: 'Licenses', icon: <KeyRound size={20} />, path: '/licenses' },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
];

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const handleLogout = () => {
    logout();
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: colors.void.deepest }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          transition: 'width 0.2s ease-in-out',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            transition: 'width 0.2s ease-in-out',
            overflowX: 'hidden',
          },
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 1.5,
            minHeight: 64,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#fff',
              fontSize: 16,
            }}
          >
            HW
          </Box>
          {!collapsed && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: colors.text.primary }}>
                HubbleWave
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.muted, fontSize: 11 }}>
                Control Plane
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: colors.glass.border }} />

        {/* Navigation */}
        <List sx={{ flex: 1, px: 1, py: 2 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 2,
                      minHeight: 44,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      px: collapsed ? 1.5 : 2,
                      bgcolor: isActive ? colors.glass.medium : 'transparent',
                      '&:hover': {
                        bgcolor: isActive ? colors.glass.strong : colors.glass.subtle,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 36,
                        color: isActive ? colors.brand.primary : colors.text.tertiary,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: 14,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? colors.text.primary : colors.text.secondary,
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        {/* Collapse button */}
        <Box sx={{ p: 1 }}>
          <IconButton
            onClick={() => setCollapsed(!collapsed)}
            sx={{
              width: '100%',
              borderRadius: 2,
              bgcolor: colors.glass.subtle,
              '&:hover': { bgcolor: colors.glass.medium },
            }}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </IconButton>
        </Box>

        {/* User profile */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderTop: `1px solid ${colors.glass.border}`,
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: colors.brand.glow,
              color: colors.brand.primary,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {getUserInitials()}
          </Avatar>
          {!collapsed && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: colors.text.primary }}>
                {user ? `${user.firstName} ${user.lastName}` : 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.muted, textTransform: 'capitalize' }}>
                {user?.role?.replace('_', ' ') || 'User'}
              </Typography>
            </Box>
          )}
          {!collapsed && (
            <Tooltip title="Logout">
              <IconButton size="small" sx={{ color: colors.text.muted }} onClick={handleLogout}>
                <LogOut size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ gap: 2 }}>
            {/* Search */}
            <Box
              sx={{
                flex: 1,
                maxWidth: 400,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                bgcolor: colors.glass.medium,
                borderRadius: 2,
                border: `1px solid ${colors.glass.border}`,
              }}
            >
              <Search size={16} color={colors.text.muted} />
              <Box
                component="input"
                placeholder="Search customers, instances..."
                sx={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  bgcolor: 'transparent',
                  color: colors.text.primary,
                  fontSize: 14,
                  '&::placeholder': { color: colors.text.muted },
                }}
              />
              <Typography variant="caption" sx={{ color: colors.text.muted, px: 1, py: 0.5, bgcolor: colors.glass.subtle, borderRadius: 1 }}>
                ⌘K
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Actions */}
            <Tooltip title="Notifications">
              <IconButton sx={{ color: colors.text.tertiary }}>
                <Bell size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton sx={{ color: colors.text.tertiary }}>
                <Settings size={20} />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default MainLayout;
