import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Select,
  Popconfirm,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '../../store/dataStore';
import type { WorkflowTemplate } from '../../types';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Search } = Input;

const entityTypeColors: Record<string, string> = {
  appointment: 'blue',
  encounter: 'cyan',
  prescription: 'green',
  lab_order: 'orange',
  claim: 'purple',
};

const WorkflowListPage: React.FC = () => {
  const navigate = useNavigate();
  const { templates, loading, fetchTemplates, deleteTemplate } = useWorkflowStore();
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>();

  useEffect(() => {
    fetchTemplates({ entityType: entityTypeFilter, search });
  }, [fetchTemplates, entityTypeFilter, search]);

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      message.success('Workflow template deleted');
    } catch {
      message.error('Failed to delete workflow template');
    }
  };

  const columns: ColumnsType<WorkflowTemplate> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <a onClick={() => navigate(`/workflow/${record.id}`)}>
          <SettingOutlined style={{ marginRight: 8 }} />
          {name}
        </a>
      ),
    },
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (type: string) => (
        <Tag color={entityTypeColors[type] || 'default'}>{type}</Tag>
      ),
    },
    {
      title: 'Steps',
      dataIndex: 'steps',
      key: 'steps',
      render: (steps: WorkflowTemplate['steps']) => (
        <Space size={4} wrap>
          {steps
            .sort((a, b) => a.order - b.order)
            .map((step) => (
              <Tag key={step.name} color={step.color}>
                {step.label}
              </Tag>
            ))}
        </Space>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      align: 'center',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean) =>
        active ? (
          <Tag color="green">Active</Tag>
        ) : (
          <Tag color="default">Inactive</Tag>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/workflow/${record.id}`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this workflow template?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Workflow Templates
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/workflow/new')}
          >
            New Workflow
          </Button>
        </div>

        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <Search
            placeholder="Search workflows..."
            allowClear
            style={{ width: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(value) => setSearch(value)}
          />
          <Select
            placeholder="Filter by entity"
            allowClear
            style={{ width: 180 }}
            value={entityTypeFilter}
            onChange={(value) => setEntityTypeFilter(value)}
            options={[
              { label: 'Appointment', value: 'appointment' },
              { label: 'Encounter', value: 'encounter' },
              { label: 'Prescription', value: 'prescription' },
              { label: 'Lab Order', value: 'lab_order' },
              { label: 'Claim', value: 'claim' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
};

export default WorkflowListPage;
