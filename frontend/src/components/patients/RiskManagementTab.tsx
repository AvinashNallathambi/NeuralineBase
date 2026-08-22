import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  Alert,
  Spin,
  Empty,
  Button,
  Collapse,
  Statistic,
  Tooltip,
  Badge,
  Divider,
  Typography,
  Space,
  List,
  message,
} from 'antd';
import {
  RobotOutlined,
  MedicineBoxOutlined,
  HeartOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type {
  RiskManagementProfile,
  CompositeRisk,
  ClinicalRiskScore,
  MedicationRiskItem,
  CareGap,
} from '../../services/riskManagementService';
import { riskManagementService } from '../../services/riskManagementService';

const { Text, Paragraph } = Typography;

// ── Helpers ────────────────────────────────────────────────────────────────────

const riskColorMap: Record<string, string> = {
  low: '#52c41a',
  moderate: '#faad14',
  moderate_risk: '#faad14',
  high: '#ff4d4f',
  high_risk: '#ff4d4f',
  very_high: '#cf1322',
  critical: '#cf1322',
};

const riskBgColorMap: Record<string, string> = {
  low: '#f6ffed',
  moderate: '#fffbe6',
  moderate_risk: '#fffbe6',
  high: '#fff2f0',
  high_risk: '#fff2f0',
  very_high: '#ffccc7',
  critical: '#ffccc7',
};

const severityIcon = (severity: string) => {
  switch (severity) {
    case 'high':
    case 'critical':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'moderate':
      return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    default:
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  }
};

const priorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'red';
    case 'medium': return 'orange';
    default: return 'blue';
  }
};

const domainColor: Record<string, string> = {
  clinical: 'blue',
  medication: 'purple',
  social: 'cyan',
  behavioral: 'magenta',
};

// ── Sub-Components ──────────────────────────────────────────────────────────────

