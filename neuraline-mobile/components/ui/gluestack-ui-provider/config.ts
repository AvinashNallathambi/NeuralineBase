import { vars } from 'nativewind';

// Neuraline EMR — Brand Theme
// Primary: #0D7C8A (teal)
// Mirrors the web app's Ant Design theme
export const colors = {
  light: {
    '--primary': '13 124 138',           // #0D7C8A teal
    '--primary-foreground': '255 255 255',
    '--card': '255 255 255',
    '--secondary': '54 207 201',          // #36CFC9 light teal
    '--secondary-foreground': '6 78 87',  // #064E57 dark teal
    '--background': '245 247 250',        // #f5f7fa
    '--popover': '255 255 255',
    '--popover-foreground': '26 43 60',
    '--muted': '241 245 249',             // #f1f5f9
    '--muted-foreground': '100 116 139',  // #64748b
    '--destructive': '255 77 79',         // #ff4d4f
    '--foreground': '26 43 60',           // #1a2b3c
    '--border': '226 232 240',            // #e2e8f0
    '--input': '226 232 240',
    '--ring': '13 124 138',
    '--accent': '13 124 138',
    '--accent-foreground': '255 255 255',
  },
  dark: {
    '--primary': '54 207 201',            // #36CFC9 light teal
    '--primary-foreground': '6 78 87',
    '--card': '23 23 23',
    '--secondary': '38 38 38',
    '--secondary-foreground': '250 250 250',
    '--background': '10 10 10',
    '--popover': '23 23 23',
    '--popover-foreground': '250 250 250',
    '--muted': '38 38 38',
    '--muted-foreground': '161 161 161',
    '--destructive': '255 100 103',
    '--foreground': '250 250 250',
    '--border': '46 46 46',
    '--input': '46 46 46',
    '--accent': '54 207 201',
    '--accent-foreground': '6 78 87',
    '--ring': '54 207 201',
  },
};

// Config for nativewind vars() - used by provider
export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
