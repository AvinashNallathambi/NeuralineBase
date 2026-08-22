import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Tooltip,
  Progress,
  Alert,
  Tabs,
  Timeline,
  Descriptions,
  Drawer,
} from "antd";
import {
  MedicineBoxOutlined,
  RobotOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type {
  Episode,
  EpisodeDashboard,
  EpisodeStatus,
  EpisodeType,
} from "../../types";
import { episodeService } from "../../services/episodeService";
import { patientService } from "../../services/patientService";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

const STATUS_COLORS: Record<string, string> = {
  active: "processing",
  onhold: "warning",
  cancelled: "default",
  entered_in_error: "error",
  finished: "success",
  planned: "default",
  waitlist: "default",
};

const TYPE_COLORS: Record<string, string> = {
  acute: "red",
  chronic: "blue",
  episodic: "purple",
  perinatal: "pink",
  surgical: "orange",
  behavioral: "cyan",
  preventive: "green",
};

const TYPE_LABELS: Record<string, string> = {
  acute: "Acute",
  chronic: "Chronic",
  episodic: "Episodic",
  perinatal: "Perinatal",
  surgical: "Surgical",
  behavioral: "Behavioral",
  preventive: "Preventive",
};

const EpisodesDashboardPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [dashboard, setDashboard] = useState<EpisodeDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState<Episode | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [summaryModal, setSummaryModal] = useState<{
    summary: string;
    keyEvents: string[];
    outcomes: string;
    recommendations: string[];
  } | null>(null);
  const [createForm] = Form.useForm();
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const patientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced server-side patient search
  const searchPatients = useCallback((query: string) => {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    if (!query || query.trim().length < 2) return;
    patientSearchTimer.current = setTimeout(async () => {
      setPatientsLoading(true);
      try {
        const response = await patientService.findAll({
          page: 1,
          limit: 50,
          search: query.trim(),
        });
        setPatients(response.data);
      } catch {
        // keep existing list
      } finally {
        setPatientsLoading(false);
      }
    }, 300);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eps, dash] = await Promise.all([
        episodeService.list(),
        episodeService.getDashboard(),
      ]);
      setEpisodes(eps);
      setDashboard(dash);
    } catch (err: any) {
      message.error(err.message || "Failed to load episodes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const patient = patients.find((p) => p.id === values.patientId);
      const patientName = patient
        ? `${patient.firstName} ${patient.lastName}`
        : values.patientName || "";
      await episodeService.create({
        patientId: values.patientId,
        patientName,
        title: values.title,
        description: values.description,
        episodeType: values.episodeType,
        startDate: values.startDate.format("YYYY-MM-DD"),
        tags: values.tags
          ? values.tags.split(",").map((t: string) => t.trim())
          : [],
        notes: values.notes,
      });
      message.success("Episode created");
      setCreateModalOpen(false);
      createForm.resetFields();
      setPatients([]);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || "Failed to create episode");
    }
  };

  const handlePredictCost = async (episode: Episode) => {
    setAiLoading(`cost-${episode.id}`);
    try {
      await episodeService.predictCost(episode.id);
      message.success("AI cost prediction complete");
      loadData();
    } catch (err: any) {
      message.error(err.message || "Prediction failed");
    } finally {
      setAiLoading(null);
    }
  };

  const handleDetectDeviations = async (episode: Episode) => {
    setAiLoading(`deviation-${episode.id}`);
    try {
      await episodeService.detectDeviations(episode.id);
      message.success("AI pathway deviation analysis complete");
      loadData();
    } catch (err: any) {
      message.error(err.message || "Detection failed");
    } finally {
      setAiLoading(null);
    }
  };

  const handleGenerateSummary = async (episode: Episode) => {
    setAiLoading(`summary-${episode.id}`);
    try {
      const result = await episodeService.generateSummary(episode.id);
      setSummaryModal(result);
    } catch (err: any) {
      message.error(err.message || "Summary generation failed");
    } finally {
      setAiLoading(null);
    }
  };

  const columns = [
    {
      title: "Patient",
      dataIndex: "patientName",
      key: "patientName",
    },
    {
      title: "Episode",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: Episode) => (
        <Space>
          <Text strong>{title}</Text>
          <Tag color={TYPE_COLORS[record.episodeType]}>
            {TYPE_LABELS[record.episodeType]}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status]}>{status.replace(/_/g, " ")}</Tag>
      ),
    },
    {
      title: "Conditions",
      dataIndex: "conditions",
      key: "conditions",
      render: (conditions: any[]) =>
        conditions.length > 0 ? (
          <Space wrap size="small">
            {conditions.slice(0, 2).map((c, i) => (
              <Tag key={i} color="blue">
                {c.code}
              </Tag>
            ))}
            {conditions.length > 2 && (
              <Text type="secondary">+{conditions.length - 2}</Text>
            )}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "Encounters",
      dataIndex: "encounterIds",
      key: "encounterIds",
      render: (ids: string[]) => ids.length,
    },
    {
      title: "Start",
      dataIndex: "startDate",
      key: "startDate",
      render: (d: string) => dayjs(d).format("YYYY-MM-DD"),
    },
    {
      title: "Cost",
      key: "cost",
      render: (_: any, record: Episode) => {
        if (record.costSummary?.totalCost)
          return `$${record.costSummary.totalCost.toFixed(0)}`;
        if (record.aiInsights?.predictedTotalCost)
          return (
            <Tooltip title="AI Predicted">
              <Text type="secondary">
                ~${record.aiInsights.predictedTotalCost.toFixed(0)}
              </Text>
            </Tooltip>
          );
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: "Risk",
      key: "risk",
      render: (_: any, record: Episode) => {
        const score = record.aiInsights?.riskScore;
        if (score === null || score === undefined)
          return <Text type="secondary">-</Text>;
        return (
          <Progress
            percent={score}
            size="small"
            strokeColor={
              score > 60 ? "#ff4d4f" : score > 30 ? "#faad14" : "#52c41a"
            }
          />
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Episode) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="AI Cost Prediction">
            <Button
              size="small"
              icon={<DollarOutlined />}
              loading={aiLoading === `cost-${record.id}`}
              onClick={() => handlePredictCost(record)}
            />
          </Tooltip>
          <Tooltip title="AI Pathway Deviation">
            <Button
              size="small"
              icon={<WarningOutlined />}
              loading={aiLoading === `deviation-${record.id}`}
              onClick={() => handleDetectDeviations(record)}
            />
          </Tooltip>
          <Tooltip title="AI Episode Summary">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              loading={aiLoading === `summary-${record.id}`}
              onClick={() => handleGenerateSummary(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>
        <MedicineBoxOutlined style={{ marginRight: 8 }} />
        Episode Management
      </Title>

      {dashboard && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="Total Episodes"
                value={dashboard.totalEpisodes}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Active"
                value={dashboard.activeEpisodes}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Finished"
                value={dashboard.finishedEpisodes}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Avg Duration"
                value={dashboard.averageDurationDays}
                suffix="days"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Avg Cost"
                value={dashboard.averageCost}
                prefix="$"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="High Risk"
                value={dashboard.highRiskEpisodes}
                valueStyle={{ color: "#ff4d4f" }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          Create Episode
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={episodes}
          rowKey="id"
          loading={loading}
          size="small"
        />
      </Card>

      {/* Create Episode Drawer */}
      <Drawer
        title="Create Episode of Care"
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        width={480}
        extra={
          <Space>
            <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleCreate}>
              Create
            </Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="patientId"
            label="Patient"
            rules={[{ required: true, message: "Select a patient" }]}
          >
            <Select
              allowClear
              showSearch
              placeholder="Search patient by name or MRN…"
              filterOption={false}
              onSearch={searchPatients}
              loading={patientsLoading}
              options={patients.map((p) => ({
                label: `${p.firstName} ${p.lastName} · MRN: ${p.mrn || "N/A"} · DOB: ${p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : "N/A"}`,
                value: p.id,
              }))}
              notFoundContent={
                patientsLoading ? "Searching…" : "Type to search"
              }
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="Episode Title"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g., Type 2 Diabetes Management" />
          </Form.Item>
          <Form.Item
            name="episodeType"
            label="Episode Type"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select type">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <Select.Option key={key} value={key}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="startDate"
            label="Start Date"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Episode description..." />
          </Form.Item>
          <Form.Item name="tags" label="Tags (comma-separated)">
            <Input placeholder="chronic, high-priority, value-based" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Episode Detail Drawer */}
      <Drawer
        width={640}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        title={detailDrawer ? detailDrawer.title : ""}
      >
        {detailDrawer && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Patient">
                {detailDrawer.patientName}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={TYPE_COLORS[detailDrawer.episodeType]}>
                  {TYPE_LABELS[detailDrawer.episodeType]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLORS[detailDrawer.status]}>
                  {detailDrawer.status.replace(/_/g, " ")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Start">
                {dayjs(detailDrawer.startDate).format("YYYY-MM-DD")}
              </Descriptions.Item>
              {detailDrawer.endDate && (
                <Descriptions.Item label="End">
                  {dayjs(detailDrawer.endDate).format("YYYY-MM-DD")}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Encounters">
                {detailDrawer.encounterIds.length}
              </Descriptions.Item>
            </Descriptions>

            {detailDrawer.conditions.length > 0 && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>
                  Conditions
                </Title>
                <Space wrap>
                  {detailDrawer.conditions.map((c, i) => (
                    <Tag key={i} color={c.isPrimary ? "red" : "blue"}>
                      {c.code} — {c.description}
                    </Tag>
                  ))}
                </Space>
              </>
            )}

            {detailDrawer.aiInsights && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>
                  AI Insights
                </Title>
                {detailDrawer.aiInsights.riskScore !== null && (
                  <div style={{ marginBottom: 8 }}>
                    <Text>Risk Score: </Text>
                    <Progress
                      percent={detailDrawer.aiInsights.riskScore}
                      size="small"
                      style={{ width: 200 }}
                    />
                  </div>
                )}
                {detailDrawer.aiInsights.predictedTotalCost !== null && (
                  <div style={{ marginBottom: 8 }}>
                    <Text>Predicted Total Cost: </Text>
                    <Text strong>
                      ${detailDrawer.aiInsights.predictedTotalCost.toFixed(2)}
                    </Text>
                  </div>
                )}
                {detailDrawer.aiInsights.pathwayDeviations.length > 0 && (
                  <Alert
                    type="warning"
                    message="Pathway Deviations Detected"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {detailDrawer.aiInsights.pathwayDeviations.map(
                          (d, i) => (
                            <li key={i}>{d}</li>
                          ),
                        )}
                      </ul>
                    }
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                )}
                {detailDrawer.aiInsights.recommendedActions.length > 0 && (
                  <Alert
                    type="info"
                    message="Recommended Actions"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {detailDrawer.aiInsights.recommendedActions.map(
                          (a, i) => (
                            <li key={i}>{a}</li>
                          ),
                        )}
                      </ul>
                    }
                    showIcon
                  />
                )}
              </>
            )}

            {detailDrawer.timeline.length > 0 && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>
                  Timeline
                </Title>
                <Timeline
                  items={detailDrawer.timeline.map((event) => ({
                    color:
                      event.type === "encounter"
                        ? "blue"
                        : event.type === "lab"
                          ? "purple"
                          : "gray",
                    children: (
                      <div>
                        <Text strong>{event.title}</Text>
                        <div>
                          <Text type="secondary">
                            {dayjs(event.date).format("YYYY-MM-DD HH:mm")}
                          </Text>
                        </div>
                        {event.description && (
                          <div>
                            <Text type="secondary">{event.description}</Text>
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              </>
            )}

            {detailDrawer.costSummary && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>
                  Cost Summary
                </Title>
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="Encounters">
                    ${detailDrawer.costSummary.totalEncounterCost.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Labs">
                    ${detailDrawer.costSummary.totalLabCost.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Imaging">
                    ${detailDrawer.costSummary.totalImagingCost.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Medications">
                    ${detailDrawer.costSummary.totalMedicationCost.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total">
                    <Text strong>
                      ${detailDrawer.costSummary.totalCost.toFixed(2)}
                    </Text>
                  </Descriptions.Item>
                  {detailDrawer.costSummary.estimatedCost !== null && (
                    <Descriptions.Item label="Estimated">
                      ${detailDrawer.costSummary.estimatedCost.toFixed(2)}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* AI Summary Modal */}
      <Modal
        title="AI Episode Summary"
        open={!!summaryModal}
        onCancel={() => setSummaryModal(null)}
        footer={<Button onClick={() => setSummaryModal(null)}>Close</Button>}
        width={700}
      >
        {summaryModal && (
          <>
            <Paragraph>{summaryModal.summary}</Paragraph>
            {summaryModal.keyEvents.length > 0 && (
              <>
                <Title level={5}>Key Events</Title>
                <ul>
                  {summaryModal.keyEvents.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            )}
            <Title level={5}>Outcomes</Title>
            <Paragraph>{summaryModal.outcomes}</Paragraph>
            {summaryModal.recommendations.length > 0 && (
              <>
                <Title level={5}>Recommendations</Title>
                <ul>
                  {summaryModal.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default EpisodesDashboardPage;
