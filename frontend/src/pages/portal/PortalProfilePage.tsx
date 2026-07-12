import React, { useEffect, useState } from 'react';
import { Card, Typography, Descriptions, Spin, Tag, Row, Col, Avatar } from 'antd';
import { UserOutlined, IdcardOutlined, MailOutlined, PhoneOutlined, EnvironmentOutlined } from '@ant-design/icons';
import patientAuthService from '../../services/patientAuthService';

const { Title, Text } = Typography;

const PortalProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await patientAuthService.getMe();
      setPatient(data);
    } catch {
      // Fallback to cached user
      setPatient(patientAuthService.getCurrentPatient());
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!patient) {
    return <Card><Text type="secondary">Unable to load profile</Text></Card>;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <UserOutlined /> My Profile
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar size={72} style={{ backgroundColor: '#0D7C8A' }} icon={<UserOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {patient.firstName} {patient.lastName}
            </Title>
            <Space>
              {patient.mrn && <Tag>MRN: {patient.mrn}</Tag>}
              <Tag color={patient.status === 'active' ? 'green' : 'default'}>{patient.status}</Tag>
            </Space>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Demographics" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Date of Birth">
                {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Gender">{patient.gender || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Blood Type">{patient.bloodType || 'N/A'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Contact Information" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Email">
                <MailOutlined /> {patient.email || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                <PhoneOutlined /> {patient.phone || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Address">
                {patient.address ? (
                  <span>
                    <EnvironmentOutlined /> {patient.address.street1}
                    {patient.address.street2 ? `, ${patient.address.street2}` : ''}
                    <br />
                    {patient.address.city}, {patient.address.state} {patient.address.zipCode}
                  </span>
                ) : 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Emergency Contact" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Name">
                {patient.emergencyContact?.name || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Relationship">
                {patient.emergencyContact?.relationship || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {patient.emergencyContact?.phone || 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Portal Account" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Portal Status">
                <Tag color={patient.portalActive ? 'green' : 'default'}>
                  {patient.portalActive ? 'Active' : 'Not Activated'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Last Login">
                {patient.lastLoginAt ? new Date(patient.lastLoginAt).toLocaleString() : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Member Since">
                {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PortalProfilePage;
