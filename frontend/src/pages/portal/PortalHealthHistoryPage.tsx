import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Typography,
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Space,
  Empty,
  Spin,
  message,
  Popconfirm,
  Alert,
  Collapse,
  Row,
  Col,
  Statistic,
  Tooltip,
  Divider,
  List,
} from 'antd';
import {
  HeartOutlined,
  WarningOutlined,
  TeamOutlined,
  RobotOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileProtectOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import patientPortalService from '../../services/patientPortalService';
import patientAiService from '../../services/patientAiService';
import patientAuthService from '../../services/patientAuthService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const severityColors: Record<string, string> = {
  mild: 'blue',
  moderate: 'orange',
  severe: 'red',
  'life-threatening': 'magenta',
};

const statusColors: Record<string, string> = {
  active: 'red',
  inactive: 'default',
  resolved: 'green',
  chronic: 'purple',
};

const relationshipLabels: Record<string, string> = {
  father: 'Father',
  mother: 'Mother',
  brother: 'Brother',
  sister: 'Sister',
  son: 'Son',
  daughter: 'Daughter',
  grandfather: 'Grandfather',
  grandmother: 'Grandmother',
  uncle: 'Uncle',
  aunt: 'Aunt',
  cousin: 'Cousin',
  niece: 'Niece',
  nephew: 'Nephew',
  spouse: 'Spouse',
  other: 'Other',
};

const PortalHealthHistoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('conditions');
  const [loading, setLoading] = useState(true);
  const [conditions, setConditions] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [familyHistory, setFamilyHistory] = useState<any[]>([]);
  const [surgicalHistory, setSurgicalHistory] = useState<any[]>([]);
  const [socialHistory, setSocialHistory] = useState<any[]>([]);

  // Modal states
  const [conditionModalOpen, setConditionModalOpen] = useState(false);
  const [allergyModalOpen, setAllergyModalOpen] = useState(false);
  const [familyHistoryModalOpen, setFamilyHistoryModalOpen] = useState(false);
  const [surgicalModalOpen, setSurgicalModalOpen] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // AI feature states
  const [aiModalOpen, setAiModalOpen] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [freeText, setFreeText] = useState('');

  const [conditionForm] = Form.useForm();
  const [allergyForm] = Form.useForm();
  const [familyHistoryForm] = Form.useForm();
  const [surgicalForm] = Form.useForm();
  const [socialForm] = Form.useForm();

  const patient = patientAuthService.getCurrentPatient();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [conds, allergs, famHist, surgHist, socHist] = await Promise.all([
        patientPortalService.getMedicalHistory(),
        patientPortalService.getAllergies(),
        patientPortalService.getFamilyHistory(),
        patientPortalService.getSurgicalHistory(),
        patientPortalService.getSocialHistory(),
      ]);
      setConditions(conds || []);
      setAllergies(allergs || []);
      setFamilyHistory(famHist || []);
      setSurgicalHistory(surgHist || []);
      setSocialHistory(socHist || []);
    } catch (err: any) {
      message.error('Failed to load health history: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Condition handlers ──────────────────────────────────────────

  const handleAddCondition = async (values: any) => {
    setSubmitting(true);
    try {
      await patientPortalService.addMedicalHistory({
        description: values.description,
        onsetDate: values.onsetDate ? values.onsetDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes,
      });
      message.success('Condition added to your medical history');
      setConditionModalOpen(false);
      conditionForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to add condition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCondition = async (id: string) => {
    try {
      await patientPortalService.removeMedicalHistory(id);
      message.success('Condition removed');
      loadData();
    } catch {
      message.error('Failed to remove condition');
    }
  };

  // ─── Allergy handlers ─────────────────────────────────────────────

  const handleAddAllergy = async (values: any) => {
    setSubmitting(true);
    try {
      await patientPortalService.addAllergy({
        allergen: values.allergen,
        reaction: values.reaction,
        severity: values.severity,
        onsetDate: values.onsetDate ? values.onsetDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes,
      });
      message.success('Allergy added to your record');
      setAllergyModalOpen(false);
      allergyForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to add allergy');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAllergy = async (id: string) => {
    try {
      await patientPortalService.removeAllergy(id);
      message.success('Allergy removed');
      loadData();
    } catch {
      message.error('Failed to remove allergy');
    }
  };

  // ─── Family history handlers ──────────────────────────────────────

  const handleAddFamilyHistory = async (values: any) => {
    setSubmitting(true);
    try {
      await patientPortalService.addFamilyHistory({
        relationship: values.relationship,
        memberName: values.memberName,
        condition: values.condition,
        ageOfOnset: values.ageOfOnset,
        isDeceased: values.isDeceased,
        ageAtDeath: values.ageAtDeath,
        notes: values.notes,
      });
      message.success('Family history entry added');
      setFamilyHistoryModalOpen(false);
      familyHistoryForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to add family history');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFamilyHistory = async (id: string) => {
    try {
      await patientPortalService.removeFamilyHistory(id);
      message.success('Family history entry removed');
      loadData();
    } catch {
      message.error('Failed to remove family history');
    }
  };

  // ─── Surgical history handlers ───────────────────────────────────

  const handleAddSurgicalHistory = async (values: any) => {
    setSubmitting(true);
    try {
      await patientPortalService.addSurgicalHistory({
        procedure: values.procedure,
        procedureDate: values.procedureDate ? values.procedureDate.format('YYYY-MM-DD') : undefined,
        surgeon: values.surgeon,
        facility: values.facility,
        bodySite: values.bodySite,
        outcome: values.outcome,
        notes: values.notes,
      });
      message.success('Surgical history entry added');
      setSurgicalModalOpen(false);
      surgicalForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to add surgical history');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSurgicalHistory = async (id: string) => {
    try {
      await patientPortalService.removeSurgicalHistory(id);
      message.success('Surgical history entry removed');
      loadData();
    } catch {
      message.error('Failed to remove surgical history');
    }
  };

  // ─── Social history handlers ─────────────────────────────────────

  const handleAddSocialHistory = async (values: any) => {
    setSubmitting(true);
    try {
      await patientPortalService.addSocialHistory({
        category: values.category,
        status: values.status,
        detail: values.detail,
        frequency: values.frequency,
        amount: values.amount,
        durationYears: values.durationYears,
        quitDate: values.quitDate ? values.quitDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes,
      });
      message.success('Social history entry added');
      setSocialModalOpen(false);
      socialForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to add social history');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSocialHistory = async (id: string) => {
    try {
      await patientPortalService.removeSocialHistory(id);
      message.success('Social history entry removed');
      loadData();
    } catch {
      message.error('Failed to remove social history');
    }
  };

  // ─── AI feature handlers ──────────────────────────────────────────

  const runAiFeature = async (feature: string) => {
    setAiModalOpen(feature);
    setAiResult(null);
    setAiLoading(true);
    try {
      const patientAge = patient?.dateOfBirth
        ? dayjs().diff(dayjs(patient.dateOfBirth), 'year')
        : undefined;

      if (feature === 'extract') {
        if (!freeText.trim()) {
          message.warning('Please enter your health history text first');
          setAiLoading(false);
          return;
        }
        const result = await patientAiService.extractHistoryFromText({
          freeText,
          patientAge,
          patientGender: patient?.gender,
        });
        setAiResult(result);
      } else if (feature === 'risk') {
        if (familyHistory.length === 0) {
          message.warning('Please add family history entries first');
          setAiLoading(false);
          return;
        }
        const result = await patientAiService.assessFamilyHistoryRisk({
          familyHistory: familyHistory.map((fh) => ({
            relationship: fh.relationship,
            condition: fh.condition,
            ageOfOnset: fh.ageOfOnset,
            isDeceased: fh.isDeceased,
            ageAtDeath: fh.ageAtDeath,
          })),
          patientAge,
          patientGender: patient?.gender,
          patientConditions: conditions.map((c) => c.description),
        });
        setAiResult(result);
      } else if (feature === 'summary') {
        const result = await patientAiService.generateHealthSummary({
          conditions: conditions.map((c) => ({
            description: c.description,
            clinicalStatus: c.clinicalStatus,
            onsetDate: c.onsetDate,
            isChronic: c.isChronic,
          })),
          allergies: allergies.map((a) => ({
            allergen: a.allergen,
            reaction: a.reaction,
            severity: a.severity,
          })),
          familyHistory: familyHistory.map((fh) => ({
            relationship: fh.relationship,
            condition: fh.condition,
          })),
          patientAge,
          patientGender: patient?.gender,
        });
        setAiResult(result);
      } else if (feature === 'screenings') {
        const patientAge = patient?.dateOfBirth
          ? dayjs().diff(dayjs(patient.dateOfBirth), 'year')
          : 30;
        const result = await patientAiService.suggestScreenings({
          conditions: conditions.map((c) => ({
            description: c.description,
            isChronic: c.isChronic,
          })),
          familyHistory: familyHistory.map((fh) => ({
            relationship: fh.relationship,
            condition: fh.condition,
            ageOfOnset: fh.ageOfOnset,
          })),
          patientAge,
          patientGender: patient?.gender || 'unknown',
        });
        setAiResult(result);
      }
    } catch {
      message.error('AI feature failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Table columns ────────────────────────────────────────────────

  const conditionColumns = [
    {
      title: 'Condition',
      dataIndex: 'description',
      key: 'description',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.code && <Text type="secondary" style={{ fontSize: 12 }}>{record.codeSystem || 'ICD-10'}: {record.code}</Text>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'clinicalStatus',
      key: 'clinicalStatus',
      render: (status: string) => <Tag color={statusColors[status] || 'default'}>{status}</Tag>,
      width: 100,
    },
    {
      title: 'Verified',
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      render: (status: string) =>
        status === 'confirmed' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">Pending Review</Tag>
        ),
      width: 130,
    },
    {
      title: 'Onset',
      dataIndex: 'onsetDate',
      key: 'onsetDate',
      render: (date: string) => (date ? dayjs(date).format('MMM D, YYYY') : '-'),
      width: 120,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: any) => (
        <Popconfirm
          title="Remove this condition?"
          description="This will remove it from your medical history."
          onConfirm={() => handleRemoveCondition(record.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  const allergyColumns = [
    {
      title: 'Allergen',
      dataIndex: 'allergen',
      key: 'allergen',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => <Tag color={severityColors[severity] || 'default'}>{severity}</Tag>,
      width: 120,
    },
    {
      title: 'Reaction',
      dataIndex: 'reaction',
      key: 'reaction',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'clinicalStatus',
      key: 'clinicalStatus',
      render: (status: string) => <Tag color={statusColors[status] || 'default'}>{status}</Tag>,
      width: 100,
    },
    {
      title: 'Verified',
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      render: (status: string) =>
        status === 'confirmed' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">Pending</Tag>
        ),
      width: 130,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: any) => (
        <Popconfirm
          title="Remove this allergy?"
          onConfirm={() => handleRemoveAllergy(record.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  const familyHistoryColumns = [
    {
      title: 'Relationship',
      dataIndex: 'relationship',
      key: 'relationship',
      render: (rel: string) => <Tag color="cyan">{relationshipLabels[rel] || rel}</Tag>,
      width: 120,
    },
    {
      title: 'Member',
      dataIndex: 'memberName',
      key: 'memberName',
      render: (name: string) => name || '-',
      width: 100,
    },
    {
      title: 'Condition',
      dataIndex: 'condition',
      key: 'condition',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Age of Onset',
      dataIndex: 'ageOfOnset',
      key: 'ageOfOnset',
      render: (age: number) => (age ? `${age} yrs` : '-'),
      width: 110,
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: any, record: any) =>
        record.isDeceased ? (
          <Tag color="default">Deceased{record.ageAtDeath ? ` (${record.ageAtDeath} yrs)` : ''}</Tag>
        ) : (
          <Tag color="green">Living</Tag>
        ),
    },
    {
      title: 'Verified',
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      render: (status: string) =>
        status === 'confirmed' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">Pending</Tag>
        ),
      width: 130,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: any) => (
        <Popconfirm
          title="Remove this family history entry?"
          onConfirm={() => handleRemoveFamilyHistory(record.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  const surgicalColumns = [
    {
      title: 'Procedure',
      dataIndex: 'procedure',
      key: 'procedure',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'procedureDate',
      key: 'procedureDate',
      render: (date: string) => (date ? dayjs(date).format('MMM D, YYYY') : '-'),
      width: 120,
    },
    {
      title: 'Surgeon',
      dataIndex: 'surgeon',
      key: 'surgeon',
      render: (s: string) => s || '-',
      width: 120,
    },
    {
      title: 'Facility',
      dataIndex: 'facility',
      key: 'facility',
      render: (f: string) => f || '-',
      ellipsis: true,
    },
    {
      title: 'Body Site',
      dataIndex: 'bodySite',
      key: 'bodySite',
      render: (b: string) => b || '-',
      width: 100,
    },
    {
      title: 'Outcome',
      dataIndex: 'outcome',
      key: 'outcome',
      render: (o: string) => o ? <Tag color="blue">{o}</Tag> : '-',
      width: 100,
    },
    {
      title: 'Verified',
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      render: (status: string) =>
        status === 'confirmed' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">Pending</Tag>
        ),
      width: 130,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: any) => (
        <Popconfirm
          title="Remove this surgical history entry?"
          onConfirm={() => handleRemoveSurgicalHistory(record.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  const socialCategoryLabels: Record<string, string> = {
    smoking: 'Smoking / Tobacco',
    alcohol: 'Alcohol Use',
    substance_use: 'Substance Use',
    occupation: 'Occupation',
    exercise: 'Exercise / Activity',
    diet: 'Diet',
    caffeine: 'Caffeine Intake',
    sexual_history: 'Sexual History',
    living_situation: 'Living Situation',
    marital_status: 'Marital Status',
    education: 'Education',
    travel: 'Travel',
    safety: 'Safety (smoke alarm, seat belts, etc.)',
    advance_directive: 'Advance Directive',
    other: 'Other',
  };

  const socialCategoryColors: Record<string, string> = {
    smoking: 'red',
    alcohol: 'orange',
    substance_use: 'magenta',
    occupation: 'blue',
    exercise: 'green',
    diet: 'green',
    caffeine: 'gold',
    sexual_history: 'purple',
    living_situation: 'cyan',
    marital_status: 'geekblue',
    education: 'gold',
    travel: 'volcano',
    safety: 'lime',
    advance_directive: 'geekblue',
    other: 'default',
  };

  const socialStatusColors: Record<string, string> = {
    current: 'red',
    former: 'orange',
    never: 'green',
    unknown: 'default',
  };

  const socialColumns = [
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => <Tag color={socialCategoryColors[cat] || 'default'}>{socialCategoryLabels[cat] || cat}</Tag>,
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={socialStatusColors[status] || 'default'}>{status}</Tag>,
      width: 100,
    },
    {
      title: 'Detail',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: 'Frequency / Amount',
      key: 'freqAmount',
      width: 150,
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          {record.frequency && <Text style={{ fontSize: 12 }}>{record.frequency}</Text>}
          {record.amount && <Text style={{ fontSize: 12 }}>{record.amount}</Text>}
          {record.durationYears != null && <Text type="secondary" style={{ fontSize: 12 }}>{record.durationYears} years</Text>}
        </Space>
      ),
    },
    {
      title: 'Quit Date',
      dataIndex: 'quitDate',
      key: 'quitDate',
      render: (date: string) => (date ? dayjs(date).format('MMM D, YYYY') : '-'),
      width: 110,
    },
    {
      title: 'Verified',
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      render: (status: string) =>
        status === 'confirmed' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">Pending</Tag>
        ),
      width: 130,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: any) => (
        <Popconfirm
          title="Remove this social history entry?"
          onConfirm={() => handleRemoveSocialHistory(record.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  // ─── AI feature buttons ───────────────────────────────────────────

  const aiFeatures = [
    {
      key: 'extract',
      icon: <FileSearchOutlined />,
      title: 'AI History Intake',
      description: 'Type or paste your health history in your own words. AI will extract structured data for you.',
      color: '#0D7C8A',
    },
    {
      key: 'risk',
      icon: <ThunderboltOutlined />,
      title: 'Hereditary Risk Assessment',
      description: 'AI analyzes your family history for hereditary risk patterns and recommends screenings.',
      color: '#cf1322',
    },
    {
      key: 'summary',
      icon: <RobotOutlined />,
      title: 'AI Health Summary',
      description: 'Get a plain-language summary of your complete health profile, organized by body system.',
      color: '#722ed1',
    },
    {
      key: 'screenings',
      icon: <ExperimentOutlined />,
      title: 'Screening Recommendations',
      description: 'AI suggests health screenings based on your history, age, and family background.',
      color: '#52c41a',
    },
  ];

  // ─── Render AI result ─────────────────────────────────────────────

  const renderAiResult = () => {
    if (aiLoading) {
      return (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" tip="AI is analyzing..." />
        </div>
      );
    }

    if (!aiResult) return null;

    if (aiModalOpen === 'extract') {
      return (
        <div>
          {aiResult.summary && (
            <Alert
              type="info"
              message="Summary"
              description={aiResult.summary}
              style={{ marginBottom: 16 }}
            />
          )}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic title="Conditions" value={aiResult.conditions?.length || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="Allergies" value={aiResult.allergies?.length || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="Family History" value={aiResult.familyHistory?.length || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="Medications" value={aiResult.medications?.length || 0} />
            </Col>
          </Row>
          <Tag color={aiResult.confidence === 'high' ? 'green' : aiResult.confidence === 'medium' ? 'orange' : 'red'}>
            Confidence: {aiResult.confidence}
          </Tag>
          {aiResult.conditions?.length > 0 && (
            <Card title="Extracted Conditions" size="small" style={{ marginTop: 16 }}>
              {aiResult.conditions.map((c: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Text strong>{c.description}</Text>
                  {c.code && <Tag style={{ marginLeft: 8 }}>{c.code}</Tag>}
                  {c.onsetDate && <Text type="secondary" style={{ fontSize: 12 }}> — {c.onsetDate}</Text>}
                  {c.notes && <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>{c.notes}</Paragraph>}
                </div>
              ))}
            </Card>
          )}
          {aiResult.allergies?.length > 0 && (
            <Card title="Extracted Allergies" size="small" style={{ marginTop: 16 }}>
              {aiResult.allergies.map((a: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Text strong>{a.allergen}</Text>
                  {a.severity && <Tag color={severityColors[a.severity]} style={{ marginLeft: 8 }}>{a.severity}</Tag>}
                  {a.reaction && <Text type="secondary"> — {a.reaction}</Text>}
                </div>
              ))}
            </Card>
          )}
          {aiResult.familyHistory?.length > 0 && (
            <Card title="Extracted Family History" size="small" style={{ marginTop: 16 }}>
              {aiResult.familyHistory.map((fh: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Tag color="cyan">{relationshipLabels[fh.relationship] || fh.relationship}</Tag>
                  <Text strong>{fh.condition}</Text>
                  {fh.ageOfOnset && <Text type="secondary"> — onset at {fh.ageOfOnset}</Text>}
                </div>
              ))}
            </Card>
          )}
          {aiResult.medications?.length > 0 && (
            <Card title="Extracted Medications" size="small" style={{ marginTop: 16 }}>
              {aiResult.medications.map((m: any, i: number) => (
                <div key={i}>
                  <Text strong>{m.name}</Text>
                  {m.dosage && <Text type="secondary"> {m.dosage}</Text>}
                  {m.frequency && <Text type="secondary"> — {m.frequency}</Text>}
                </div>
              ))}
            </Card>
          )}
          <Alert
            type="warning"
            message="Review and Add"
            description="Please review the extracted data above. You can add entries manually using the forms in each tab. The AI extraction is for your reference — always verify with your healthcare provider."
            style={{ marginTop: 16 }}
          />
        </div>
      );
    }

    if (aiModalOpen === 'risk') {
      return (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card>
                <Statistic
                  title="Overall Risk Level"
                  value={aiResult.overallRiskLevel?.replace('_', ' ').toUpperCase()}
                  valueStyle={{
                    color:
                      aiResult.overallRiskLevel === 'very_high' ? '#cf1322' :
                      aiResult.overallRiskLevel === 'high' ? '#fa541c' :
                      aiResult.overallRiskLevel === 'moderate' ? '#faad14' : '#52c41a',
                  }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic title="Risk Score" value={aiResult.riskScore} suffix="/ 100" />
              </Card>
            </Col>
          </Row>

          {aiResult.geneticCounselingRecommended && (
            <Alert
              type="warning"
              message="Genetic Counseling Recommended"
              description={aiResult.geneticCounselingReason}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {aiResult.identifiedRisks?.length > 0 && (
            <Card title="Identified Hereditary Risks" size="small" style={{ marginBottom: 16 }}>
              {aiResult.identifiedRisks.map((risk: any, i: number) => (
                <Card key={i} type="inner" size="small" style={{ marginBottom: 8 }}
                  title={<Space><ThunderboltOutlined style={{ color: '#cf1322' }} />{risk.syndrome}<Tag color={risk.riskLevel === 'very_high' ? 'red' : risk.riskLevel === 'high' ? 'orange' : 'blue'}>{risk.riskLevel}</Tag></Space>}
                >
                  <Paragraph style={{ marginBottom: 4 }}>{risk.reason}</Paragraph>
                  {risk.affectedRelatives?.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <Text type="secondary">Affected relatives: </Text>
                      {risk.affectedRelatives.map((r: string, j: number) => (
                        <Tag key={j} color="cyan">{r}</Tag>
                      ))}
                    </div>
                  )}
                  <Alert type="info" message="Recommendation" description={risk.recommendation} style={{ marginTop: 8 }} />
                </Card>
              ))}
            </Card>
          )}

          {aiResult.recommendedScreenings?.length > 0 && (
            <Card title="Recommended Screenings" size="small" style={{ marginBottom: 16 }}>
              {aiResult.recommendedScreenings.map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Text strong>{s.screening}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{s.reason}</Text>
                  <br />
                  <Space style={{ marginTop: 4 }}>
                    <Tag>Start: {s.recommendedAge}</Tag>
                    <Tag color="blue">{s.frequency}</Tag>
                  </Space>
                </div>
              ))}
            </Card>
          )}

          {aiResult.preventiveMeasures?.length > 0 && (
            <Card title="Preventive Measures" size="small" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={aiResult.preventiveMeasures}
                renderItem={(item: string) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>}
              />
            </Card>
          )}

          <Alert type="warning" message={aiResult.disclaimer} showIcon />
        </div>
      );
    }

    if (aiModalOpen === 'summary') {
      return (
        <div>
          <Card style={{ marginBottom: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Paragraph style={{ fontSize: 15, marginBottom: 0 }}>{aiResult.summary}</Paragraph>
          </Card>

          {aiResult.bodySystems?.length > 0 && (
            <Collapse
              defaultActiveKey={['0']}
              style={{ marginBottom: 16 }}
              items={aiResult.bodySystems.map((bs: any, i: number) => ({
                key: String(i),
                label: <Text strong>{bs.system}</Text>,
                children: (
                  <div>
                    {bs.conditions?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary">Conditions:</Text>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {bs.conditions.map((c: string, j: number) => <li key={j}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                    {bs.recommendations?.length > 0 && (
                      <div>
                        <Text type="secondary">Recommendations:</Text>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {bs.recommendations.map((r: string, j: number) => <li key={j}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            {aiResult.keyTakeaways?.length > 0 && (
              <Col span={12}>
                <Card title="Key Takeaways" size="small">
                  <List
                    size="small"
                    dataSource={aiResult.keyTakeaways}
                    renderItem={(item: string) => <List.Item><InfoCircleOutlined style={{ color: '#0D7C8A', marginRight: 8 }} />{item}</List.Item>}
                  />
                </Card>
              </Col>
            )}
            {aiResult.riskFactors?.length > 0 && (
              <Col span={12}>
                <Card title="Risk Factors" size="small">
                  <List
                    size="small"
                    dataSource={aiResult.riskFactors}
                    renderItem={(item: string) => <List.Item><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />{item}</List.Item>}
                  />
                </Card>
              </Col>
            )}
          </Row>

          {aiResult.recommendedActions?.length > 0 && (
            <Card title="Recommended Actions" size="small" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={aiResult.recommendedActions}
                renderItem={(item: string) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>}
              />
            </Card>
          )}

          <Alert type="warning" message={aiResult.disclaimer} showIcon />
        </div>
      );
    }

    if (aiModalOpen === 'screenings') {
      return (
        <div>
          {aiResult.recommendedScreenings?.length > 0 && (
            <Card title="Recommended Screenings" size="small" style={{ marginBottom: 16 }}>
              <Table
                dataSource={aiResult.recommendedScreenings}
                rowKey={(_: any, i: number) => String(i)}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Screening',
                    dataIndex: 'screening',
                    key: 'screening',
                    render: (text: string) => <Text strong>{text}</Text>,
                  },
                  {
                    title: 'Urgency',
                    dataIndex: 'urgency',
                    key: 'urgency',
                    render: (u: string) => {
                      const colors: Record<string, string> = { urgent: 'red', important: 'orange', recommended: 'blue', routine: 'default' };
                      return <Tag color={colors[u] || 'default'}>{u}</Tag>;
                    },
                    width: 110,
                  },
                  {
                    title: 'Frequency',
                    dataIndex: 'recommendedFrequency',
                    key: 'recommendedFrequency',
                    width: 120,
                  },
                  {
                    title: 'Guideline',
                    dataIndex: 'guidelineSource',
                    key: 'guidelineSource',
                    render: (g: string) => <Tag>{g}</Tag>,
                    width: 100,
                  },
                  {
                    title: 'Reason',
                    dataIndex: 'reason',
                    key: 'reason',
                    ellipsis: true,
                  },
                  {
                    title: 'Related To',
                    dataIndex: 'relatedTo',
                    key: 'relatedTo',
                    ellipsis: true,
                    width: 120,
                  },
                ]}
              />
            </Card>
          )}

          {aiResult.overdueScreenings?.length > 0 && (
            <Card title={<span><ExclamationCircleOutlined style={{ color: '#fa541c', marginRight: 8 }} />Potentially Overdue Screenings</span>} size="small" style={{ marginBottom: 16 }}>
              {aiResult.overdueScreenings.map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Text strong>{s.screening}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{s.reason}</Text>
                  <br />
                  <Tag color="orange">{s.lastRecommended}</Tag>
                </div>
              ))}
            </Card>
          )}

          {aiResult.lifestyleRecommendations?.length > 0 && (
            <Card title="Lifestyle Recommendations" size="small" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={aiResult.lifestyleRecommendations}
                renderItem={(item: string) => <List.Item><HeartOutlined style={{ color: '#0D7C8A', marginRight: 8 }} />{item}</List.Item>}
              />
            </Card>
          )}

          <Alert type="warning" message={aiResult.disclaimer} showIcon />
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <HeartOutlined /> My Health History
      </Title>

      {/* AI Features Section */}
      <Card
        style={{ marginBottom: 24, borderColor: '#0D7C8A', borderWidth: 2 }}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: '#0D7C8A' }} />
            <Text strong style={{ fontSize: 16 }}>AI-Powered Health Insights</Text>
          </Space>
        </div>
        <Row gutter={[12, 12]}>
          {aiFeatures.map((feat) => (
            <Col xs={24} sm={12} lg={6} key={feat.key}>
              <Card
                hoverable
                size="small"
                onClick={() => {
                  if (feat.key === 'extract') {
                    setAiModalOpen('extract');
                    setAiResult(null);
                    setFreeText('');
                  } else {
                    runAiFeature(feat.key);
                  }
                }}
                style={{ height: '100%', borderColor: feat.color, borderWidth: 1 }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space>
                    <span style={{ color: feat.color, fontSize: 18 }}>{feat.icon}</span>
                    <Text strong style={{ fontSize: 13 }}>{feat.title}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>{feat.description}</Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'conditions',
            label: <span><MedicineBoxOutlined /> Conditions ({conditions.length})</span>,
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Your medical conditions and diagnoses. Patient-reported entries are marked as "Pending Review" until verified by your care team.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setConditionModalOpen(true)}>Add Condition</Button>
                </div>
                {conditions.length > 0 ? (
                  <Table dataSource={conditions} columns={conditionColumns} rowKey="id" pagination={false} size="small" />
                ) : (
                  <Card><Empty description="No conditions recorded. Click 'Add Condition' to add your first entry." /></Card>
                )}
              </div>
            ),
          },
          {
            key: 'allergies',
            label: <span><WarningOutlined /> Allergies ({allergies.length})</span>,
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Drug, food, and environmental allergies. This information is critical for your safety.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAllergyModalOpen(true)}>Add Allergy</Button>
                </div>
                {allergies.length > 0 ? (
                  <Table dataSource={allergies} columns={allergyColumns} rowKey="id" pagination={false} size="small" />
                ) : (
                  <Card><Empty description="No allergies recorded. Click 'Add Allergy' to report an allergy." /></Card>
                )}
              </div>
            ),
          },
          {
            key: 'family-history',
            label: <span><TeamOutlined /> Family History ({familyHistory.length})</span>,
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Health conditions of your family members. This helps identify hereditary risk patterns.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setFamilyHistoryModalOpen(true)}>Add Family History</Button>
                </div>
                {familyHistory.length > 0 ? (
                  <Table dataSource={familyHistory} columns={familyHistoryColumns} rowKey="id" pagination={false} size="small" />
                ) : (
                  <Card><Empty description="No family history recorded. Click 'Add Family History' to add information about your family's health." /></Card>
                )}
                {familyHistory.length > 0 && (
                  <Alert
                    type="info"
                    message="AI Risk Assessment Available"
                    description="Click 'Hereditary Risk Assessment' above to have AI analyze your family history for hereditary risk patterns."
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'surgical-history',
            label: <span><FileProtectOutlined /> Surgical History ({surgicalHistory.length})</span>,
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Past surgeries and medical procedures. This information helps your care team understand your complete medical background.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setSurgicalModalOpen(true)}>Add Surgery</Button>
                </div>
                {surgicalHistory.length > 0 ? (
                  <Table dataSource={surgicalHistory} columns={surgicalColumns} rowKey="id" pagination={false} size="small" />
                ) : (
                  <Card><Empty description="No surgical history recorded. Click 'Add Surgery' to report a past surgery or procedure." /></Card>
                )}
              </div>
            ),
          },
          {
            key: 'social-history',
            label: <span><UserOutlined /> Social History ({socialHistory.length})</span>,
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Lifestyle factors: smoking, alcohol, substance use, occupation, exercise, diet, and more. These affect your health risks and treatment choices.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setSocialModalOpen(true)}>Add Social History</Button>
                </div>
                {socialHistory.length > 0 ? (
                  <Table dataSource={socialHistory} columns={socialColumns} rowKey="id" pagination={false} size="small" />
                ) : (
                  <Card><Empty description="No social history recorded. Click 'Add Social History' to report lifestyle information." /></Card>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Add Condition Modal */}
      <Modal
        title="Add Medical Condition"
        open={conditionModalOpen}
        onCancel={() => setConditionModalOpen(false)}
        footer={null}
      >
        <Form form={conditionForm} layout="vertical" onFinish={handleAddCondition}>
          <Form.Item name="description" label="Condition" rules={[{ required: true, message: 'Please enter the condition name' }]}>
            <Input placeholder="e.g., Type 2 Diabetes, Hypertension, Asthma" />
          </Form.Item>
          <Form.Item name="onsetDate" label="Onset Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Any additional details about this condition" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>Add</Button>
              <Button onClick={() => setConditionModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
        <Alert type="info" message="Patient-reported conditions are marked as 'Pending Review' and will be verified by your healthcare provider." showIcon style={{ marginTop: 8 }} />
      </Modal>

      {/* Add Allergy Modal */}
      <Modal
        title="Add Allergy"
        open={allergyModalOpen}
        onCancel={() => setAllergyModalOpen(false)}
        footer={null}
      >
        <Form form={allergyForm} layout="vertical" onFinish={handleAddAllergy} initialValues={{ severity: 'moderate' }}>
          <Form.Item name="allergen" label="Allergen" rules={[{ required: true, message: 'Please enter the allergen' }]}>
            <Input placeholder="e.g., Penicillin, Peanuts, Latex" />
          </Form.Item>
          <Form.Item name="severity" label="Severity">
            <Select options={[
              { value: 'mild', label: 'Mild' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'severe', label: 'Severe' },
              { value: 'life-threatening', label: 'Life-threatening' },
            ]} />
          </Form.Item>
          <Form.Item name="reaction" label="Reaction">
            <Input placeholder="e.g., Hives, Anaphylaxis, Rash" />
          </Form.Item>
          <Form.Item name="onsetDate" label="Onset Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Any additional details" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>Add</Button>
              <Button onClick={() => setAllergyModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Family History Drawer */}
      <Drawer
        title="Add Family History"
        open={familyHistoryModalOpen}
        onClose={() => setFamilyHistoryModalOpen(false)}
        width={480}
        destroyOnClose
      >
        <Form form={familyHistoryForm} layout="vertical" onFinish={handleAddFamilyHistory}>
          <Form.Item name="relationship" label="Relationship" rules={[{ required: true, message: 'Please select a relationship' }]}>
            <Select
              placeholder="Select family member relationship"
              options={Object.entries(relationshipLabels).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="memberName" label="Member Name (optional)">
            <Input placeholder="e.g., John (father)" />
          </Form.Item>
          <Form.Item name="condition" label="Condition" rules={[{ required: true, message: 'Please enter the condition' }]}>
            <Input placeholder="e.g., Breast cancer, Diabetes, Heart disease" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ageOfOnset" label="Age of Onset">
                <InputNumber min={0} max={120} style={{ width: '100%' }} placeholder="e.g., 45" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isDeceased" label="Deceased?">
                <Select options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ageAtDeath" label="Age at Death (if deceased)">
            <InputNumber min={0} max={120} style={{ width: '100%' }} placeholder="e.g., 72" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Any additional details" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>Add</Button>
              <Button onClick={() => setFamilyHistoryModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Add Surgical History Drawer */}
      <Drawer
        title="Add Surgery / Procedure"
        open={surgicalModalOpen}
        onClose={() => setSurgicalModalOpen(false)}
        width={480}
        destroyOnClose
      >
        <Form form={surgicalForm} layout="vertical" onFinish={handleAddSurgicalHistory}>
          <Form.Item name="procedure" label="Procedure" rules={[{ required: true, message: 'Please enter the procedure name' }]}>
            <Input placeholder="e.g., Appendectomy, Knee Replacement, C-Section" />
          </Form.Item>
          <Form.Item name="procedureDate" label="Date of Procedure">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="surgeon" label="Surgeon">
            <Input placeholder="e.g., Dr. Smith" />
          </Form.Item>
          <Form.Item name="facility" label="Facility / Hospital">
            <Input placeholder="e.g., General Hospital" />
          </Form.Item>
          <Form.Item name="bodySite" label="Body Site">
            <Input placeholder="e.g., Right knee, Abdomen" />
          </Form.Item>
          <Form.Item name="outcome" label="Outcome">
            <Select
              allowClear
              placeholder="Select outcome"
              options={[
                { value: 'full_recovery', label: 'Full Recovery' },
                { value: 'partial_recovery', label: 'Partial Recovery' },
                { value: 'ongoing_treatment', label: 'Ongoing Treatment' },
                { value: 'complications', label: 'Complications' },
                { value: 'unknown', label: 'Unknown' },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Any additional details about the procedure" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>Add</Button>
              <Button onClick={() => setSurgicalModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Add Social History Drawer */}
      <Drawer
        title="Add Social History"
        open={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        width={480}
        destroyOnClose
      >
        <Form form={socialForm} layout="vertical" onFinish={handleAddSocialHistory} initialValues={{ status: 'current' }}>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select a category' }]}>
            <Select
              placeholder="Select lifestyle category"
              options={Object.entries(socialCategoryLabels).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={[
              { value: 'current', label: 'Current' },
              { value: 'former', label: 'Former' },
              { value: 'never', label: 'Never' },
              { value: 'unknown', label: 'Unknown' },
            ]} />
          </Form.Item>
          <Form.Item name="detail" label="Details">
            <TextArea rows={2} placeholder="e.g., 'Cigarettes', 'Beer', 'Construction worker', 'Jogging 3x/week'" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="frequency" label="Frequency">
                <Input placeholder="e.g., '1 pack/day', '2 drinks/week'" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label="Amount">
                <Input placeholder="e.g., '20 cigarettes', '6 oz'" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="durationYears" label="Duration (years)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="e.g., 10" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quitDate" label="Quit Date (if applicable)">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Any additional details" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>Add</Button>
              <Button onClick={() => setSocialModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* AI Feature Modal */}
      <Modal
        title={
          aiFeatures.find((f) => f.key === aiModalOpen)?.title || 'AI Feature'
        }
        open={aiModalOpen !== null}
        onCancel={() => { setAiModalOpen(null); setAiResult(null); setFreeText(''); }}
        footer={aiModalOpen === 'extract' && aiResult ? [
          <Button key="close" onClick={() => { setAiModalOpen(null); setAiResult(null); setFreeText(''); }}>Close</Button>,
        ] : null}
        width={800}
      >
        {aiModalOpen === 'extract' && !aiResult && (
          <div>
            <Paragraph type="secondary">
              Type or paste your health history below in your own words. For example:
              <br />
              <em>"I have type 2 diabetes diagnosed in 2015, high blood pressure, and I'm allergic to penicillin which gives me hives. My father had a heart attack at 55 and my grandmother had breast cancer. I take metformin 500mg twice daily and lisinopril 10mg."</em>
            </Paragraph>
            <TextArea
              rows={8}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Enter your health history in your own words..."
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button type="primary" icon={<RobotOutlined />} loading={aiLoading} onClick={() => runAiFeature('extract')}>
                Extract with AI
              </Button>
            </div>
          </div>
        )}
        {renderAiResult()}
      </Modal>
    </div>
  );
};

export default PortalHealthHistoryPage;
