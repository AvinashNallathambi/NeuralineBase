import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Select,
  DatePicker,
  Checkbox,
  Modal,
  message,
  Row,
  Col,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { patientService } from '../../services/patientService';
import { type PatientProblem } from '../../services/icdService';
import IcdSearchInput from '../icd/IcdSearchInput';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = Input;

interface ProblemListSectionProps {
  patientId: string;
}

const ProblemListSection: React.FC<ProblemListSectionProps> = ({ patientId }) => {
  const [problems, setProblems] = useState<PatientProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PatientProblem | null>(null);
  const [form] = Form.useForm();

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientService.findProblems(patientId);
      setProblems(data);
    } catch {
      message.error('Failed to load problem list');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (problem: PatientProblem) => {
    setEditing(problem);
    form.setFieldsValue({
      ...problem,
      onsetDate: problem.onsetDate ? dayjs(problem.onsetDate) : undefined,
      resolutionDate: problem.resolutionDate ? dayjs(problem.resolutionDate) : undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        onsetDate: values.onsetDate ? values.onsetDate.format('YYYY-MM-DD') : undefined,
        resolutionDate: values.resolutionDate ? values.resolutionDate.format('YYYY-MM-DD') : undefined,
      };

      if (editing) {
        await patientService.updateProblem(patientId, editing.id, payload);
        message.success('Problem updated');
      } else {
        await patientService.createProblem(patientId, payload);
        message.success('Problem added');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      fetchProblems();
    } catch {
      message.error('Failed to save problem');
    }
  };

  const handleDelete = (problem: PatientProblem) => {
    Modal.confirm({
      title: 'Remove Problem',
      content: `Remove "${problem.description}" from the problem list?`,
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        try {
          await patientService.deleteProblem(patientId, problem.id);
          message.success('Problem removed');
          fetchProblems();
        } catch {
          message.error('Failed to remove problem');
        }
      },
    });
  };

  const columns: ColumnsType<PatientProblem> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 120,
      render: (code, record) => (
        <Space>
          <Tag color={record.clinicalStatus === 'active' ? 'blue' : 'default'}>{code}</Tag>
          {record.isChronic && <Tag color="orange">Chronic</Tag>}
        </Space>
      ),
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'System', dataIndex: 'codeSystem', width: 100, render: (s) => <Tag>{s}</Tag> },
    {
      title: 'Status',
      dataIndex: 'clinicalStatus',
      width: 100,
      render: (s) => <Tag color={s === 'active' ? 'green' : s === 'resolved' ? 'blue' : 'default'}>{s}</Tag>,
    },
    { title: 'Priority', dataIndex: 'priority', width: 90, render: (p) => p && <Tag>{p}</Tag> },
    {
      title: 'Onset',
      dataIndex: 'onsetDate',
      width: 110,
      render: (d) => (d ? dayjs(d).format('MM/DD/YYYY') : '—'),
    },
    {
      title: 'Resolved',
      dataIndex: 'resolutionDate',
      width: 110,
      render: (d) => (d ? dayjs(d).format('MM/DD/YYYY') : '—'),
    },
    {
      title: '',
      width: 100,
      render: (_: unknown, record: PatientProblem) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <HeartOutlined />
          <span>Problem List</span>
        </Space>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={openCreate}>
          Add Problem
        </Button>
      }
      size="small"
    >
      <Table
        columns={columns}
        dataSource={problems}
        rowKey="id"
        size="small"
        pagination={false}
        loading={loading}
        locale={{ emptyText: <Empty description="No problems on file" /> }}
      />

      <Modal
        title={editing ? 'Edit Problem' : 'Add Problem'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setEditing(null);
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: true, message: 'Code is required' }]}
          >
            <IcdSearchInput
              placeholder="Search diagnosis code"
              onSelect={(selection) => {
                form.setFieldsValue({
                  code: selection.code,
                  description: selection.description,
                  codeSystem: selection.codeSystem || 'ICD-10-CM',
                });
              }}
            />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="codeSystem" label="Coding System" initialValue="ICD-10-CM">
            <Select>
              <Option value="ICD-10-CM">ICD-10-CM</Option>
              <Option value="SNOMED CT">SNOMED CT</Option>
              <Option value="ICD-11">ICD-11</Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="clinicalStatus" label="Clinical Status" initialValue="active">
                <Select>
                  <Option value="active">Active</Option>
                  <Option value="inactive">Inactive</Option>
                  <Option value="resolved">Resolved</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select allowClear>
                  <Option value="primary">Primary</Option>
                  <Option value="secondary">Secondary</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isChronic" valuePropName="checked">
            <Checkbox>Chronic condition</Checkbox>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="onsetDate" label="Onset Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="resolutionDate" label="Resolution Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ProblemListSection;
