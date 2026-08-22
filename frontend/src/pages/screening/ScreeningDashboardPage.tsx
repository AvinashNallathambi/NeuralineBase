import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Drawer,
  Select,
  message,
  Tooltip,
  Alert,
  Modal,
  Progress,
  Empty,
  Spin,
} from "antd";
import {
  FileTextOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import type {
  ScreeningInstrument,
  ScreeningResult,
  ScreeningDashboard,
} from "../../types";
import { screeningService } from "../../services/screeningService";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

const CATEGORY_COLORS: Record<string, string> = {
  depression: "blue",
  anxiety: "purple",
  substance_use: "orange",
  suicide_risk: "red",
  sdoh: "cyan",
  bipolar: "magenta",
  adhd: "gold",
  cognitive: "geekblue",
  trauma: "volcano",
  sleep: "lime",
  pain: "green",
  pediatric: "pink",
  perinatal: "rose",
  custom: "default",
};

const CATEGORY_LABELS: Record<string, string> = {
  depression: "Depression",
  anxiety: "Anxiety",
  substance_use: "Substance Use",
  suicide_risk: "Suicide Risk",
  sdoh: "SDOH",
  bipolar: "Bipolar",
  adhd: "ADHD",
  cognitive: "Cognitive",
  trauma: "Trauma",
  sleep: "Sleep",
  pain: "Pain",
  pediatric: "Pediatric",
  perinatal: "Perinatal",
  custom: "Custom",
};

const SEVERITY_COLORS: Record<string, string> = {
  minimal: "#52c41a",
  mild: "#faad14",
  moderate: "#fa8c16",
  moderately_severe: "#fa541c",
  severe: "#ff4d4f",
  low: "#52c41a",
  high: "#ff4d4f",
};

const ScreeningDashboardPage: React.FC = () => {
  const [instruments, setInstruments] = useState<ScreeningInstrument[]>([]);
  const [dashboard, setDashboard] = useState<ScreeningDashboard | null>(null);
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState<ScreeningResult | null>(
    null,
  );
  const [administerModal, setAdministerModal] =
    useState<ScreeningInstrument | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [insts, dash] = await Promise.all([
        screeningService.listInstruments(),
        screeningService.getDashboard(),
      ]);
      setInstruments(insts);
      setDashboard(dash);
      setResults(dash.recentResults || []);
    } catch (err: any) {
      message.error(err.message || "Failed to load screening data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeed = async () => {
    try {
      const result = await screeningService.seedInstruments();
      message.success(result.message);
      loadData();
    } catch (err: any) {
      message.error(err.message || "Failed to seed instruments");
    }
  };

  const handleInterpret = async (result: ScreeningResult) => {
    setAiLoading(`interpret-${result.id}`);
    try {
      const interpretation = await screeningService.interpretScore(result.id, {
        age: 0, // Would come from patient context
        sex: "any",
        activeDiagnoses: [],
      });
      setAiInterpretation(interpretation);
    } catch (err: any) {
      message.error(err.message || "AI interpretation failed");
    } finally {
      setAiLoading(null);
    }
  };

  const resultColumns = [
    {
      title: "Patient",
      dataIndex: "patientName",
      key: "patientName",
    },
    {
      title: "Instrument",
      dataIndex: "instrumentTitle",
      key: "instrumentTitle",
      render: (title: string, record: ScreeningResult) => (
        <Space>
          <Text strong>{title}</Text>
          <Tag
            color={
              CATEGORY_COLORS[
                record.instrumentCode.toLowerCase().includes("phq")
                  ? "depression"
                  : "anxiety"
              ]
            }
          >
            {record.instrumentCode}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Score",
      key: "score",
      render: (_: any, record: ScreeningResult) => {
        if (!record.score) return <Text type="secondary">In progress</Text>;
        const color =
          record.score.color ||
          SEVERITY_COLORS[record.score.severity || "minimal"] ||
          "#1890ff";
        return (
          <Space>
            {record.score.totalScore !== null && (
              <Text strong style={{ color }}>
                {record.score.totalScore}
              </Text>
            )}
            <Tag
              color={
                record.score.severity === "severe" ||
                record.score.severity === "high"
                  ? "red"
                  : record.score.severity === "moderate" ||
                      record.score.severity === "moderately_severe"
                    ? "orange"
                    : "green"
              }
            >
              {record.score.interpretation || record.score.category}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const colors: Record<string, string> = {
          completed: "success",
          in_progress: "processing",
          discontinued: "default",
        };
        return <Tag color={colors[status]}>{status.replace(/_/g, " ")}</Tag>;
      },
    },
    {
      title: "Alerts",
      key: "alerts",
      render: (_: any, record: ScreeningResult) => {
        if (record.alerts.length === 0)
          return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
        const critical = record.alerts.filter(
          (a) => a.severity === "critical",
        ).length;
        const warning = record.alerts.filter(
          (a) => a.severity === "warning",
        ).length;
        return (
          <Space>
            {critical > 0 && (
              <Tooltip
                title={record.alerts
                  .filter((a) => a.severity === "critical")
                  .map((a) => a.message)
                  .join("; ")}
              >
                <Tag color="red" icon={<WarningOutlined />}>
                  {critical}
                </Tag>
              </Tooltip>
            )}
            {warning > 0 && (
              <Tooltip
                title={record.alerts
                  .filter((a) => a.severity === "warning")
                  .map((a) => a.message)
                  .join("; ")}
              >
                <Tag color="orange">{warning}</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Date",
      dataIndex: "completedAt",
      key: "completedAt",
      render: (d: string) =>
        d ? (
          dayjs(d).format("YYYY-MM-DD HH:mm")
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: ScreeningResult) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailDrawer(record)}
            />
          </Tooltip>
          {record.status === "completed" && (
            <Tooltip title="AI Interpret Score">
              <Button
                size="small"
                icon={<RobotOutlined />}
                loading={aiLoading === `interpret-${record.id}`}
                onClick={() => handleInterpret(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>
        <ExperimentOutlined style={{ marginRight: 8 }} />
        Screening & Outcome Templates
      </Title>

      {instruments.length === 0 && !loading && (
        <Alert
          type="info"
          message="No screening instruments found"
          description="Click 'Seed Predefined Instruments' to load all 17 validated screening tools (PHQ-9, GAD-7, AUDIT-C, C-SSRS, DAST-10, PRAPARE, and more)."
          showIcon
          action={
            <Button type="primary" onClick={handleSeed}>
              Seed Now
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {dashboard && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={5}>
            <Card>
              <Statistic
                title="Total Screenings"
                value={dashboard.totalScreenings}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="Completed"
                value={dashboard.completedScreenings}
                valueStyle={{ color: "#52c41a" }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="In Progress"
                value={dashboard.inProgressScreenings}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card>
              <Statistic
                title="Critical Alerts"
                value={dashboard.criticalAlerts}
                valueStyle={{ color: "#ff4d4f" }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Instruments"
                value={instruments.length}
                suffix={`(${instruments.filter((i) => i.isPredefined).length} predefined)`}
              />
            </Card>
          </Col>
        </Row>
      )}

      {dashboard && dashboard.byInstrument.length > 0 && (
        <Card title="Screening by Instrument" style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {dashboard.byInstrument.map((item) => (
              <Col key={item.code} span={6}>
                <Card size="small">
                  <Statistic
                    title={item.code}
                    value={item.count}
                    suffix={
                      <span
                        style={{
                          fontSize: 14,
                          color: item.positiveRate > 30 ? "#ff4d4f" : "#faad14",
                        }}
                      >
                        {item.positiveRate}% positive
                      </span>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleSeed}
            loading={loading}
          >
            Seed Predefined Instruments
          </Button>
        </Space>
      </div>

      <Card title="Available Instruments" style={{ marginBottom: 24 }}>
        {loading ? (
          <Spin />
        ) : instruments.length === 0 ? (
          <Empty description="No instruments loaded" />
        ) : (
          <Row gutter={[16, 16]}>
            {instruments.map((inst) => (
              <Col key={inst.id} span={8}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => setAdministerModal(inst)}
                >
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Space>
                      <Text strong>{inst.code}</Text>
                      <Tag color={CATEGORY_COLORS[inst.category]}>
                        {CATEGORY_LABELS[inst.category]}
                      </Tag>
                      {inst.isPredefined && <Tag color="blue">Predefined</Tag>}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {inst.title}
                    </Text>
                    <Space>
                      <Text type="secondary">
                        {inst.questions.length} questions
                      </Text>
                      <Text type="secondary">~{inst.estimatedMinutes} min</Text>
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Card title="Recent Screening Results">
        <Table
          columns={resultColumns}
          dataSource={results}
          rowKey="id"
          loading={loading}
          size="small"
        />
      </Card>

      {/* Result Detail Drawer */}
      <Drawer
        width={560}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        title={
          detailDrawer
            ? `${detailDrawer.instrumentCode} — ${detailDrawer.patientName}`
            : ""
        }
      >
        {detailDrawer && (
          <>
            {detailDrawer.score && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <div style={{ textAlign: "center", padding: 16 }}>
                  {detailDrawer.score.totalScore !== null && (
                    <div
                      style={{
                        fontSize: 36,
                        fontWeight: "bold",
                        color: detailDrawer.score.color || "#1890ff",
                      }}
                    >
                      {detailDrawer.score.totalScore}
                    </div>
                  )}
                  <div style={{ fontSize: 16, marginTop: 8 }}>
                    <Tag
                      color={
                        detailDrawer.score.severity === "severe" ||
                        detailDrawer.score.severity === "high"
                          ? "red"
                          : detailDrawer.score.severity === "moderate" ||
                              detailDrawer.score.severity ===
                                "moderately_severe"
                            ? "orange"
                            : "green"
                      }
                    >
                      {detailDrawer.score.interpretation ||
                        detailDrawer.score.category}
                    </Tag>
                  </div>
                  {detailDrawer.score.recommendation && (
                    <Paragraph style={{ marginTop: 12, color: "#666" }}>
                      {detailDrawer.score.recommendation}
                    </Paragraph>
                  )}
                </div>
              </Card>
            )}

            {detailDrawer.alerts.length > 0 && (
              <>
                {detailDrawer.alerts.map((alert, i) => (
                  <Alert
                    key={i}
                    type={
                      alert.severity === "critical"
                        ? "error"
                        : alert.severity === "warning"
                          ? "warning"
                          : "info"
                    }
                    message={alert.message}
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                ))}
              </>
            )}

            <Title level={5}>Answers</Title>
            {detailDrawer.answers.map((answer, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: 8,
                  background: "#fafafa",
                  borderRadius: 4,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Q{i + 1}: {answer.questionText}
                </Text>
                <div>
                  <Text strong>{answer.answerLabel || answer.answerValue}</Text>
                </div>
              </div>
            ))}
          </>
        )}
      </Drawer>

      {/* Administer Modal (placeholder for starting a screening) */}
      <Modal
        title={administerModal ? `Administer: ${administerModal.title}` : ""}
        open={!!administerModal}
        onCancel={() => setAdministerModal(null)}
        footer={<Button onClick={() => setAdministerModal(null)}>Close</Button>}
        width={600}
      >
        {administerModal && (
          <div>
            <Paragraph>{administerModal.description}</Paragraph>
            <Space>
              <Tag>{administerModal.questions.length} questions</Tag>
              <Tag>~{administerModal.estimatedMinutes} minutes</Tag>
              {administerModal.loincCode && (
                <Tag color="blue">LOINC: {administerModal.loincCode}</Tag>
              )}
            </Space>
            <Paragraph style={{ marginTop: 16, color: "#666" }}>
              To administer this screening, go to a patient's detail page and
              use the Screening tab.
            </Paragraph>
          </div>
        )}
      </Modal>

      {/* AI Interpretation Modal */}
      <Modal
        title="AI Score Interpretation"
        open={!!aiInterpretation}
        onCancel={() => setAiInterpretation(null)}
        footer={
          <Button onClick={() => setAiInterpretation(null)}>Close</Button>
        }
        width={700}
      >
        {aiInterpretation && (
          <>
            <Title level={5}>Plain Language Summary</Title>
            <Paragraph>{aiInterpretation.plainLanguageSummary}</Paragraph>
            <Title level={5}>Clinical Implications</Title>
            <Paragraph>{aiInterpretation.clinicalImplications}</Paragraph>
            {aiInterpretation.recommendedNextSteps?.length > 0 && (
              <>
                <Title level={5}>Recommended Next Steps</Title>
                <ul>
                  {aiInterpretation.recommendedNextSteps.map(
                    (s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ),
                  )}
                </ul>
              </>
            )}
            {aiInterpretation.patientEducationPoints?.length > 0 && (
              <>
                <Title level={5}>Patient Education Points</Title>
                <ul>
                  {aiInterpretation.patientEducationPoints.map(
                    (p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ),
                  )}
                </ul>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ScreeningDashboardPage;
