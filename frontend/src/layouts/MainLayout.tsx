import React, { useEffect, useState } from 'react';
import {
  Layout,
  Menu,
  Input,
  Badge,
  Avatar,
  Dropdown,
  Space,
  Typography,
} from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  CalendarOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  DollarOutlined,
  SafetyOutlined,
  SafetyCertificateOutlined,
  FileDoneOutlined,
  CloseCircleOutlined,
  VideoCameraOutlined,
  BarChartOutlined,
  SettingOutlined,
  ApartmentOutlined,
  ScheduleOutlined,
  RobotOutlined,
  BellOutlined,
  SearchOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ToolOutlined,
  GavelOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore, useAuthStore } from '../store';
import logo from '../assets/logo.png';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 80;
const HEADER_HEIGHT = 64;
const MOBILE_BREAKPOINT = 768;

const menuItems = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  {
    key: 'schedule',
    icon: <CalendarOutlined />,
    label: 'Schedule',
    children: [
      { key: 'appointments', icon: <CalendarOutlined />, label: 'Appointments' },
      { key: 'provider-availability', icon: <ScheduleOutlined />, label: 'Provider Availability' },
      { key: 'telemedicine', icon: <VideoCameraOutlined />, label: 'Telemedicine' },
    ],
  },
  {
    key: 'patients',
    icon: <TeamOutlined />,
    label: 'Patients',
    children: [
      { key: 'patients', icon: <TeamOutlined />, label: 'Patient List' },
      { key: 'patient-groups', icon: <ApartmentOutlined />, label: 'Patient Groups' },
      { key: 'clinical', icon: <FileTextOutlined />, label: 'Clinical' },
      { key: 'clinical/documentation-sessions', icon: <FileTextOutlined />, label: 'Documentation Sessions' },
      { key: 'prescriptions', icon: <MedicineBoxOutlined />, label: 'Prescriptions' },
      { key: 'epcs', icon: <SafetyCertificateOutlined />, label: 'EPCS' },
      { key: 'laboratory', icon: <ExperimentOutlined />, label: 'Laboratory' },
      { key: 'ai-encounter', icon: <RobotOutlined />, label: 'AI Encounter' },
    ],
  },
  {
    key: 'billing',
    icon: <DollarOutlined />,
    label: 'Billing',
    children: [
      { key: 'billing', icon: <DollarOutlined />, label: 'Claims' },
      { key: 'remittance', icon: <FileTextOutlined />, label: 'Remittance (ERA/EOB)' },
      { key: 'denials', icon: <CloseCircleOutlined />, label: 'Denial Analysis' },
      { key: 'appeals', icon: <RobotOutlined />, label: 'Appeals (AI)' },
      { key: 'underpayments', icon: <DollarOutlined />, label: 'Underpayments' },
      { key: 'automation', icon: <RobotOutlined />, label: 'RCM Automation (AI)' },
      { key: 'eligibility', icon: <SafetyOutlined />, label: 'Eligibility' },
      { key: 'superbills', icon: <FileDoneOutlined />, label: 'Superbills' },
    ],
  },
  { key: 'reports', icon: <BarChartOutlined />, label: 'Reports' },
  { key: 'quality-measures', icon: <SafetyCertificateOutlined />, label: 'Quality Measures' },
  { key: 'nsa', icon: <GavelOutlined />, label: 'NSA Compliance' },
  { key: 'workflow', icon: <ApartmentOutlined />, label: 'Workflows' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  {
    key: 'admin',
    icon: <ToolOutlined />,
    label: 'Admin',
    children: [
      { key: 'admin/trials', icon: <TeamOutlined />, label: 'Trial Requests' },
    ],
  },
];

// Flatten the menu tree into all selectable (leaf) keys. Menu item keys are
// absolute route paths (e.g. 'clinical/documentation-sessions' maps to
// '/clinical/documentation-sessions'), so we do NOT prepend the parent key.
const collectLeafKeys = (items: typeof menuItems): string[] => {
  const keys: string[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      keys.push(...collectLeafKeys(item.children));
    } else {
      keys.push(item.key);
    }
  }
  return keys;
};

const allLeafKeys = collectLeafKeys(menuItems);

