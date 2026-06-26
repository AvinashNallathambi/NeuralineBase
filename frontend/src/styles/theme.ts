import type { ThemeConfig } from 'antd';

export const neuralineTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0D7C8A',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f5f7fa',
    colorText: '#1a2b3c',
    colorTextSecondary: '#64748b',
  },
  components: {
    Layout: {
      siderBg: '#001529',
      headerBg: '#ffffff',
      bodyBg: '#f5f7fa',
    },
    Menu: {
      darkItemBg: '#001529',
      darkItemSelectedBg: '#0D7C8A',
      darkItemHoverBg: 'rgba(13, 124, 138, 0.3)',
    },
    Button: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Card: {
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    },
    Table: {
      borderRadius: 12,
      headerBg: '#f8fafc',
    },
    Input: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 40,
    },
  },
};

export const chartColors = {
  primary: '#0D7C8A',
  secondary: '#36CFC9',
  tertiary: '#69C0FF',
  quaternary: '#B37FEB',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  gray: '#8c8c8c',
};
