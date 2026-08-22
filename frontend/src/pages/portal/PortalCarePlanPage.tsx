import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Spin,
  Empty,
  Tag,
  Button,
  Table,
  Space,
  Typography,
  Descriptions,
  Progress,
  Modal,
  Input,
  message,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  AimOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { patientPortalService } from '../../services/patientPortalService';

const { Title, Text, Paragraph } = Typography;

interface CarePlan {
  id: string;
  title: string;
  description?: string;
  status: string;
  category: string;
  addresses: Array<{ condition?: string; description: string; code?: string; codeSystem?: string; icd10Code?: string }>;
  careTeam: Array<{ name: string; role: string }>;
  startDate?: string;
  endDate?: string;
  patientEducation: Array<{ title: string; content: string }>;
  providerName?: string;
}

interface CarePlanGoal {
  id: string;
  description: string;
  targetValue?: string;
  targetUnit?: string;
  currentValue?: string;
  targetDirection?: string;
  status: string;
  priority: string;
  targetDate?: string;
}

interface CarePlanTask {
  id: string;
  title: string;
  description?: string;
  taskType: string;
  status: string;
  assignedTo: string;
  frequency: string;
  dueDate?: string;
  metricName?: string;
  targetValue?: string;
  targetUnit?: string;
  reportedValue?: string;
  reportedAt?: string;
  patientNotes?: string;
}

interface FullCarePlan {
  plan: CarePlan;
  goals: CarePlanGoal[];
  tasks: CarePlanTask[];
}

const taskTypeLabels: Record<string, string> = {
  monitoring: 'Monitoring',
  lab_order: 'Lab Order',
  imaging_order: 'Imaging',
  medication_adherence: 'Med Adherence',
  patient_education: 'Education',
  questionnaire: 'Questionnaire',
  appointment: 'Appointment',
  care_team_action: 'Care Team',
  lifestyle: 'Lifestyle',
  follow_up: 'Follow-Up',
  referral: 'Referral',
  custom: 'Task',
};

const taskStatusColors: Record<string, string> = {
  pending: 'blue',
  in_progress: 'processing',
  completed: 'green',
  cancelled: 'red',
  overdue: 'red',
  no_response: 'orange',
};

const goalStatusColors: Record<string, string> = {
  active: 'blue',
  achieved: 'green',
  not_achieved: 'red',
  suspended: 'orange',
  cancelled: 'default',
};

