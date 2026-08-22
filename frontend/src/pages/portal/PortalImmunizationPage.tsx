import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Tag,
  Spin,
  Empty,
  Space,
  Table,
  Button,
} from 'antd';
import { MedicineBoxOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { immunizationService } from '../../services/immunizationService';
import type { Immunization } from '../../services/immunizationService';

const { Title, Text } = Typography;

const PortalImmunizationPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);

  useEffect(() => {
    loadImmunizations();
  }, []);

  const loadImmunizations = async () => {
    setLoading(true);
    try {
      const data = await immunizationService.portalGetMyImmunizations();
      setImmunizations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const sourceLabels: Record<string, string> = {
    administered: 'Administered',
    historical: 'Historical',
    registry: 'Registry',
    patient_reported: 'Patient Reported',
  };
  const sourceColors: Record<string, string> = {
    administered: 'green',
    historical: 'blue',
    registry: 'purple',
    patient_reported: 'orange',
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <MedicineBoxOutlined /> My Immunizations
        </Title>
        {immunizations.length > 0 && (
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            Print Record
          </Button>
        )}
      </div>

      {immunizations.length === 0 ? (
        <Card>
          <Empty description="No immunization records available. Your immunization history will appear here once your provider records it." />
        </Card>
      ) : (
        <Card size="small">
          <Table<Immunization>
            dataSource={immunizations}
            rowKey="id"
            pagination={false}
            size="middle"
            columns={[
              {
                title: 'Vaccine',
                key: 'vaccine',
                render: (_, r) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{r.vaccineName}</Text>
                    {r.cvxCode && <Text type="secondary" style={{ fontSize: 12 }}>CVX: {r.cvxCode}</Text>}
                  </Space>
                ),
              },
              {
                title: 'Date',
                dataIndex: 'administeredDate',
                key: 'date',
                render: (d: string) => dayjs(d).format('MM/DD/YYYY'),
                sorter: (a, b) => dayjs(a.administeredDate).valueOf() - dayjs(b.administeredDate).valueOf(),
                defaultSortOrder: 'descend',
              },
              {
                title: 'Dose',
                key: 'dose',
                render: (_, r) => (
                  <Space direction="vertical" size={0}>
                    {r.doseNumber && <Text>Dose #{r.doseNumber}</Text>}
                    {r.doseAmount && <Text type="secondary" style={{ fontSize: 12 }}>{r.doseAmount} {r.doseUnit || ''}</Text>}
                  </Space>
                ),
              },
              {
                title: 'Route / Site',
                key: 'routeSite',
                render: (_, r) => (
                  <Space direction="vertical" size={0}>
                    {r.route && <Text style={{ textTransform: 'capitalize' }}>{r.route}</Text>}
                    {r.site && <Text type="secondary" style={{ fontSize: 12 }}>{r.site}</Text>}
                  </Space>
                ),
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                render: (s: string) => <Tag color={sourceColors[s]}>{sourceLabels[s] || s}</Tag>,
              },
              {
                title: 'Provider',
                key: 'provider',
                render: (_, r) => (
                  <Space direction="vertical" size={0}>
                    {r.providerName && <Text style={{ fontSize: 12 }}>{r.providerName}</Text>}
                    {r.facilityName && <Text type="secondary" style={{ fontSize: 12 }}>{r.facilityName}</Text>}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
};

export default PortalImmunizationPage;
