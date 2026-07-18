import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Card,
  Space,
  Tag,
  Typography,
  Drawer,
  Form,
  Row,
  Col,
  Popconfirm,
  message,
  Tooltip,
  Divider,
  Tabs,
  Statistic,
  Progress,
  Modal,
  List,
  Empty,
  Spin,
  InputNumber,
  Switch,
  Badge,
  Avatar,
  Alert,
  ColorPicker,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  CopyOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  DollarOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  UserOutlined,
  BulbOutlined,
  SendOutlined,
  DownloadOutlined,
  HistoryOutlined,
  ApartmentOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  patientGroupService,
  type PatientGroup,
  type PatientGroupType,
  type PatientGroupCategory,
  type GroupRule,
  type GroupRuleSet,
  type GroupMemberSummary,
  type PopulationHealthStats,
  type GroupAuditLog,
  type SuggestedGroup,
  type RiskPrediction,
  type CareGapDetection,
  type OutreachRecommendation,
  type CreatePatientGroupDto,
} from '../../services/patientGroupService';

const { Title, Text, Paragraph } = Typography;

const typeColors: Record<PatientGroupType, string> = {
  manual: 'blue',
  dynamic: 'purple',
  smart: 'magenta',
};

const typeLabels: Record<PatientGroupType, string> = {
  manual: 'Manual',
  dynamic: 'Dynamic',
  smart: 'Smart',
};

const categoryLabels: Record<PatientGroupCategory, string> = {
  chronic_disease: 'Chronic Disease',
  preventive_care: 'Preventive Care',
  risk_stratification: 'Risk Stratification',
  insurance: 'Insurance',
  demographic: 'Demographic',
  appointment: 'Appointment',
  billing: 'Billing',
  care_management: 'Care Management',
  referral: 'Referral',
  behavioral_health: 'Behavioral Health',
  pediatric: 'Pediatric',
  telehealth: 'Telehealth',
  vip: 'VIP',
  custom: 'Custom',
};

const categoryIcons: Record<PatientGroupCategory, React.ReactNode> = {
  chronic_disease: <HeartOutlined />,
  preventive_care: <SafetyCertificateOutlined />,
  risk_stratification: <ThunderboltOutlined />,
  insurance: <DollarOutlined />,
  demographic: <TeamOutlined />,
  appointment: <CalendarOutlined />,
  billing: <DollarOutlined />,
  care_management: <MedicineBoxOutlined />,
  referral: <ArrowRightOutlined />,
  behavioral_health: <HeartOutlined />,
  pediatric: <UserOutlined />,
  telehealth: <FileTextOutlined />,
  vip: <ThunderboltOutlined />,
  custom: <TeamOutlined />,
};

const ruleFieldLabels: Record<string, string> = {
  age: 'Age',
  gender: 'Gender',
  diagnosis: 'Diagnosis (ICD-10)',
  insurance: 'Insurance Provider',
  provider: 'Provider',
  location: 'Location',
  last_visit: 'Last Visit',
  next_appointment: 'Next Appointment',
  outstanding_balance: 'Outstanding Balance',
  risk_score: 'Risk Score',
  lab_value: 'Lab Value',
  medication: 'Medication',
  allergy: 'Allergy',
  encounter_count: 'Encounter Count',
  status: 'Patient Status',
  custom_field: 'Custom Field',
};

const ruleOperatorLabels: Record<string, string> = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
  greater_than_or_equal: 'Greater Than or Equal',
  less_than_or_equal: 'Less Than or Equal',
  contains: 'Contains',
  not_contains: 'Does Not Contain',
  in: 'In',
  not_in: 'Not In',
  between: 'Between',
  is_null: 'Is Empty',
  is_not_null: 'Is Not Empty',
  before: 'Before',
  after: 'After',
  within_last: 'Within Last',
  within_next: 'Within Next',
  older_than_days: 'Older Than',
};

const bulkActions = [
  { value: 'message', label: 'Send Portal Message' },
  { value: 'sms', label: 'Send SMS' },
  { value: 'email', label: 'Send Email' },
  { value: 'task', label: 'Assign Task' },
  { value: 'recall', label: 'Recall Campaign' },
  { value: 'appointment', label: 'Schedule Appointments' },
  { value: 'eligibility', label: 'Eligibility Verification' },
  { value: 'export', label: 'Export List' },
  { value: 'care_plan', label: 'Assign Care Plan' },
  { value: 'reminder', label: 'Send Reminders' },
];

const PatientGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('groups');
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<PatientGroupType | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<PatientGroupCategory | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PatientGroup | null>(null);
  const [form] = Form.useForm();

  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<PatientGroup | null>(null);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [populationHealth, setPopulationHealth] = useState<PopulationHealthStats | null>(null);
  const [auditLog, setAuditLog] = useState<GroupAuditLog[]>([]);
  const [detailTab, setDetailTab] = useState('members');

  const [ruleCombinator, setRuleCombinator] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<GroupRule[]>([]);

  const [aiSuggestions, setAiSuggestions] = useState<SuggestedGroup[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [nlQuery, setNlQuery] = useState('');
  const [nlResult, setNlResult] = useState<{ interpretedQuery: string; matchedCount: number; explanation: string } | null>(null);
  const [nlLoading, setNlLoading] = useState(false);
  const [riskPredictions, setRiskPredictions] = useState<RiskPrediction[]>([]);
  const [careGaps, setCareGaps] = useState<CareGapDetection[]>([]);
  const [outreachRecs, setOutreachRecs] = useState<OutreachRecommendation[]>([]);
  const [aiTab, setAiTab] = useState('suggestions');

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkPayload, setBulkPayload] = useState('');

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const result = await patientGroupService.findAll({
        search: searchText || undefined,
        type: typeFilter,
        category: categoryFilter,
        status: statusFilter,
        page,
        limit,
      });
      setGroups(result.data);
      setTotal(result.total);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to load patient groups');
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, categoryFilter, statusFilter, page, limit]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleOpenCreate = () => {
    setEditingGroup(null);
    form.resetFields();
    setRules([]);
    setRuleCombinator('AND');
    setDrawerOpen(true);
  };

  const handleOpenEdit = (group: PatientGroup) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      description: group.description || '',
      type: group.type,
      category: group.category,
      color: group.color || '',
      icon: group.icon || '',
      tags: group.tags?.join(', ') || '',
      isShared: group.isShared,
    });
    setRules(group.rules?.rules || []);
    setRuleCombinator(group.rules?.combinator || 'AND');
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const tagsArray = values.tags
        ? (values.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
        : undefined;

      const ruleSet: GroupRuleSet | undefined =
        values.type === 'dynamic' || values.type === 'smart'
          ? { combinator: ruleCombinator, rules }
          : undefined;

      const dto: CreatePatientGroupDto = {
        name: values.name,
        description: values.description || undefined,
        type: values.type,
        category: values.category || 'custom',
        color: values.color || undefined,
        icon: values.icon || undefined,
        tags: tagsArray,
        rules: ruleSet,
        isShared: values.isShared ?? true,
      };

      if (editingGroup) {
        await patientGroupService.update(editingGroup.id, dto);
        message.success(`Group "${dto.name}" updated successfully`);
      } else {
        await patientGroupService.create(dto);
        message.success(`Group "${dto.name}" created successfully`);
      }
      setDrawerOpen(false);
      fetchGroups();
    } catch (err: any) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await patientGroupService.delete(id);
      message.success('Group deleted');
      fetchGroups();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to delete group');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await patientGroupService.archive(id);
      message.success('Group archived');
      fetchGroups();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to archive group');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await patientGroupService.duplicate(id);
      message.success('Group duplicated');
      fetchGroups();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to duplicate group');
    }
  };

  const handleRefresh = async (id: string) => {
    try {
      await patientGroupService.refresh(id);
      message.success('Group membership refreshed');
      fetchGroups();
      if (selectedGroup?.id === id) {
        openDetail(await patientGroupService.findOne(id));
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to refresh group');
    }
  };

  const openDetail = async (group: PatientGroup) => {
    setSelectedGroup(group);
    setDetailDrawer(true);
    setDetailTab('members');
    setMemberSearch('');
    await fetchMembers(group.id);
    await fetchPopulationHealth(group.id);
    await fetchAuditLog(group.id);
  };

  const fetchMembers = async (groupId: string, search?: string) => {
    setMembersLoading(true);
    try {
      const result = await patientGroupService.getMembers(groupId, {
        page: 1,
        limit: 100,
        search: search || undefined,
      });
      setMembers(result.data);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchPopulationHealth = async (groupId: string) => {
    try {
      const stats = await patientGroupService.getPopulationHealth(groupId);
      setPopulationHealth(stats);
    } catch {
      setPopulationHealth(null);
    }
  };

  const fetchAuditLog = async (groupId: string) => {
    try {
      const logs = await patientGroupService.getAuditLog(groupId, 30);
      setAuditLog(logs);
    } catch {
      setAuditLog([]);
    }
  };

  const handleExport = async (group: PatientGroup) => {
    try {
      const blob = await patientGroupService.exportCsv(group.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_members.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('Export downloaded');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Export failed');
    }
  };

  const handleBulkAction = async () => {
    if (!selectedGroup || !bulkAction) return;
    try {
      const payload = bulkPayload ? { message: bulkPayload } : undefined;
      const result = await patientGroupService.bulkAction(selectedGroup.id, bulkAction, payload);
      message.success(result.message);
      setBulkModalOpen(false);
      setBulkAction('');
      setBulkPayload('');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Bulk action failed');
    }
  };

  // ─── AI Functions ──────────────────────────────────────────────

  const fetchAiSuggestions = async () => {
    setAiLoading(true);
    try {
      const suggestions = await patientGroupService.getSuggestedGroups();
      setAiSuggestions(suggestions);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const handleNlSearch = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    try {
      const result = await patientGroupService.naturalLanguageSearch(nlQuery);
      setNlResult({
        interpretedQuery: result.interpretedQuery,
        matchedCount: result.matchedCount,
        explanation: result.explanation,
      });
      message.success(`Found ${result.matchedCount} matching patients`);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Search failed');
    } finally {
      setNlLoading(false);
    }
  };

  const handleCreateFromSuggestion = async (suggestion: SuggestedGroup) => {
    try {
      await patientGroupService.create({
        name: suggestion.name,
        description: suggestion.description,
        type: suggestion.type,
        category: suggestion.category,
        rules: suggestion.rules,
        isShared: true,
      });
      message.success(`Created group "${suggestion.name}"`);
      fetchGroups();
      setActiveTab('groups');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to create group from suggestion');
    }
  };

  const handleAnalyzeRisk = async () => {
    if (!selectedGroup) return;
    setAiLoading(true);
    try {
      const ids = members.map((m) => m.id);
      if (ids.length === 0) {
        message.warning('No members to analyze');
        return;
      }
      const predictions = await patientGroupService.predictRisk(ids);
      setRiskPredictions(predictions);
      setDetailTab('ai-risk');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Risk prediction failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDetectCareGaps = async () => {
    if (!selectedGroup) return;
    setAiLoading(true);
    try {
      const ids = members.map((m) => m.id);
      if (ids.length === 0) {
        message.warning('No members to analyze');
        return;
      }
      const gaps = await patientGroupService.detectCareGaps(ids);
      setCareGaps(gaps);
      setDetailTab('ai-gaps');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Care gap detection failed');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchOutreachRecs = async () => {
    setAiLoading(true);
    try {
      const recs = await patientGroupService.getOutreachRecommendations();
      setOutreachRecs(recs);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to get outreach recommendations');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Rule Builder ──────────────────────────────────────────────

  const addRule = () => {
    setRules([...rules, { field: 'age', operator: 'greater_than', value: 65 }]);
  };

  const updateRule = (index: number, patch: Partial<GroupRule>) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...patch };
    setRules(updated);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  // ─── Table Columns ─────────────────────────────────────────────

  const columns: ColumnsType<PatientGroup> = useMemo(
    () => [
      {
        title: 'Group',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record: PatientGroup) => (
          <Space>
            <Avatar
              size="small"
              style={{ backgroundColor: record.color || '#1890ff' }}
              icon={categoryIcons[record.category] || <TeamOutlined />}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{name}</div>
              {record.description && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.description.length > 60
                    ? `${record.description.slice(0, 60)}...`
                    : record.description}
                </Text>
              )}
            </div>
          </Space>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: 100,
        render: (type: PatientGroupType) => <Tag color={typeColors[type]}>{typeLabels[type]}</Tag>,
      },
      {
        title: 'Category',
        dataIndex: 'category',
        key: 'category',
        width: 150,
        render: (category: PatientGroupCategory) => (
          <Tag icon={categoryIcons[category]}>{categoryLabels[category]}</Tag>
        ),
      },
      {
        title: 'Members',
        dataIndex: 'memberCount',
        key: 'memberCount',
        width: 90,
        align: 'center' as const,
        render: (count: number) => (
          <Badge count={count} showZero style={{ backgroundColor: '#1890ff' }} />
        ),
      },
      {
        title: 'Tags',
        dataIndex: 'tags',
        key: 'tags',
        width: 150,
        render: (tags: string[] | null) =>
          tags && tags.length > 0 ? (
            <Space size={[0, 4]} wrap>
              {tags.slice(0, 3).map((t) => (
                <Tag key={t} color="default">{t}</Tag>
              ))}
              {tags.length > 3 && <Tag>+{tags.length - 3}</Tag>}
            </Space>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (status: string) => (
          <Tag color={status === 'active' ? 'green' : status === 'archived' ? 'orange' : 'default'}>
            {status}
          </Tag>
        ),
      },
      {
        title: 'Last Refreshed',
        dataIndex: 'lastRefreshedAt',
        key: 'lastRefreshedAt',
        width: 140,
        render: (date: string | null, record: PatientGroup) => {
          if (record.type === 'manual') return <Text type="secondary">N/A</Text>;
          if (!date) return <Text type="secondary">Never</Text>;
          return <Text type="secondary">{new Date(date).toLocaleDateString()}</Text>;
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 200,
        render: (_: unknown, record: PatientGroup) => (
          <Space size={0}>
            <Tooltip title="View Details">
              <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
            </Tooltip>
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
            </Tooltip>
            {(record.type === 'dynamic' || record.type === 'smart') && (
              <Tooltip title="Refresh Membership">
                <Button type="text" icon={<ReloadOutlined />} onClick={() => handleRefresh(record.id)} />
              </Tooltip>
            )}
            <Tooltip title="Duplicate">
              <Button type="text" icon={<CopyOutlined />} onClick={() => handleDuplicate(record.id)} />
            </Tooltip>
            <Tooltip title="Export CSV">
              <Button type="text" icon={<DownloadOutlined />} onClick={() => handleExport(record)} />
            </Tooltip>
            {record.status === 'active' ? (
              <Popconfirm title="Archive this group?" onConfirm={() => handleArchive(record.id)}>
                <Tooltip title="Archive">
                  <Button type="text" icon={<HistoryOutlined />} />
                </Tooltip>
              </Popconfirm>
            ) : null}
            <Popconfirm title="Delete this group?" onConfirm={() => handleDelete(record.id)}>
              <Tooltip title="Delete">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [],
  );

  const memberColumns: ColumnsType<GroupMemberSummary> = [
    {
      title: 'Patient',
      key: 'patient',
      render: (_: unknown, m: GroupMemberSummary) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <a onClick={() => navigate(`/patients/${m.id}`)}>{m.lastName}, {m.firstName}</a>
            {m.mrn && <div><Text type="secondary" style={{ fontSize: 12 }}>MRN: {m.mrn}</Text></div>}
          </div>
        </Space>
      ),
    },
    { title: 'Age', dataIndex: 'age', key: 'age', width: 60 },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
      render: (g: string) => <Tag>{g}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>,
    },
    {
      title: 'Risk',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 80,
      render: (score: number) => {
        const color = score >= 80 ? '#f5222d' : score >= 60 ? '#fa8c16' : score >= 30 ? '#faad14' : '#52c41a';
        return <Text style={{ color, fontWeight: 600 }}>{score}</Text>;
      },
    },
    {
      title: 'Insurance',
      dataIndex: 'insuranceProvider',
      key: 'insuranceProvider',
      render: (p: string | null) => p || <Text type="secondary">—</Text>,
    },
    {
      title: 'Last Visit',
      dataIndex: 'lastVisitDate',
      key: 'lastVisitDate',
      render: (d: string | null) => (d ? new Date(d).toLocaleDateString() : <Text type="secondary">—</Text>),
    },
  ];

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Patient Groups</Title>
        <Space>
          <Button icon={<ExportOutlined />} onClick={() => fetchGroups()}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>New Group</Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'groups',
            label: <span><TeamOutlined /> Groups</span>,
            children: (
              <>
                <Card bodyStyle={{ padding: 16 }} style={{ marginBottom: 16 }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Input.Search
                        placeholder="Search groups..."
                        value={searchText}
                        onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6} lg={4}>
                      <Select
                        placeholder="Type"
                        value={typeFilter}
                        onChange={(v) => { setTypeFilter(v); setPage(1); }}
                        allowClear
                        style={{ width: '100%' }}
                        options={[
                          { value: 'manual', label: 'Manual' },
                          { value: 'dynamic', label: 'Dynamic' },
                          { value: 'smart', label: 'Smart' },
                        ]}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6} lg={5}>
                      <Select
                        placeholder="Category"
                        value={categoryFilter}
                        onChange={(v) => { setCategoryFilter(v); setPage(1); }}
                        allowClear
                        style={{ width: '100%' }}
                        options={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={4} lg={3}>
                      <Select
                        placeholder="Status"
                        value={statusFilter}
                        onChange={(v) => { setStatusFilter(v); setPage(1); }}
                        allowClear
                        style={{ width: '100%' }}
                        options={[
                          { value: 'active', label: 'Active' },
                          { value: 'archived', label: 'Archived' },
                        ]}
                      />
                    </Col>
                  </Row>
                </Card>

                <Card bodyStyle={{ padding: 0 }}>
                  <Table
                    columns={columns}
                    dataSource={groups}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      current: page,
                      pageSize: limit,
                      total,
                      showSizeChanger: false,
                      onChange: (p) => setPage(p),
                      showTotal: (t) => `${t} groups`,
                    }}
                    scroll={{ x: 900 }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'ai',
            label: <span><RobotOutlined /> AI Assistant</span>,
            children: (
              <Tabs
                activeKey={aiTab}
                onChange={setAiTab}
                items={[
                  {
                    key: 'suggestions',
                    label: <span><BulbOutlined /> Suggested Groups</span>,
                    children: (
                      <Card>
                        <div style={{ marginBottom: 16 }}>
                          <Button type="primary" icon={<RobotOutlined />} onClick={fetchAiSuggestions} loading={aiLoading}>
                            Generate AI Suggestions
                          </Button>
                        </div>
                        {aiSuggestions.length === 0 && !aiLoading ? (
                          <Empty description="Click 'Generate AI Suggestions' to get AI-powered group recommendations based on your practice data" />
                        ) : (
                          <List
                            loading={aiLoading}
                            dataSource={aiSuggestions}
                            renderItem={(suggestion) => (
                              <List.Item
                                actions={[
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => handleCreateFromSuggestion(suggestion)}
                                  >
                                    Create
                                  </Button>,
                                ]}
                              >
                                <List.Item.Meta
                                  avatar={<Avatar icon={categoryIcons[suggestion.category]} style={{ backgroundColor: '#722ed1' }} />}
                                  title={
                                    <Space>
                                      <Text strong>{suggestion.name}</Text>
                                      <Tag>{categoryLabels[suggestion.category]}</Tag>
                                      <Tag color="purple">{typeLabels[suggestion.type]}</Tag>
                                      <Tag>~{suggestion.estimatedSize} patients</Tag>
                                    </Space>
                                  }
                                  description={
                                    <div>
                                      <Paragraph style={{ marginBottom: 4 }}>{suggestion.description}</Paragraph>
                                      <Text type="secondary" style={{ fontSize: 12 }}>{suggestion.rationale}</Text>
                                    </div>
                                  }
                                />
                              </List.Item>
                            )}
                          />
                        )}
                      </Card>
                    ),
                  },
                  {
                    key: 'search',
                    label: <span><SearchOutlined /> Natural Language Search</span>,
                    children: (
                      <Card>
                        <Paragraph type="secondary">
                          Search for patients using natural language. Examples:
                        </Paragraph>
                        <Space wrap style={{ marginBottom: 16 }}>
                          {['Diabetic patients with A1C > 8', 'Patients over 65', 'Patients overdue for annual wellness', 'Patients with unpaid balances'].map((ex) => (
                            <Tag
                              key={ex}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setNlQuery(ex)}
                            >
                              {ex}
                            </Tag>
                          ))}
                        </Space>
                        <Input.Search
                          placeholder="Describe the patient cohort you want to find..."
                          value={nlQuery}
                          onChange={(e) => setNlQuery(e.target.value)}
                          onSearch={handleNlSearch}
                          enterButton="Search with AI"
                          loading={nlLoading}
                          size="large"
                        />
                        {nlResult && (
                          <Alert
                            style={{ marginTop: 16 }}
                            type="info"
                            showIcon
                            icon={<RobotOutlined />}
                            message={`Interpreted: ${nlResult.interpretedQuery}`}
                            description={
                              <div>
                                <Text>{nlResult.explanation}</Text>
                                <Divider style={{ margin: '8px 0' }} />
                                <Text strong>Matched {nlResult.matchedCount} patients</Text>
                              </div>
                            }
                          />
                        )}
                      </Card>
                    ),
                  },
                  {
                    key: 'outreach',
                    label: <span><SendOutlined /> Outreach Campaigns</span>,
                    children: (
                      <Card>
                        <div style={{ marginBottom: 16 }}>
                          <Button type="primary" icon={<RobotOutlined />} onClick={fetchOutreachRecs} loading={aiLoading}>
                            Get Outreach Recommendations
                          </Button>
                        </div>
                        {outreachRecs.length === 0 && !aiLoading ? (
                          <Empty description="Generate AI-powered outreach campaign recommendations" />
                        ) : (
                          <List
                            loading={aiLoading}
                            dataSource={outreachRecs}
                            renderItem={(rec) => (
                              <List.Item
                                actions={[
                                  <Button key="launch" size="small" icon={<SendOutlined />} onClick={() => message.info(`Campaign "${rec.campaignType}" queued for launch`)}>
                                    Launch
                                  </Button>,
                                ]}
                              >
                                <List.Item.Meta
                                  avatar={
                                    <Avatar
                                      icon={<SendOutlined />}
                                      style={{ backgroundColor: rec.channel === 'sms' ? '#52c41a' : rec.channel === 'email' ? '#1890ff' : rec.channel === 'phone' ? '#fa8c16' : '#722ed1' }}
                                    />
                                  }
                                  title={
                                    <Space>
                                      <Text strong>{rec.campaignType}</Text>
                                      <Tag>{rec.channel.toUpperCase()}</Tag>
                                      <Tag>~{rec.estimatedReach} reach</Tag>
                                    </Space>
                                  }
                                  description={
                                    <div>
                                      <Text>Target: {rec.targetGroupName}</Text>
                                      <br />
                                      <Text type="secondary">{rec.description}</Text>
                                      <br />
                                      <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                                        Template: "{rec.messageTemplate}"
                                      </Text>
                                    </div>
                                  }
                                />
                              </List.Item>
                            )}
                          />
                        )}
                      </Card>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      {/* ─── Create/Edit Drawer ─────────────────────────────────── */}
      <Drawer
        title={editingGroup ? 'Edit Patient Group' : 'Create Patient Group'}
        placement="right"
        width={640}
        onClose={() => { setDrawerOpen(false); setEditingGroup(null); form.resetFields(); }}
        open={drawerOpen}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit}>{editingGroup ? 'Update' : 'Create'}</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'manual', category: 'custom', isShared: true }}>
          <Form.Item name="name" label="Group Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Diabetic Patients" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Describe this group's purpose..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Group Type" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'manual', label: 'Manual — Add patients by hand' },
                    { value: 'dynamic', label: 'Dynamic — Auto-update by rules' },
                    { value: 'smart', label: 'Smart — AI-enhanced dynamic' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Select
                  options={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="color"
                label="Color Tag"
                getValueFromEvent={(color) => color?.toHexString?.() ?? ''}
              >
                <ColorPicker showText format="hex" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tags" label="Tags (comma-separated)">
                <Input placeholder="diabetes, chronic, high-risk" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isShared" label="Shared with all users" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Divider>Dynamic Rules</Divider>
          <Form.Item shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type !== 'dynamic' && type !== 'smart') {
                return <Alert type="info" message="Rules are only available for Dynamic and Smart groups. Manual groups use explicit member lists." />;
              }
              return (
                <div>
                  <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col>Match</Col>
                    <Col>
                      <Select
                        value={ruleCombinator}
                        onChange={setRuleCombinator}
                        size="small"
                        style={{ width: 90 }}
                        options={[
                          { value: 'AND', label: 'ALL (AND)' },
                          { value: 'OR', label: 'ANY (OR)' },
                        ]}
                      />
                    </Col>
                    <Col>of the following rules:</Col>
                  </Row>
                  {rules.map((rule, index) => (
                    <Card
                      key={index}
                      size="small"
                      style={{ marginBottom: 8 }}
                      extra={
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRule(index)} />
                      }
                    >
                      <Row gutter={8}>
                        <Col span={8}>
                          <Select
                            value={rule.field}
                            onChange={(v) => updateRule(index, { field: v })}
                            size="small"
                            style={{ width: '100%' }}
                            options={Object.entries(ruleFieldLabels).map(([value, label]) => ({ value, label }))}
                          />
                        </Col>
                        <Col span={8}>
                          <Select
                            value={rule.operator}
                            onChange={(v) => updateRule(index, { operator: v })}
                            size="small"
                            style={{ width: '100%' }}
                            options={Object.entries(ruleOperatorLabels).map(([value, label]) => ({ value, label }))}
                          />
                        </Col>
                        <Col span={8}>
                          {rule.operator !== 'is_null' && rule.operator !== 'is_not_null' && (
                            <Input
                              value={rule.value as string}
                              onChange={(e) => updateRule(index, { value: e.target.value })}
                              size="small"
                              placeholder="Value"
                            />
                          )}
                        </Col>
                      </Row>
                      {(rule.operator === 'within_last' || rule.operator === 'within_next' || rule.operator === 'older_than_days') && (
                        <Row gutter={8} style={{ marginTop: 8 }}>
                          <Col span={12}>
                            <InputNumber
                              value={rule.value as number}
                              onChange={(v) => updateRule(index, { value: v || 0 })}
                              size="small"
                              style={{ width: '100%' }}
                              placeholder="Amount"
                            />
                          </Col>
                          <Col span={12}>
                            <Select
                              value={rule.unit || 'days'}
                              onChange={(v) => updateRule(index, { unit: v })}
                              size="small"
                              style={{ width: '100%' }}
                              options={[
                                { value: 'days', label: 'Days' },
                                { value: 'weeks', label: 'Weeks' },
                                { value: 'months', label: 'Months' },
                                { value: 'years', label: 'Years' },
                              ]}
                            />
                          </Col>
                        </Row>
                      )}
                    </Card>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={addRule} block>
                    Add Rule
                  </Button>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Drawer>

      {/* ─── Detail Drawer ──────────────────────────────────────── */}
      <Drawer
        title={selectedGroup ? selectedGroup.name : 'Group Details'}
        placement="right"
        width={900}
        onClose={() => { setDetailDrawer(false); setSelectedGroup(null); setPopulationHealth(null); }}
        open={detailDrawer}
        extra={
          selectedGroup && (
            <Space>
              <Button icon={<ThunderboltOutlined />} onClick={() => setBulkModalOpen(true)}>Bulk Action</Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleExport(selectedGroup)}>Export</Button>
              {(selectedGroup.type === 'dynamic' || selectedGroup.type === 'smart') && (
                <Button icon={<ReloadOutlined />} onClick={() => handleRefresh(selectedGroup.id)}>Refresh</Button>
              )}
            </Space>
          )
        }
      >
        {selectedGroup && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Tag color={typeColors[selectedGroup.type]}>{typeLabels[selectedGroup.type]}</Tag>
                <Tag icon={categoryIcons[selectedGroup.category]}>{categoryLabels[selectedGroup.category]}</Tag>
                <Badge count={selectedGroup.memberCount} showZero style={{ backgroundColor: '#1890ff' }} />
                <Tag color={selectedGroup.status === 'active' ? 'green' : 'orange'}>{selectedGroup.status}</Tag>
              </Space>
              {selectedGroup.description && (
                <Paragraph style={{ marginTop: 8 }}>{selectedGroup.description}</Paragraph>
              )}
              {selectedGroup.tags && selectedGroup.tags.length > 0 && (
                <Space size={[0, 4]} wrap style={{ marginTop: 4 }}>
                  {selectedGroup.tags.map((t) => <Tag key={t} color="default">{t}</Tag>)}
                </Space>
              )}
            </div>

            <Tabs
              activeKey={detailTab}
              onChange={setDetailTab}
              items={[
                {
                  key: 'members',
                  label: <span><TeamOutlined /> Members ({members.length})</span>,
                  children: (
                    <>
                      <Input.Search
                        placeholder="Search members..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        onSearch={(v) => fetchMembers(selectedGroup.id, v)}
                        style={{ marginBottom: 16, width: 300 }}
                        allowClear
                      />
                      <Table
                        columns={memberColumns}
                        dataSource={members}
                        rowKey="id"
                        loading={membersLoading}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        size="small"
                      />
                    </>
                  ),
                },
                {
                  key: 'health',
                  label: <span><BarChartOutlined /> Population Health</span>,
                  children: populationHealth ? (
                    <div>
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={6}>
                          <Card size="small"><Statistic title="Total Members" value={populationHealth.totalMembers} /></Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small"><Statistic title="Avg Age" value={populationHealth.averageAge} /></Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small">
                            <Statistic
                              title="Appt Compliance"
                              value={Math.round(populationHealth.appointmentComplianceRate * 100)}
                              suffix="%"
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small">
                            <Statistic
                              title="No-Show Rate"
                              value={Math.round(populationHealth.noShowRate * 100)}
                              suffix="%"
                              valueStyle={{ color: '#f5222d' }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Card title="Age Distribution" size="small" style={{ marginBottom: 16 }}>
                            {populationHealth.ageDistribution.map((a) => (
                              <div key={a.range} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text>{a.range}</Text>
                                <Progress
                                  percent={populationHealth.totalMembers > 0 ? Math.round((a.count / populationHealth.totalMembers) * 100) : 0}
                                  format={() => `${a.count}`}
                                  size="small"
                                  style={{ width: 180 }}
                                />
                              </div>
                            ))}
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card title="Gender Distribution" size="small" style={{ marginBottom: 16 }}>
                            {populationHealth.genderDistribution.map((g) => (
                              <div key={g.gender} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ textTransform: 'capitalize' }}>{g.gender}</Text>
                                <Progress
                                  percent={populationHealth.totalMembers > 0 ? Math.round((g.count / populationHealth.totalMembers) * 100) : 0}
                                  format={() => `${g.count}`}
                                  size="small"
                                  style={{ width: 180 }}
                                />
                              </div>
                            ))}
                          </Card>
                        </Col>
                      </Row>

                      <Card title="Chronic Conditions" size="small" style={{ marginBottom: 16 }}>
                        {populationHealth.chronicConditionDistribution.length > 0 ? (
                          populationHealth.chronicConditionDistribution.map((c) => (
                            <div key={c.condition} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <Text>{c.condition}</Text>
                              <Tag color="blue">{c.count} patients</Tag>
                            </div>
                          ))
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No chronic conditions documented" />
                        )}
                      </Card>

                      <Card title="Care Gaps" size="small" style={{ marginBottom: 16 }}>
                        {populationHealth.careGaps.map((gap) => (
                          <div key={gap.gap} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Space>
                              <WarningOutlined style={{ color: '#faad14' }} />
                              <Text>{gap.gap}</Text>
                            </Space>
                            <Tag color="orange">{gap.count} patients</Tag>
                          </div>
                        ))}
                      </Card>

                      <Card title="Insurance Distribution" size="small">
                        {populationHealth.insuranceDistribution.map((i) => (
                          <div key={i.payer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text>{i.payer}</Text>
                            <Tag>{i.count} patients</Tag>
                          </div>
                        ))}
                      </Card>
                    </div>
                  ) : (
                    <Spin tip="Loading population health..." />
                  ),
                },
                {
                  key: 'ai-risk',
                  label: <span><ThunderboltOutlined /> Risk Prediction</span>,
                  children: (
                    <div>
                      <Button type="primary" icon={<RobotOutlined />} onClick={handleAnalyzeRisk} loading={aiLoading} style={{ marginBottom: 16 }}>
                        Run Risk Analysis
                      </Button>
                      {riskPredictions.length > 0 ? (
                        <List
                          dataSource={riskPredictions.slice(0, 20)}
                          renderItem={(pred) => (
                            <List.Item>
                              <List.Item.Meta
                                avatar={
                                  <Avatar
                                    style={{
                                      backgroundColor:
                                        pred.riskLevel === 'critical' ? '#f5222d' :
                                        pred.riskLevel === 'high' ? '#fa8c16' :
                                        pred.riskLevel === 'moderate' ? '#faad14' : '#52c41a',
                                    }}
                                  >
                                    {pred.riskScore}
                                  </Avatar>
                                }
                                title={
                                  <Space>
                                    <Text strong>{pred.patientName}</Text>
                                    <Tag color={pred.riskLevel === 'critical' ? 'red' : pred.riskLevel === 'high' ? 'orange' : pred.riskLevel === 'moderate' ? 'yellow' : 'green'}>
                                      {pred.riskLevel.toUpperCase()}
                                    </Tag>
                                  </Space>
                                }
                                description={
                                  <div>
                                    <Text type="secondary">Factors: {pred.factors.join(', ')}</Text>
                                    <br />
                                    <Text>Recommended: {pred.recommendedActions.join('; ')}</Text>
                                  </div>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="Click 'Run Risk Analysis' to predict risk scores for all group members" />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'ai-gaps',
                  label: <span><SafetyCertificateOutlined /> Care Gaps</span>,
                  children: (
                    <div>
                      <Button type="primary" icon={<RobotOutlined />} onClick={handleDetectCareGaps} loading={aiLoading} style={{ marginBottom: 16 }}>
                        Detect Care Gaps
                      </Button>
                      {careGaps.length > 0 ? (
                        <List
                          dataSource={careGaps.filter((c) => c.gaps.length > 0).slice(0, 20)}
                          renderItem={(item) => (
                            <List.Item>
                              <List.Item.Meta
                                title={<Text strong>{item.patientName}</Text>}
                                description={
                                  <Space direction="vertical" size={4}>
                                    {item.gaps.map((gap, i) => (
                                      <div key={i}>
                                        <Tag color={gap.severity === 'high' ? 'red' : gap.severity === 'medium' ? 'orange' : 'blue'}>
                                          {gap.severity.toUpperCase()}
                                        </Tag>
                                        <Text> {gap.gap}</Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: 12 }}>→ {gap.recommendedAction}</Text>
                                      </div>
                                    ))}
                                  </Space>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="Click 'Detect Care Gaps' to identify preventive care gaps for all group members" />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'audit',
                  label: <span><HistoryOutlined /> Audit Log</span>,
                  children: (
                    <List
                      dataSource={auditLog}
                      renderItem={(log) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Avatar icon={<HistoryOutlined />} style={{ backgroundColor: '#8c8c8c' }} />}
                            title={
                              <Space>
                                <Tag>{log.action}</Tag>
                                <Text type="secondary" style={{ fontSize: 12 }}>{new Date(log.createdAt).toLocaleString()}</Text>
                              </Space>
                            }
                            description={
                              <div>
                                <Text>{log.description}</Text>
                                {log.userEmail && <div><Text type="secondary" style={{ fontSize: 12 }}>by {log.userEmail} ({log.userRole})</Text></div>}
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* ─── Bulk Action Modal ──────────────────────────────────── */}
      <Modal
        title="Bulk Action"
        open={bulkModalOpen}
        onCancel={() => setBulkModalOpen(false)}
        onOk={handleBulkAction}
        okText="Execute"
      >
        {selectedGroup && (
          <Alert
            style={{ marginBottom: 16 }}
            message={`This action will affect ${selectedGroup.memberCount} members of "${selectedGroup.name}"`}
            type="info"
            showIcon
          />
        )}
        <Form layout="vertical">
          <Form.Item label="Action Type" required>
            <Select
              value={bulkAction}
              onChange={setBulkAction}
              placeholder="Select an action..."
              options={bulkActions}
            />
          </Form.Item>
          {(bulkAction === 'message' || bulkAction === 'sms' || bulkAction === 'email' || bulkAction === 'reminder') && (
            <Form.Item label="Message">
              <Input.TextArea
                value={bulkPayload}
                onChange={(e) => setBulkPayload(e.target.value)}
                rows={4}
                placeholder="Enter the message to send to all group members..."
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default PatientGroupsPage;
