import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Input,
  Statistic,
  Select,
  Button,
  Tooltip,
  Badge,
  Spin,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  ScheduleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useProviderStore } from '../../store/dataStore';
import { providerAvailabilityService } from '../../services/providerAvailabilityService';
import type { User, ProviderAvailability, ProviderAvailabilityOverride } from '../../types';

const { Title } = Typography;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const specialtyColors: Record<string, string> = {
  'Internal Medicine': 'blue',
  'Cardiology': 'red',
  'Pediatrics': 'green',
  'Orthopedics': 'orange',
  'Primary Care': 'cyan',
};

interface ProviderRow {
  key: string;
  provider: User;
  weeklyHours: number;
  activeDays: string;
  slotDuration: number;
  upcomingOverrides: number;
  nextTimeOff: string | null;
}

const ProviderAvailabilityPage: React.FC = () => {
  const navigate = useNavigate();
  const { providers } = useProviderStore();
  const [schedules, setSchedules] = useState<ProviderAvailability[]>([]);
  const [overrides, setOverrides] = useState<ProviderAvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [availability, overrideList] = await Promise.all([
          providerAvailabilityService.findAllAvailability(),
          providerAvailabilityService.findAllOverrides(),
        ]);
        setSchedules(availability);
        setOverrides(overrideList);
      } catch (err) {
        setError('Failed to load availability data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const providerRows = useMemo<ProviderRow[]>(() => {
    let filtered = providers;

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          (p.specialization || '').toLowerCase().includes(q) ||
          (p.department || '').toLowerCase().includes(q)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((p) => p.role === roleFilter);
    }

    return filtered.map((provider) => {
      const providerSchedules = schedules.filter(
        (s) => s.providerId === provider.id && s.isAvailable
      );
      const providerOverrides = overrides.filter(
        (o) => o.providerId === provider.id && new Date(o.overrideDate) >= new Date()
      );

      const weeklyHours = providerSchedules.reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        return sum + (eh + em / 60 - (sh + sm / 60));
      }, 0);

      const activeDaySet = new Set(providerSchedules.map((s) => s.dayOfWeek));
      const activeDays = Array.from(activeDaySet)
        .sort()
        .map((d) => DAY_NAMES[d])
        .join(', ');

      const slotDurations = providerSchedules.map((s) => s.slotDuration);
      const slotDuration = slotDurations.length > 0 ? slotDurations[0] : 0;

      const timeOffOverrides = providerOverrides
        .filter((o) => o.overrideType === 'time_off' || o.overrideType === 'holiday')
        .sort((a, b) => a.overrideDate.localeCompare(b.overrideDate));
      const nextTimeOff = timeOffOverrides.length > 0 ? timeOffOverrides[0].overrideDate : null;

      return {
        key: provider.id,
        provider,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        activeDays,
        slotDuration,
        upcomingOverrides: providerOverrides.length,
        nextTimeOff,
      };
    });
  }, [providers, schedules, overrides, searchText, roleFilter]);

  const totalProviders = providers.length;
  const doctorCount = providers.filter((p) => p.role === 'doctor').length;
  const totalWeeklyHours = providerRows.reduce((sum, r) => sum + r.weeklyHours, 0);
  const upcomingTimeOffs = overrides.filter(
    (o) =>
      (o.overrideType === 'time_off' || o.overrideType === 'holiday') &&
      new Date(o.overrideDate) >= new Date()
  ).length;

  const columns: ColumnsType<ProviderRow> = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: User) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0D7C8A' }}>
            {provider.firstName} {provider.lastName}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {provider.specialization || provider.department || provider.role}
          </div>
        </div>
      ),
      sorter: (a, b) =>
        `${a.provider.lastName}`.localeCompare(`${b.provider.lastName}`),
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, row) => (
        <Tag color={row.provider.role === 'doctor' ? 'blue' : 'green'}>
          {row.provider.role.charAt(0).toUpperCase() + row.provider.role.slice(1)}
        </Tag>
      ),
      filters: [
        { text: 'Doctor', value: 'doctor' },
        { text: 'Nurse', value: 'nurse' },
      ],
      onFilter: (value, record) => record.provider.role === value,
    },
    {
      title: 'Specialty',
      key: 'specialty',
      render: (_, row) => {
        const spec = row.provider.specialization;
        return spec ? (
          <Tag color={specialtyColors[spec] || 'default'}>{spec}</Tag>
        ) : (
          <span style={{ color: '#999' }}>—</span>
        );
      },
    },
    {
      title: 'Schedule',
      key: 'schedule',
      render: (_, row) => (
        <div>
          <div style={{ fontSize: 13 }}>
            <strong>{row.activeDays || 'No schedule'}</strong>
          </div>
          {row.slotDuration > 0 && (
            <div style={{ fontSize: 12, color: '#666' }}>
              {row.slotDuration}-min slots
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Weekly Hours',
      dataIndex: 'weeklyHours',
      key: 'weeklyHours',
      render: (hours: number) => (
        <span style={{ fontWeight: 500 }}>{hours}h</span>
      ),
      sorter: (a, b) => a.weeklyHours - b.weeklyHours,
    },
    {
      title: 'Upcoming Overrides',
      key: 'overrides',
      render: (_, row) =>
        row.upcomingOverrides > 0 ? (
          <Badge count={row.upcomingOverrides} style={{ backgroundColor: '#faad14' }} />
        ) : (
          <span style={{ color: '#999' }}>None</span>
        ),
      sorter: (a, b) => a.upcomingOverrides - b.upcomingOverrides,
    },
    {
      title: 'Next Time Off',
      key: 'nextTimeOff',
      render: (_, row) =>
        row.nextTimeOff ? (
          <Tag color="volcano">{row.nextTimeOff}</Tag>
        ) : (
          <span style={{ color: '#999' }}>—</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, row) => (
        <Tooltip title="View Schedule">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/provider-availability/${row.provider.id}`);
            }}
            style={{ color: '#0D7C8A' }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div >
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ScheduleOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
            Provider Availability
          </Title>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Providers"
              value={totalProviders}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#0D7C8A' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Physicians"
              value={doctorCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Weekly Hours"
              value={totalWeeklyHours}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Upcoming Time Off"
              value={upcomingTimeOffs}
              prefix={<StopOutlined />}
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {error && (
          <Alert message={error} type="error" style={{ marginBottom: 16 }} showIcon />
        )}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search providers..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: '100%' }}
              options={[
                { label: 'All Roles', value: 'all' },
                { label: 'Doctors', value: 'doctor' },
                { label: 'Nurses', value: 'nurse' },
              ]}
            />
          </Col>
        </Row>

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={providerRows}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            onRow={(row) => ({
              onClick: () => navigate(`/provider-availability/${row.provider.id}`),
              style: { cursor: 'pointer' },
            })}
            scroll={{ x: 900 }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default ProviderAvailabilityPage;
