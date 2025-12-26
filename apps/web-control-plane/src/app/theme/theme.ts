import { createTheme, alpha } from '@mui/material/styles';

// Control Plane Dark Theme - Glassmorphic Design
// Based on the prototype design system

export const colors = {
  // Void colors (dark backgrounds)
  void: {
    deepest: '#000000',
    deep: '#0a0a0f',
    base: '#12121a',
    subtle: '#1a1a24',
  },
  // Glass colors (transparent overlays)
  glass: {
    subtle: 'rgba(255,255,255,0.03)',
    medium: 'rgba(255,255,255,0.06)',
    strong: 'rgba(255,255,255,0.1)',
    border: 'rgba(255,255,255,0.08)',
  },
  // Brand colors
  brand: {
    primary: '#818cf8', // indigo-400
    secondary: '#6366f1', // indigo-500
    glow: 'rgba(129,140,248,0.15)',
  },
  // Text colors
  text: {
    primary: '#f9fafb',
    secondary: '#d1d5db',
    tertiary: '#9ca3af',
    muted: '#6b7280',
  },
  // Status colors
  success: {
    base: '#22c55e',
    glow: 'rgba(34,197,94,0.15)',
  },
  warning: {
    base: '#eab308',
    glow: 'rgba(234,179,8,0.15)',
  },
  danger: {
    base: '#ef4444',
    glow: 'rgba(239,68,68,0.15)',
  },
  info: {
    base: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
  },
  cyan: {
    base: '#22d3ee',
    glow: 'rgba(34,211,238,0.15)',
  },
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.brand.primary,
      light: '#a5b4fc',
      dark: '#6366f1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: colors.cyan.base,
      light: '#67e8f9',
      dark: '#06b6d4',
    },
    background: {
      default: colors.void.deepest,
      paper: colors.void.base,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.muted,
    },
    success: {
      main: colors.success.base,
      light: '#4ade80',
      dark: '#16a34a',
    },
    warning: {
      main: colors.warning.base,
      light: '#facc15',
      dark: '#ca8a04',
    },
    error: {
      main: colors.danger.base,
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      main: colors.info.base,
      light: '#60a5fa',
      dark: '#2563eb',
    },
    divider: colors.glass.border,
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: {
      fontSize: '2rem',
      fontWeight: 700,
      color: colors.text.primary,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: colors.text.primary,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: colors.text.primary,
    },
    h4: {
      fontSize: '1rem',
      fontWeight: 600,
      color: colors.text.primary,
    },
    body1: {
      fontSize: '0.875rem',
      color: colors.text.secondary,
    },
    body2: {
      fontSize: '0.8125rem',
      color: colors.text.tertiary,
    },
    caption: {
      fontSize: '0.75rem',
      color: colors.text.muted,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.void.deepest,
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.glass.medium} ${colors.void.deep}`,
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: colors.void.deep,
          },
          '&::-webkit-scrollbar-thumb': {
            background: colors.glass.medium,
            borderRadius: '4px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: colors.void.base,
          borderRadius: 16,
          border: `1px solid ${colors.glass.border}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: colors.void.base,
          borderRadius: 16,
          border: `1px solid ${colors.glass.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '10px 20px',
        },
        contained: {
          background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
          '&:hover': {
            background: `linear-gradient(135deg, ${alpha(colors.brand.primary, 0.9)}, ${alpha(colors.brand.secondary, 0.9)})`,
          },
        },
        outlined: {
          borderColor: colors.glass.border,
          '&:hover': {
            backgroundColor: colors.glass.subtle,
            borderColor: colors.glass.strong,
          },
        },
        text: {
          '&:hover': {
            backgroundColor: colors.glass.subtle,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: colors.glass.medium,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: colors.glass.medium,
            borderRadius: 10,
            '& fieldset': {
              borderColor: colors.glass.border,
            },
            '&:hover fieldset': {
              borderColor: colors.glass.strong,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.brand.primary,
            },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: colors.glass.border,
        },
        head: {
          backgroundColor: colors.glass.subtle,
          color: colors.text.tertiary,
          fontWeight: 600,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minWidth: 'auto',
          padding: '12px 16px',
          '&.Mui-selected': {
            fontWeight: 600,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.void.deep,
          borderRight: `1px solid ${colors.glass.border}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.void.deep,
          borderBottom: `1px solid ${colors.glass.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.void.base,
          border: `1px solid ${colors.glass.border}`,
          borderRadius: 8,
          fontSize: '0.75rem',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.void.deep,
          borderRadius: 20,
          border: `1px solid ${colors.glass.border}`,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
        },
        switchBase: {
          padding: 0,
          margin: 2,
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
              backgroundColor: colors.brand.primary,
              opacity: 1,
            },
          },
        },
        thumb: {
          boxSizing: 'border-box',
          width: 22,
          height: 22,
        },
        track: {
          borderRadius: 13,
          backgroundColor: colors.glass.strong,
          opacity: 1,
        },
      },
    },
  },
});

export default theme;
