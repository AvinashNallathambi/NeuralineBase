/**
 * Neuraline Mobile — Design Tokens
 *
 * Mirrors the web app's Ant Design theme (frontend/src/styles/theme.ts).
 * Brand color: #0D7C8A (teal)
 */
import { type MD3Theme } from 'react-native-paper';

export const colors = {
  primary: '#0D7C8A',
  primaryDark: '#064E57',
  primaryLight: '#36CFC9',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1890ff',
  background: '#f5f7fa',
  surface: '#ffffff',
  text: '#1a2b3c',
  textSecondary: '#64748b',
  sidebar: '#001529',
  sidebarActive: '#0D7C8A',
  sidebarHover: 'rgba(13, 124, 138, 0.3)',
  border: '#e2e8f0',
  divider: '#f1f5f9',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  title: 32,
} as const;

export const chartColors = {
  primary: '#0D7C8A',
  secondary: '#36CFC9',
  tertiary: '#69C0FF',
  quaternary: '#B37FEB',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  gray: '#8c8c8c',
} as const;
