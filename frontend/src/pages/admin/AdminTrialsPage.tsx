import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Tag,
  Select,
  Input,
  Modal,
  Form,
  message,
  Popconfirm,
  Typography,
  Descriptions,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { trialService, TrialRequest, TrialRequestStatus, TrialPlanType } from '../../services/trialService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const statusColors: Record<TrialRequestStatus, string> = {
  pending: 'orange',
  approved: 'cyan',
  active: 'green',
  rejected: 'red',
  disabled: 'default',
  converted: 'blue',
  expired: 'volcano',
  wiped: 'purple',
};

const STATUS_OPTIONS: TrialRequestStatus[] = [
  'pending',
  'approved',
  'active',
  'rejected',
  'disabled',
  'converted',
  'expired',
  'wiped',
];

const AdminTrialsPage: React.FC = () => {
  const [requests, setRequests] = useState<TrialRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TrialRequestStatus | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<TrialRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveForm] = Form.useForm();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectForm] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await trialService.getAll(statusFilter);
      setRequests(data);
    } catch (err) {
      message.error('Failed to load trial requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const term = searchText.toLowerCase();
    return requests.filter(
      (r) =>
        !term ||
        r.email.toLowerCase().includes(term) ||
        r.practiceName.toLowerCase().includes(term) ||
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(term),
    );
  }, [requests, searchText]);

  const handleApprove = async (values: { trialDays?: number; notes?: string }) => {
    if (!selected) return;
    try {
      const result = await trialService.approve(selected.id, {
        trialDays: values.trialDays,
        notes: values.notes,
      });
      message.success(`Approved. Temporary password: ${result.password}`);
      setApproveOpen(false);
      approveForm.resetFields();
      setDetailOpen(false);
      setSelected(null);
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const handleReject = async (values: { notes?: string }) => {
    if (!selected) return;
    try {
      await trialService.reject(selected.id, values.notes);
      message.success('Request rejected');
      setRejectOpen(false);
      rejectForm.resetFields();
      setDetailOpen(false);
      setSelected(null);
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Rejection failed');
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await trialService.disable(id);
      message.success('Account disabled');
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Disable failed');
    }
  };

  const handleConvert = async (id: string) => {
    try {
      await trialService.convert(id);
      message.success('Converted to paid');
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Conversion failed');
    }
  };

  const handleWipe = async (id: string) => {
    Modal.confirm({
      title: 'Wipe clinical data?',
      content:
        'This will permanently delete all patients, encounters, billing records, and other PHI for this tenant while keeping the subscription active.',
      okText: 'Wipe & Convert',
      okType: 'danger',
      onOk: async () => {
        try {
          await trialService.wipe(id);
          message.success('Data wiped and subscription converted');
          fetch();
        } catch (err: any) {
          message.error(err.response?.data?.message || 'Wipe failed');
        }
      },
    });
  };

  const openDetail = (record: TrialRequest) => {
    setSelected(record);
    setDetailOpen(true);
  };

  const openApprove = (record: TrialRequest) => {
    setSelected(record);
    approveForm.setFieldsValue({
      trialDays: record.planType === 'enterprise' ? 30 : 14,
    });
    setApproveOpen(true);
  };

  const openReject = (record: TrialRequest) => {
    setSelected(record);
    setRejectOpen(true);
  };

  const columns: ColumnsType<TrialRequest> = [
    {
      title: 'Practice / Contact',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.practiceName}</Text>
          <Text type="secondary">{`${record.firstName} ${record.lastName}`}</Text>
          <Text type="secondary">{record.email}</Text>
        </Space>
      ),
    },
    {
      title: 'Plan',
      dataIndex: 'planType',
      render: (planType: TrialPlanType) => <Tag>{planType}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: TrialRequestStatus) => <Tag color={statusColors[status]}>{status}</Tag>,
    },
    {
      title: 'Trial Ends',
      dataIndex: 'trialEndsAt',
      render: (date: string | null) =>
        date ? dayjs(date).format('MMM D, YYYY') : <Text type="secondary">—</Text>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => openDetail(record)}>
            View
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                size="small"
                onClick={() => openApprove(record)}
              >
                Approve
              </Button>
              <Button icon={<CloseOutlined />} size="small" onClick={() => openReject(record)}>
                Reject
              </Button>
            </>
          )}
          {record.status === 'active' && (
            <>
              <Button icon={<CheckOutlined />} size="small" onClick={() => handleConvert(record.id)}>
                Convert
              </Button>
              <Button icon={<DeleteOutlined />} size="small" onClick={() => handleWipe(record.id)}>
                Wipe
              </Button>
              <Popconfirm
                title="Disable this account?"
                onConfirm={() => handleDisable(record.id)}
              >
                <Button icon={<PauseCircleOutlined />} size="small" danger>
                  Disable
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div >
      <Title level={4}>Trial Requests</Title>
      <Card>
        <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search by practice, name, or email"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              placeholder="Filter status"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
            >
              {STATUS_OPTIONS.map((s) => (
                <Option key={s} value={s}>
                  {s}
                </Option>
              ))}
            </Select>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>
            Refresh
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Detail Drawer */}
      <Modal
        title="Trial Request Details"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
      >
        {selected && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Practice">{selected.practiceName}</Descriptions.Item>
              <Descriptions.Item label="Plan">{selected.planType}</Descriptions.Item>
              <Descriptions.Item label="Contact">
                {`${selected.firstName} ${selected.lastName}`}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{selected.email}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selected.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[selected.status]}>{selected.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tenant ID">{selected.tenantId || '—'}</Descriptions.Item>
              <Descriptions.Item label="Admin User ID">{selected.adminUserId || '—'}</Descriptions.Item>
              <Descriptions.Item label="Trial Ends">
                {selected.trialEndsAt ? dayjs(selected.trialEndsAt).format('MMM D, YYYY HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {dayjs(selected.createdAt).format('MMM D, YYYY HH:mm')}
              </Descriptions.Item>
            </Descriptions>
            {selected.notes && (
              <div style={{ marginTop: 16 }}>
                <Text strong>Notes:</Text>
                <p>{selected.notes}</p>
              </div>
            )}
            <Space style={{ marginTop: 24 }}>
              {selected.status === 'pending' && (
                <>
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => openApprove(selected)}>
                    Approve
                  </Button>
                  <Button icon={<CloseOutlined />} onClick={() => openReject(selected)}>
                    Reject
                  </Button>
                </>
              )}
              {selected.status === 'active' && (
                <>
                  <Button icon={<CheckOutlined />} onClick={() => handleConvert(selected.id)}>
                    Convert to Paid
                  </Button>
                  <Button icon={<DeleteOutlined />} onClick={() => handleWipe(selected.id)}>
                    Wipe & Convert
                  </Button>
                  <Popconfirm title="Disable this account?" onConfirm={() => handleDisable(selected.id)}>
                    <Button icon={<PauseCircleOutlined />} danger>
                      Disable
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        title="Approve Trial Request"
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={() => approveForm.submit()}
        okText="Approve & Provision"
      >
        {selected && (
          <Form form={approveForm} layout="vertical" onFinish={handleApprove}>
            <p>
              Approve <strong>{selected.practiceName}</strong> ({selected.planType}) — {selected.email}
            </p>
            <Form.Item
              name="trialDays"
              label="Trial Length (days)"
              initialValue={selected.planType === 'enterprise' ? 30 : 14}
            >
              <Select>
                <Option value={14}>14 days (Solo/Professional)</Option>
                <Option value={30}>30 days (Enterprise)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="notes" label="Internal Notes">
              <TextArea rows={3} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Reject Trial Request"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        okText="Reject"
        okType="danger"
      >
        <Form form={rejectForm} layout="vertical" onFinish={handleReject}>
          <Form.Item name="notes" label="Rejection Notes (optional)">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminTrialsPage;
