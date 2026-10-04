/**
 * SafeCity Theme System
 * Defines light and dark color tokens. Components use `useTheme()` hook
 * instead of importing `Colors` directly for dark-mode compatibility.
 *
 * Semantic names are kept identical between themes so components only
 * need to swap the palette — never change their logic.
 */

export type ColorScheme = 'light' | 'dark';

const shared = {
  primary: '#1d7eeb',
  primaryDark: '#1565c0',
  primaryLight: '#e3f2fd',
  primaryMuted: 'rgba(29, 126, 235, 0.12)',

  // Status / Risk
  safe: '#22c55e',
  safeBg: '#dcfce7',
  safeText: '#15803d',
  moderate: '#f59e0b',
  moderateBg: '#fef3c7',
  moderateText: '#b45309',
  highRisk: '#f97316',
  highRiskBg: '#ffedd5',
  highRiskText: '#c2410c',
  critical: '#ef4444',
  criticalBg: '#fee2e2',
  criticalText: '#b91c1c',
  error: '#ef4444',
  warning: '#f59e0b',
  alert: '#ef4444',
  alertLight: 'rgba(239, 68, 68, 0.15)',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  safeLight: 'rgba(34, 197, 94, 0.15)',
  secondary: '#6366f1',

  // SOS
  sosRed: '#dc2626',
  sosRedLight: '#ef4444',

  // Dark header accent (same in both modes — it's a brand color)
  darkHeader: '#0f172a',
  darkCard: '#1e293b',
};

export const LightTheme = {
  ...shared,
  scheme: 'light' as ColorScheme,

  background: '#f8fafc',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceSecondary: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  textLight: '#ffffff',

  cardShadowColor: '#000000',
  cardShadowOpacity: 0.06,
  statusBarStyle: 'dark' as 'light' | 'dark' | 'auto',
  statusBarBg: '#ffffff',
  tabBarBg: '#ffffff',
  headerBg: '#0f172a',
  headerText: '#ffffff',
};

export const DarkTheme = {
  ...shared,
  scheme: 'dark' as ColorScheme,

  background: '#0f172a',
  surface: '#1e293b',
  surfaceElevated: '#263348',
  surfaceSecondary: '#1a2744',
  border: '#334155',
  borderLight: '#1e293b',

  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textLight: '#ffffff',

  cardShadowColor: '#000000',
  cardShadowOpacity: 0.3,
  statusBarStyle: 'light' as 'light' | 'dark' | 'auto',
  statusBarBg: '#0f172a',
  tabBarBg: '#1e293b',
  headerBg: '#0f172a',
  headerText: '#ffffff',

  // Dark mode overrides for status backgrounds
  safeBg: 'rgba(34, 197, 94, 0.15)',
  safeText: '#4ade80',
  moderateBg: 'rgba(245, 158, 11, 0.15)',
  moderateText: '#fbbf24',
  highRiskBg: 'rgba(249, 115, 22, 0.15)',
  highRiskText: '#fb923c',
  criticalBg: 'rgba(239, 68, 68, 0.15)',
  criticalText: '#f87171',
  primaryLight: 'rgba(29, 126, 235, 0.2)',
  primaryMuted: 'rgba(29, 126, 235, 0.15)',
};

export type AppTheme = typeof LightTheme;

// Legacy shim — components that still import Colors directly still work
// but new components should prefer useTheme()
export const Colors = LightTheme;