export default function PortalCarePlanPage() {
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<FullCarePlan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportingTask, setReportingTask] = useState<CarePlanTask | null>(null);
  const [reportValue, setReportValue] = useState('');
  const [reportNotes, setReportNotes] = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientPortalService.getCarePlans();
      setPlans(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleViewPlan = async (planId: string) => {
    setDetailLoading(true);
    try {
      const data = await patientPortalService.getCarePlan(planId);
      setSelectedPlan(data);
    } catch {
      message.error('Failed to load care plan');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReportTask = (task: CarePlanTask) => {
    setReportingTask(task);
    setReportValue(task.reportedValue || '');
    setReportNotes(task.patientNotes || '');
    setReportModalOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!reportingTask || !reportValue.trim()) {
      message.warning('Please enter a value');
      return;
    }
    try {
      await patientPortalService.reportTaskValue(reportingTask.id, reportValue, reportNotes);
      message.success('Reported successfully');
      setReportModalOpen(false);
      if (selectedPlan) handleViewPlan(selectedPlan.plan.id);
    } catch {
      message.error('Failed to submit report');
    }
  };

  const handleCompleteTask = async (task: CarePlanTask) => {
    try {
      await patientPortalService.completeTask(task.id);
      message.success('Task completed');
      if (selectedPlan) handleViewPlan(selectedPlan.plan.id);
    } catch {
      message.error('Failed to complete task');
    }
  };

  if (selectedPlan) {
    const { plan, goals, tasks } = selectedPlan;
    const patientTasks = tasks.filter((t) => t.assignedTo === 'patient');
    const pendingTasks = patientTasks.filter((t) => t.status !== 'completed');

    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => setSelectedPlan(null)}
          style={{ marginBottom: 16 }}
        >
          Back to Care Plans
        </Button>

        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* Plan Header */}
            <Card>
              <Title level={4}>{plan.title}</Title>
              {plan.description && <Paragraph type="secondary">{plan.description}</Paragraph>}
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Category">{plan.category.replace(/_/g, ' ')}</Descriptions.Item>
                <Descriptions.Item label="Provider">{plan.providerName || 'N/A'}</Descriptions.Item>
                {plan.startDate && <Descriptions.Item label="Start">{dayjs(plan.startDate).format('MM/DD/YYYY')}</Descriptions.Item>}
                {plan.endDate && <Descriptions.Item label="End">{dayjs(plan.endDate).format('MM/DD/YYYY')}</Descriptions.Item>}
              </Descriptions>
              {plan.addresses.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text strong>Health Concerns: </Text>
                  {plan.addresses.map((c, i) => (
                    <Tag key={i} color="blue">{c.condition || c.description}</Tag>
                  ))}
                </div>
              )}
              {plan.careTeam.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>Care Team: </Text>
                  {plan.careTeam.map((m, i) => (
                    <Tag key={i}>{m.name} ({m.role})</Tag>
                  ))}
                </div>
              )}
            </Card>

            {/* Pending Tasks (Patient Action Required) */}
            {pendingTasks.length > 0 && (
              <Card title={<span><HeartOutlined /> Your Tasks ({pendingTasks.length})</span>} size="small">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {pendingTasks.map((task) => (
                    <Card key={task.id} size="small" type="inner">
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong>{task.title}</Text>
                          <Tag color={taskStatusColors[task.status]}>{task.status.replace(/_/g, ' ')}</Tag>
                        </div>
                        {task.description && <Text type="secondary">{task.description}</Text>}
                        <Space>
                          <Tag>{taskTypeLabels[task.taskType] || task.taskType}</Tag>
                          <Text type="secondary">Frequency: {task.frequency.replace(/_/g, ' ')}</Text>
                          {task.dueDate && <Text type="secondary">Due: {dayjs(task.dueDate).format('MM/DD/YYYY')}</Text>}
                        </Space>
                        {task.targetValue && (
                          <Text type="secondary">Target: {task.targetValue} {task.targetUnit || ''}</Text>
                        )}
                        {task.reportedValue && (
                          <Text>Last reported: {task.reportedValue} {task.targetUnit || ''} on {task.reportedAt ? dayjs(task.reportedAt).format('MM/DD/YYYY') : 'N/A'}</Text>
                        )}
                        <Space>
                          <Button type="primary" size="small" onClick={() => handleReportTask(task)}>
                            Report Value
                          </Button>
                          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleCompleteTask(task)}>
                            Mark Complete
                          </Button>
                        </Space>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </Card>
            )}

            {/* Goals */}
            <Card title={<span><AimOutlined /> Goals ({goals.length})</span>} size="small">
              {goals.length > 0 ? (
                <Table<CarePlanGoal>
                  dataSource={goals}
                  rowKey="id"
                  pagination={false}
                  size="small"
                >
                  <Table.Column title="Goal" dataIndex="description" key="desc" render={(d: string) => <Text strong>{d}</Text>} />
                  <Table.Column
                    title="Target"
                    key="target"
                    render={(_, g: CarePlanGoal) => g.targetValue ? `${g.targetValue} ${g.targetUnit || ''}` : 'N/A'}
                  />
                  <Table.Column
                    title="Current"
                    key="current"
                    render={(_, g: CarePlanGoal) => g.currentValue ? (
                      <Text style={g.status === 'achieved' ? { color: '#52c41a', fontWeight: 'bold' } : {}}>
                        {g.currentValue} {g.targetUnit || ''}
                      </Text>
                    ) : <Text type="secondary">—</Text>}
                  />
                  <Table.Column
                    title="Progress"
                    key="progress"
                    render={(_, g: CarePlanGoal) => {
                      if (!g.targetValue || !g.currentValue) return null;
                      const target = parseFloat(g.targetValue);
                      const current = parseFloat(g.currentValue);
                      if (isNaN(target) || isNaN(current)) return null;
                      const pct = g.targetDirection === 'decrease'
                        ? Math.min(100, Math.round((target / current) * 100))
                        : g.targetDirection === 'increase'
                        ? Math.min(100, Math.round((current / target) * 100))
                        : 100;
                      return <Progress percent={pct} size="small" status={g.status === 'achieved' ? 'success' : 'active'} />;
                    }}
                  />
                  <Table.Column
                    title="Status"
                    dataIndex="status"
                    key="status"
                    render={(s: string) => <Tag color={goalStatusColors[s]}>{s.replace(/_/g, ' ')}</Tag>}
                  />
                </Table>
              ) : <Empty description="No goals" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </Card>

            {/* Completed Tasks */}
            {patientTasks.filter((t) => t.status === 'completed').length > 0 && (
              <Card title="Completed Tasks" size="small">
                <Table<CarePlanTask>
                  dataSource={patientTasks.filter((t) => t.status === 'completed')}
                  rowKey="id"
                  pagination={false}
                  size="small"
                >
                  <Table.Column title="Task" dataIndex="title" key="title" />
                  <Table.Column title="Type" dataIndex="taskType" key="type" render={(t: string) => taskTypeLabels[t] || t} />
                  <Table.Column title="Last Value" key="val" render={(_, t: CarePlanTask) => t.reportedValue ? `${t.reportedValue} ${t.targetUnit || ''}` : '—'} />
                  <Table.Column title="Completed" dataIndex="completedAt" key="completed" render={(d: string) => d ? dayjs(d).format('MM/DD/YYYY') : '—'} />
                </Table>
              </Card>
            )}

            {/* Patient Education */}
            {plan.patientEducation.length > 0 && (
              <Card title="Patient Education" size="small">
                {plan.patientEducation.map((edu, i) => (
                  <Card key={i} size="small" type="inner" title={edu.title} style={{ marginBottom: 12 }}>
                    <Paragraph>{edu.content}</Paragraph>
                  </Card>
                ))}
              </Card>
            )}
          </Space>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}>My Care Plans</Title>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : plans.length === 0 ? (
        <Card>
          <Empty description="No active care plans. Your care team will assign a care plan when needed." />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {plans.map((plan) => (
            <Card
              key={plan.id}
              hoverable
              onClick={() => handleViewPlan(plan.id)}
            >
              <Title level={5}>{plan.title}</Title>
              {plan.description && <Paragraph type="secondary">{plan.description}</Paragraph>}
              <Space wrap>
                <Tag color="green">Active</Tag>
                <Tag>{plan.category.replace(/_/g, ' ')}</Tag>
                {plan.providerName && <Text type="secondary">Provider: {plan.providerName}</Text>}
              </Space>
              {plan.addresses.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {plan.addresses.map((c, i) => (
                    <Tag key={i} color="blue">{c.condition || c.description}</Tag>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </Space>
      )}

      {/* Report Value Modal */}
      <Modal
        title="Report Your Reading"
        open={reportModalOpen}
        onOk={handleSubmitReport}
        onCancel={() => setReportModalOpen(false)}
        okText="Submit"
      >
        {reportingTask && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text strong>{reportingTask.title}</Text>
              {reportingTask.targetValue && (
                <div><Text type="secondary">Target: {reportingTask.targetValue} {reportingTask.targetUnit || ''}</Text></div>
              )}
            </div>
            <div>
              <Text>Enter your reading ({reportingTask.targetUnit || 'value'}):</Text>
              <Input
                value={reportValue}
                onChange={(e) => setReportValue(e.target.value)}
                placeholder={reportingTask.targetUnit ? `e.g. 120 ${reportingTask.targetUnit}` : 'Enter value'}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Text>Notes (optional):</Text>
              <Input.TextArea
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                rows={2}
                placeholder="How are you feeling? Any symptoms?"
                style={{ marginTop: 4 }}
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
