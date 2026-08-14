/**
 * Neuraline Mobile — Paper Theme
 *
 * Maps the Neuraline brand colors to react-native-paper's MD3 theme.
 */
import { DefaultTheme, type MD3Theme } from 'react-native-paper';
import { colors, borderRadius, fontSize } from './tokens';

export const paperTheme: MD3Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.primaryLight,
    secondaryContainer: colors.primaryLight,
    tertiary: colors.info,
    error: colors.error,
    errorContainer: '#fff0f0',
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: '#f8fafc',
    outline: colors.border,
    outlineVariant: colors.divider,
    onPrimary: '#ffffff',
    onPrimaryContainer: colors.primaryDark,
    onSecondary: '#ffffff',
    onSecondaryContainer: colors.primaryDark,
    onTertiary: '#ffffff',
    onError: '#ffffff',
    onErrorContainer: colors.error,
    onBackground: colors.text,
    onSurface: colors.text,
    onSurfaceVariant: colors.textSecondary,
  },
  roundness: borderRadius.md,
  fonts: {
    ...DefaultTheme.fonts,
    // Inter is loaded via the native font system; falls back to system sans-serif
  },
};

export { colors, spacing, borderRadius, fontSize, chartColors } from './tokens';
