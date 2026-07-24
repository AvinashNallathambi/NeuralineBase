import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  DatePicker,
  Typography,
  message,
  Input,
  Row,
  Col,
} from 'antd';
import { ReloadOutlined, EyeOutlined, PlayCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { documentationService, DocumentationSession } from '../../services/documentationService';
import { patientService } from '../../services/patientService';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const statusColors: Record<string, string> = {
  draft: 'default',
  transcribed: 'blue',
  note_generated: 'cyan',
  reviewed: 'gold',
  signed: 'green',
  cancelled: 'red',
};

const DocumentationSessionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<DocumentationSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [patientMap, setPatientMap] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<{ status?: string; patientId?: string }>({});

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentationService.list({
        ...filters,
        page,
        limit,
      });
      setSessions(res.data.data);
      setTotal(res.data.total);

      // Fetch patient names for the sessions
      const patientIds = [...new Set(res.data.data.map((s) => s.patientId))];
      const map: Record<string, string> = {};
      for (const pid of patientIds) {
        try {
          const p = await patientService.findOne(pid);
          map[pid] = `${p.firstName} ${p.lastName}`;
        } catch {
          map[pid] = 'Unknown';
        }
      }
      setPatientMap(map);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load documentation sessions');
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const columns: ColumnsType<DocumentationSession> = [
    {
      title: 'Patient',
      key: 'patient',
      render: (_, r) => patientMap[r.patientId] || r.patientId.slice(0, 8),
    },
    {
      title: 'Provider',
      key: 'provider',
      render: (_, r) => r.providerId.slice(0, 8),
    },
    {
      title: 'Encounter',
      key: 'encounter',
      render: (_, r) =>
        r.encounterId ? (
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => navigate(`/clinical/${r.encounterId}?tab=documentation`)}
          >
            {r.encounterId.slice(0, 8)}
          </Button>
        ) : (
          '—'
        ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => <Tag color={statusColors[r.status]}>{r.status}</Tag>,
      width: 120,
    },
    {
      title: 'Consent',
      key: 'consent',
      render: (_, r) => (
        <Tag color={r.consentStatus === 'granted' ? 'green' : r.consentStatus === 'pending' ? 'orange' : 'default'}>
          {r.consentStatus}
        </Tag>
      ),
      width: 120,
    },
    {
      title: 'Created',
      key: 'created',
      render: (_, r) => (r.createdAt ? dayjs(r.createdAt).format('MMM D, YYYY HH:mm') : '—'),
      width: 160,
    },
    {
      title: 'Signed',
      key: 'signed',
      render: (_, r) => (r.signedAt ? dayjs(r.signedAt).format('MMM D, YYYY HH:mm') : '—'),
      width: 160,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, r) => {
        const isActive = !['signed', 'cancelled'].includes(r.status);
        return (
          <Button
            type="primary"
            size="small"
            ghost
            icon={isActive ? <PlayCircleOutlined /> : <EyeOutlined />}
            disabled={!r.encounterId}
            onClick={() => navigate(`/clinical/${r.encounterId}?tab=documentation`)}
          >
            {isActive ? 'Resume' : 'View'}
          </Button>
        );
      },
    },
  ];

  return (
    <div >
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={5} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8, color: '#0D7C8A' }} />
            Documentation Sessions
          </Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchSessions} loading={loading}>
            Refresh
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={8}>
            <Input.Search
              placeholder="Search by patient ID"
              allowClear
              onSearch={(v) => {
                setFilters({ ...filters, patientId: v || undefined });
                setPage(1);
              }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select
              placeholder="Filter by status"
              allowClear
              style={{ width: '100%' }}
              onChange={(v) => {
                setFilters({ ...filters, status: v });
                setPage(1);
              }}
            >
              <Select.Option value="draft">Draft</Select.Option>
              <Select.Option value="transcribed">Transcribed</Select.Option>
              <Select.Option value="note_generated">Note Generated</Select.Option>
              <Select.Option value="reviewed">Reviewed</Select.Option>
              <Select.Option value="signed">Signed</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={sessions}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          showTotal: (t) => `${t} session${t !== 1 ? 's' : ''}`,
          onChange: (p, ps) => {
            setPage(p);
            setLimit(ps);
          },
        }}
      />
    </div>
  );
};

export default DocumentationSessionListPage;
