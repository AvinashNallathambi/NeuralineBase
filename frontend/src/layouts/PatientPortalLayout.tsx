import React, { useState } from 'react';
import { Layout, Menu, Avatar, Space, Dropdown, Button, Typography } from 'antd';
import {
  LogoutOutlined,
  UserOutlined,
  HomeOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  DollarOutlined,
  FileTextOutlined,
  SafetyOutlined,
  MessageOutlined,
  RobotOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import patientAuthService from '../services/patientAuthService';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const PatientPortalLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const patient = patientAuthService.getCurrentPatient();

  const handleLogout = async () => {
    await patientAuthService.logout();
    navigate('/patient/login');
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: 'My Profile',
        onClick: () => navigate('/portal/profile'),
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        onClick: handleLogout,
      },
    ],
  };

  const menuItems = [
    { key: '/portal', icon: <HomeOutlined />, label: 'Dashboard' },
    { key: '/portal/appointments', icon: <CalendarOutlined />, label: 'Appointments' },
    { key: '/portal/messages', icon: <MessageOutlined />, label: 'Messages' },
    { key: '/portal/prescriptions', icon: <MedicineBoxOutlined />, label: 'Prescriptions' },
    { key: '/portal/lab-results', icon: <ExperimentOutlined />, label: 'Lab Results' },
    { key: '/portal/billing', icon: <DollarOutlined />, label: 'Billing & Payments' },
    { key: '/portal/eobs', icon: <FileTextOutlined />, label: 'Insurance EOBs' },
    { key: '/portal/insurance', icon: <SafetyOutlined />, label: 'My Insurance' },
    { key: '/portal/ai-assistant', icon: <RobotOutlined />, label: 'AI Health Assistant' },
  ];

  const selectedKey = menuItems.find((m) => location.pathname === m.key)?.key || '/portal';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        collapsedWidth={80}
        style={{
          background: 'linear-gradient(180deg, #0D7C8A 0%, #064E57 100%)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            padding: collapsed ? '16px 0' : '20px 24px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MedicineBoxOutlined style={{ fontSize: 24, color: '#36CFC9' }} />
            {!collapsed && (
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Neuraline</span>
            )}
          </div>
          {!collapsed && (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>
              Patient Portal
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space size="large">
            <Text type="secondary" style={{ fontSize: 13 }}>
              {patient
                ? `Welcome, ${patient.firstName} ${patient.lastName}`
                : 'Patient Portal'}
            </Text>
            <Dropdown menu={userMenu} trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#0D7C8A' }} icon={<UserOutlined />} />
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: '24px', background: '#f5f7fa', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default PatientPortalLayout;
