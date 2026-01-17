// Control Plane Dark Theme - Glassmorphic Design
// CSS-compatible color tokens

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
    light: '#4ade80',
    glow: 'rgba(34,197,94,0.15)',
  },
  warning: {
    base: '#eab308',
    light: '#facc15',
    glow: 'rgba(234,179,8,0.15)',
  },
  danger: {
    base: '#ef4444',
    light: '#f87171',
    glow: 'rgba(239,68,68,0.15)',
  },
  info: {
    base: '#3b82f6',
    light: '#60a5fa',
    glow: 'rgba(59,130,246,0.15)',
  },
  cyan: {
    base: '#22d3ee',
    glow: 'rgba(34,211,238,0.15)',
  },
};

export default colors;