function CompositeRiskDashboard({ risk }: { risk: CompositeRisk | null }) {
  if (!risk) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<RobotOutlined />}
        message="AI Risk Analysis Unavailable"
        description="The AI risk stratification service is currently unavailable. Clinical risk scores and medication risk are still available below."
      />
    );
  }

  const score = risk.riskScore || 0;
  const color = riskColorMap[risk.riskLevel] || '#faad14';
  const bgColor = riskBgColorMap[risk.riskLevel] || '#fffbe6';

  return (
    <Card
      title={
        <Space>
          <RobotOutlined style={{ color: '#722ed1' }} />
          <span>AI Composite Risk Dashboard</span>
          {risk.careManagementEnrollment && (
            <Tag color="purple" icon={<ThunderboltOutlined />}>Care Management Recommended</Tag>
          )}
        </Space>
      }
      style={{ marginBottom: 16, background: bgColor, borderColor: color }}
    >
      <Row gutter={[24, 16]}>
        {/* Risk Score Gauge */}
        <Col xs={24} sm={8} md={6} style={{ textAlign: 'center' }}>
          <Progress
            type="dashboard"
            percent={score}
            size={160}
            strokeColor={color}
            format={() => (
              <div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color }}>{score}</div>
                <div style={{ fontSize: 12, textTransform: 'uppercase' }}>{risk.riskLevel.replace(/_/g, ' ')}</div>
              </div>
            )}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>Composite Risk Score (0-100)</Text>
        </Col>

        {/* Summary */}
        <Col xs={24} sm={16} md={18}>
          <Paragraph>{risk.summary}</Paragraph>

          {/* Predicted Risks */}
          {risk.predictedRisks && risk.predictedRisks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>Predicted Outcomes:</Text>
              <div style={{ marginTop: 4 }}>
                {risk.predictedRisks.map((pr, i) => (
                  <Tooltip key={i} title={`${pr.timeframe} risk`}>
                    <Tag color={pr.probability && parseInt(pr.probability) >= 20 ? 'red' : 'orange'} style={{ marginBottom: 4 }}>
                      {pr.outcome}: {pr.probability} ({pr.timeframe})
                    </Tag>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {risk.riskFactors && risk.riskFactors.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>Top Risk Factors:</Text>
              <List
                size="small"
                dataSource={risk.riskFactors.slice(0, 8)}
                renderItem={(rf) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space>
                      {severityIcon(rf.severity)}
                      <span>{rf.factor}</span>
                      <Tag color={domainColor[rf.domain] || 'default'} style={{ fontSize: 10 }}>{rf.domain}</Tag>
                      {rf.modifiable && <Tag color="green" style={{ fontSize: 10 }}>Modifiable</Tag>}
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          )}
        </Col>
      </Row>

      {/* AI Recommendations */}
      {risk.recommendations && risk.recommendations.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Text strong><RobotOutlined style={{ color: '#722ed1' }} /> AI Recommendations:</Text>
          <List
            size="small"
            dataSource={risk.recommendations}
            renderItem={(rec) => (
              <List.Item style={{ padding: '6px 0', alignItems: 'flex-start' }}>
                <Space align="start" style={{ width: '100%' }}>
                  <Tag color={priorityColor(rec.priority)} style={{ minWidth: 60, textAlign: 'center', textTransform: 'capitalize' }}>{rec.priority}</Tag>
                  <div>
                    <Text strong>{rec.action}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{rec.rationale}</Text>
                  </div>
                </Space>
              </List.Item>
            )}
          />
        </>
      )}
    </Card>
  );
}

function ClinicalScoresSection({ scores }: { scores: ClinicalRiskScore[] }) {
  if (scores.length === 0) {
    return <Empty description="No applicable clinical risk scores" />;
  }

  return (
    <Row gutter={[12, 12]}>
      {scores.map((score) => {
        const color = riskColorMap[score.riskLevel] || '#faad14';
        const bgColor = riskBgColorMap[score.riskLevel] || '#fffbe6';
        const percent = Math.round((score.score / score.maxScore) * 100);

        return (
          <Col xs={24} sm={12} md={8} key={score.name}>
            <Card
              size="small"
              style={{ borderColor: color, borderWidth: 1, background: bgColor }}
              title={
                <Space>
                  <HeartOutlined style={{ color }} />
                  <span style={{ fontSize: 13 }}>{score.name}</span>
                </Space>
              }
            >
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <Progress
                  percent={percent}
                  strokeColor={color}
                  format={() => `${score.score} / ${score.maxScore}`}
                  size={['100%', 20]}
                />
                <Tag color={color} style={{ marginTop: 4, textTransform: 'capitalize' }}>{score.riskLevel.replace(/_/g, ' ')} Risk</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>{score.description}</Text>
              {score.components && score.components.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {score.components.map((c, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.label}</span>
                      <Tag style={{ fontSize: 10 }}>+{c.points}</Tag>
                    </div>
                  ))}
                </div>
              )}
              <Divider style={{ margin: '8px 0' }} />
              <Text style={{ fontSize: 11 }}>{score.recommendation}</Text>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

function MedicationRiskSection({ items, opioidMme, opioidRiskLevel, polypharmacyCount, highRiskMedications }: {
  items: MedicationRiskItem[];
  opioidMme: number | null;
  opioidRiskLevel: string | null;
  polypharmacyCount: number;
  highRiskMedications: string[];
}) {
  if (items.length === 0) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message="No medication risk alerts"
        description={`${polypharmacyCount} active medication(s) — no significant risk factors detected.`}
      />
    );
  }

  return (
    <div>
      {/* Summary Stats */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Active Meds"
              value={polypharmacyCount}
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: polypharmacyCount >= 10 ? '#ff4d4f' : polypharmacyCount >= 5 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        {opioidMme !== null && (
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Opioid MME/day"
                value={opioidMme}
                suffix="mg"
                prefix={<WarningOutlined />}
                valueStyle={{ color: opioidMme >= 90 ? '#ff4d4f' : opioidMme >= 50 ? '#faad14' : '#52c41a' }}
              />
              {opioidRiskLevel && <Tag color={riskColorMap[opioidRiskLevel] || 'default'} style={{ marginTop: 4 }}>{opioidRiskLevel}</Tag>}
            </Card>
          </Col>
        )}
        {highRiskMedications.length > 0 && (
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="High-Risk Meds"
                value={highRiskMedications.length}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        )}
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Risk Alerts"
              value={items.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: items.length >= 3 ? '#ff4d4f' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Risk Items */}
      <Collapse
        defaultActiveKey={items.map((_, i) => i)}
        items={items.map((item, i) => ({
          key: i,
          label: (
            <Space>
              {severityIcon(item.riskLevel)}
              <Text strong>{item.category}</Text>
              <Tag color={riskColorMap[item.riskLevel] || 'default'} style={{ textTransform: 'capitalize' }}>{item.riskLevel.replace(/_/g, ' ')}</Tag>
            </Space>
          ),
          children: (
            <div>
              <Paragraph>{item.description}</Paragraph>
              {item.medications && item.medications.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">Medications: </Text>
                  {item.medications.map((m, j) => (
                    <Tag key={j} color="purple" style={{ marginBottom: 2 }}>{m}</Tag>
                  ))}
                </div>
              )}
              <Alert type="info" showIcon message="Recommendation" description={item.recommendation} />
            </div>
          ),
        }))}
      />
    </div>
  );
}

function CareGapsSection({ careGaps, qualityMeasures, summary }: {
  careGaps: CareGap[];
  qualityMeasures: any[];
  summary: string | null;
}) {
  if (careGaps.length === 0 && qualityMeasures.length === 0) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message="No care gaps detected"
        description={summary || "All quality measures are up to date."}
      />
    );
  }

  const categoryColors: Record<string, string> = {
    preventive: 'blue',
    chronic_care: 'green',
    medication_safety: 'red',
    lab_monitoring: 'orange',
    imaging: 'cyan',
    immunization: 'purple',
  };

  return (
    <div>
      {summary && <Alert type="info" showIcon message={summary} style={{ marginBottom: 16 }} />}

      {/* Care Gaps */}
      {careGaps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 14 }}>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} /> Care Gaps ({careGaps.length})
          </Text>
          <List
            dataSource={careGaps}
            renderItem={(gap) => (
              <List.Item style={{ padding: '8px 0', alignItems: 'flex-start' }}>
                <Space align="start" style={{ width: '100%' }}>
                  {severityIcon(gap.severity)}
                  <div style={{ flex: 1 }}>
                    <Space>
                      <Text strong>{gap.gap}</Text>
                      <Tag color={categoryColors[gap.category] || 'default'} style={{ fontSize: 10 }}>{gap.category.replace(/_/g, ' ')}</Tag>
                      <Tag color={riskColorMap[gap.severity] || 'default'} style={{ fontSize: 10, textTransform: 'capitalize' }}>{gap.severity}</Tag>
                    </Space>
                    <br />
                    <Text style={{ fontSize: 12 }}>{gap.recommendation}</Text>
                    {gap.guideline && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Guideline: {gap.guideline}</Text>
                      </div>
                    )}
                    {gap.dueDate && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Due: {gap.dueDate}</Text>
                      </div>
                    )}
                  </div>
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}

      {/* Quality Measures */}
      {qualityMeasures.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 14 }}>
            <SafetyCertificateOutlined style={{ color: '#1890ff' }} /> Quality Measures ({qualityMeasures.length})
          </Text>
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            {qualityMeasures.map((qm, i) => {
              const statusColor = qm.status === 'met' ? 'success' : qm.status === 'overdue' ? 'error' : 'warning';
              const statusIcon = qm.status === 'met' ? <CheckCircleOutlined /> : qm.status === 'overdue' ? <CloseCircleOutlined /> : <ExclamationCircleOutlined />;
              return (
                <Col xs={24} sm={12} md={8} key={i}>
                  <Card size="small" style={{ borderColor: qm.status === 'met' ? '#52c41a' : qm.status === 'overdue' ? '#ff4d4f' : '#faad14' }}>
                    <Space>
                      {statusIcon}
                      <Text strong style={{ fontSize: 12 }}>{qm.measure}</Text>
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <Tag color={statusColor} style={{ textTransform: 'capitalize' }}>{qm.status.replace(/_/g, ' ')}</Tag>
                      {qm.lastValue && <Text type="secondary" style={{ fontSize: 11 }}> Last: {qm.lastValue}</Text>}
                      {qm.targetValue && <Text type="secondary" style={{ fontSize: 11 }}> Target: {qm.targetValue}</Text>}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

interface RiskManagementTabProps {
  patientId: string;
}

export default function RiskManagementTab({ patientId }: RiskManagementTabProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RiskManagementProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRiskProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await riskManagementService.getPatientRiskProfile(patientId);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load risk management profile');
      message.error('Failed to load risk profile');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchRiskProfile();
  }, [fetchRiskProfile]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" tip="Analyzing patient risk profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to Load Risk Profile"
        description={error}
        action={<Button onClick={fetchRiskProfile} icon={<ReloadOutlined />}>Retry</Button>}
      />
    );
  }

  if (!profile) {
    return <Empty description="No risk data available" />;
  }

  const tabSections = [
    {
      key: 'ai-dashboard',
      label: (
        <Space>
          <RobotOutlined style={{ color: '#722ed1' }} />
          <span>AI Risk Dashboard</span>
        </Space>
      ),
      children: <CompositeRiskDashboard risk={profile.compositeRisk} />,
    },
    {
      key: 'clinical-scores',
      label: (
        <Space>
          <HeartOutlined style={{ color: '#ff4d4f' }} />
          <span>Clinical Risk Scores ({profile.clinicalScores.length})</span>
        </Space>
      ),
      children: <ClinicalScoresSection scores={profile.clinicalScores} />,
    },
    {
      key: 'medication-risk',
      label: (
        <Space>
          <MedicineBoxOutlined style={{ color: '#722ed1' }} />
          <span>Medication Risk ({profile.medicationRisk.items.length})</span>
          {profile.medicationRisk.items.length > 0 && (
            <Badge count={profile.medicationRisk.items.length} size="small" />
          )}
        </Space>
      ),
      children: (
        <MedicationRiskSection
          items={profile.medicationRisk.items}
          opioidMme={profile.medicationRisk.opioidMme}
          opioidRiskLevel={profile.medicationRisk.opioidRiskLevel}
          polypharmacyCount={profile.medicationRisk.polypharmacyCount}
          highRiskMedications={profile.medicationRisk.highRiskMedications}
        />
      ),
    },
    {
      key: 'care-gaps',
      label: (
        <Space>
          <ExperimentOutlined style={{ color: '#1890ff' }} />
          <span>Care Gaps & Quality ({profile.careGaps.length})</span>
          {profile.careGaps.length > 0 && (
            <Badge count={profile.careGaps.length} size="small" />
          )}
        </Space>
      ),
      children: (
        <CareGapsSection
          careGaps={profile.careGaps}
          qualityMeasures={profile.qualityMeasures}
          summary={profile.careGapSummary}
        />
      ),
    },
  ];

  return (
    <div>
      {/* Header with refresh */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Generated: {new Date(profile.generatedAt).toLocaleString()}
          </Text>
          <Tag>{profile.dataSummary.conditionCount} conditions</Tag>
          <Tag>{profile.dataSummary.medicationCount} medications</Tag>
          <Tag>{profile.dataSummary.allergyCount} allergies</Tag>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchRiskProfile} loading={loading} size="small">
          Refresh
        </Button>
      </div>

      <Collapse
        defaultActiveKey={['ai-dashboard', 'medication-risk']}
        items={tabSections}
      />
    </div>
  );
}