// Given the current pathname, find the menu key that best matches.
// Prefers an exact match (e.g. '/clinical/documentation-sessions' →
// 'clinical/documentation-sessions'), then falls back to the first path
// segment (e.g. '/clinical/123' → 'clinical') so detail pages still
// highlight their parent section.
const resolveSelectedKey = (pathname: string): string => {
  const stripped = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  // Exact match against a known leaf key
  if (allLeafKeys.includes(stripped)) {
    return stripped;
  }
  // Longest prefix match: '/clinical/documentation-sessions/xyz' →
  // 'clinical/documentation-sessions'
  const prefixMatch = allLeafKeys
    .filter((k) => stripped === k || stripped.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (prefixMatch) {
    return prefixMatch;
  }
  // Fall back to the first path segment (handles '/clinical/:id', '/patients/:id')
  return stripped.split('/')[0] || 'dashboard';
};

// Compute the set of parent menu keys that should be expanded so the selected
// item is visible. For 'clinical/documentation-sessions' this opens 'patients'.
const resolveOpenKeys = (selectedKey: string): string[] => {
  const firstSegment = selectedKey.split('/')[0];
  const openKeys: string[] = [];
  const contains = (children: typeof menuItems, target: string): boolean =>
    children.some(
      (c) => c.key === target || (c.children ? contains(c.children, target) : false),
    );
  for (const item of menuItems) {
    if (item.children && (contains(item.children, selectedKey) || contains(item.children, firstSegment))) {
      openKeys.push(item.key);
    }
  }
  return openKeys;
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, unreadCount } = useAppStore();
  const { user, logout } = useAuthStore();
  const [isMobile, setIsMobile] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    resolveOpenKeys(resolveSelectedKey(location.pathname)),
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile && !sidebarCollapsed) {
        toggleSidebar();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedKey = resolveSelectedKey(location.pathname);

  // When the route changes, ensure the selected item's parent submenu is open
  // (so direct navigation to a nested path reveals the item). We only ADD — we
  // never force-close submenus the user has manually opened. The user can still
  // collapse any submenu via onOpenChange afterwards.
  useEffect(() => {
    const required = resolveOpenKeys(selectedKey);
    setOpenKeys((prev) => {
      const merged = Array.from(new Set([...prev, ...required]));
      // Avoid unnecessary state update
      return merged.length === prev.length && merged.every((k) => prev.includes(k))
        ? prev
        : merged;
    });
  }, [selectedKey]);

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  const handleMenuClick = (info: { key: string }) => {
    navigate(`/${info.key}`);
    if (isMobile) {
      toggleSidebar();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar overlay for mobile */}
      {isMobile && !sidebarCollapsed && (
        <div
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            zIndex: 999,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={SIDEBAR_WIDTH}
        collapsedWidth={isMobile ? 0 : SIDEBAR_COLLAPSED_WIDTH}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          background: '#001529',
          transition: 'all 0.2s',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: HEADER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: sidebarCollapsed ? '16px 8px' : '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            transition: 'all 0.2s',
          }}
        >
          <img
            src={logo}
            alt="Neuraline"
            style={{
              height: sidebarCollapsed ? 32 : 36,
              width: 'auto',
              objectFit: 'contain',
              transition: 'all 0.2s',
            }}
          />
          {!sidebarCollapsed && (
            <Text
              strong
              style={{
                color: '#ffffff',
                fontSize: 18,
                marginLeft: 12,
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
              }}
            >
              Neuraline
            </Text>
          )}
        </div>

        {/* Navigation Menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          items={user?.role === 'super_admin' ? menuItems : menuItems.filter((item) => item.key !== 'admin')}
          onClick={handleMenuClick}
          style={{
            borderRight: 0,
            marginTop: 8,
          }}
        />
      </Sider>

      <Layout
        style={{
          marginLeft: isMobile
            ? 0
            : sidebarCollapsed
            ? SIDEBAR_COLLAPSED_WIDTH
            : SIDEBAR_WIDTH,
          transition: 'margin-left 0.2s',
        }}
      >
        {/* Header */}
        <Header
          style={{
            padding: '0 24px',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: HEADER_HEIGHT,
            lineHeight: `${HEADER_HEIGHT}px`,
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Space size={16} align="center">
            {/* Sidebar toggle */}
            <div
              onClick={toggleSidebar}
              style={{
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                color: '#1a2b3c',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = '#f5f5f5')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              {sidebarCollapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )}
            </div>

            {/* Search bar */}
            <Input
              placeholder="Search patients, records..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{
                width: isMobile ? 160 : 300,
                borderRadius: 8,
                background: '#f5f7fa',
                border: '1px solid #e8e8e8',
              }}
              allowClear
            />
          </Space>

          <Space size={20} align="center">
            {/* Notifications */}
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
              <BellOutlined
                style={{
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 8,
                  borderRadius: 8,
                  transition: 'all 0.2s',
                }}
                onClick={() => navigate('/notifications')}
              />
            </Badge>

            {/* User avatar dropdown */}
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Space
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 8,
                  transition: 'background 0.2s',
                }}
              >
                <Avatar
                  size={36}
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: '#0D7C8A',
                    cursor: 'pointer',
                  }}
                  src={user?.avatar}
                />
                {!isMobile && (
                  <div style={{ lineHeight: '1.2' }}>
                    <Text
                      strong
                      style={{ fontSize: 13, display: 'block' }}
                    >
                      {user?.firstName
                        ? `${user.firstName} ${user.lastName}`
                        : 'User'}
                    </Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: 11, display: 'block' }}
                    >
                      {user?.role || 'Healthcare Provider'}
                    </Text>
                  </div>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Main Content */}
        <Content
          style={{
            margin: 24,
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px - 48px)`,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
