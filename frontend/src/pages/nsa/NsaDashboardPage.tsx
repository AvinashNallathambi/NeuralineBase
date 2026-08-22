import React, { useState, useEffect, useCallback } from "react";
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
  Progress,
  Alert,
  Tabs,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tooltip,
  Divider,
} from "antd";
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  RobotOutlined,
  SendOutlined,
  AuditOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type {
  NsaComplianceDashboard,
  NsaIdrCase,
  NsaIdrDeadline,
  GoodFaithEstimate,
  NsaVarianceRecord,
} from "../../types";
import { nsaService } from "../../services/nsaService";
import { patientService, type Patient } from "../../services/patientService";
import { codesService, type UnifiedCodeResult } from "../../services/codesService";

const { Title, Text } = Typography;

const IDR_STATUS_COLORS: Record<string, string> = {
  open_negotiation: "processing",
  idr_initiated: "warning",
  idr_submitted: "warning",
  won: "success",
  lost: "error",
  withdrawn: "default",
  expired: "default",
  settled: "success",
};

const DEADLINE_STATUS_COLORS: Record<string, string> = {
  upcoming: "default",
  due_soon: "warning",
  overdue: "error",
  met: "success",
  missed: "error",
};

const NsaDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<NsaComplianceDashboard | null>(
    null,
  );
  const [idrCases, setIdrCases] = useState<NsaIdrCase[]>([]);
  const [deadlines, setDeadlines] = useState<NsaIdrDeadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [idrModalOpen, setIdrModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<NsaIdrCase | null>(null);
  const [idrForm] = Form.useForm();
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  // Patient search
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  // CPT code search
  const [cptOptions, setCptOptions] = useState<UnifiedCodeResult[]>([]);
  const [cptSearching, setCptSearching] = useState(false);
  const cptSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // GFE / variance auto-populate
  const [patientGfes, setPatientGfes] = useState<GoodFaithEstimate[]>([]);
  const [patientVariances, setPatientVariances] = useState<NsaVarianceRecord[]>([]);
  const [gfeLoading, setGfeLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, cases, dl] = await Promise.all([
        nsaService.getDashboard(),
        nsaService.listIdrCases(),
        nsaService.getAllDeadlines(),
      ]);
      setDashboard(dash);
      setIdrCases(cases);
      setDeadlines(dl);
    } catch (err: any) {
      message.error(err.message || "Failed to load NSA dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── Patient search (by name or MRN) ────────────────────────────────
  const searchPatients = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setPatients([]);
      return;
    }
    setPatientSearching(true);
    try {
      const data = await patientService.findAll({
        page: 1,
        limit: 50,
        search: query.trim(),
      });
      setPatients(data.data);
    } catch {
      setPatients([]);
    } finally {
      setPatientSearching(false);
    }
  }, []);

  const handlePatientSelect = async (patientId: string) => {
    const p = patients.find((pt) => pt.id === patientId) || null;
    setSelectedPatient(p);
    if (!p) return;
    idrForm.setFieldsValue({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
    });
    // Clear GFE / variance selections from any previous patient
    idrForm.setFieldsValue({ linkGfe: undefined, linkVariance: undefined, gfeId: undefined, varianceRecordId: undefined });
    setPatientGfes([]);
    setPatientVariances([]);
    // Load GFEs and variances for this patient
    setGfeLoading(true);
    try {
      const [gfes, variances] = await Promise.all([
        nsaService.listGfes({ patientId: p.id }),
        nsaService.listVariances(undefined),
      ]);
      setPatientGfes(gfes);
      setPatientVariances(
        variances.filter((v) => v.patientId === p.id),
      );
    } catch {
      setPatientGfes([]);
      setPatientVariances([]);
    } finally {
      setGfeLoading(false);
    }
  };

  // Clear patient selection and dependent data when the dropdown is cleared
  const handlePatientClear = () => {
    setSelectedPatient(null);
    setPatientGfes([]);
    setPatientVariances([]);
    idrForm.setFieldsValue({
      patientId: undefined,
      patientName: undefined,
      linkGfe: undefined,
      linkVariance: undefined,
      gfeId: undefined,
      varianceRecordId: undefined,
      billedAmount: undefined,
      cptCodes: undefined,
      claimId: undefined,
    });
  };

  // ── CPT code search (via unified codes API) ────────────────────────
  const searchCptCodes = useCallback((query: string) => {
    if (cptSearchTimer.current) clearTimeout(cptSearchTimer.current);
    if (!query || query.trim().length < 2) {
      setCptOptions([]);
      return;
    }
    cptSearchTimer.current = setTimeout(async () => {
      setCptSearching(true);
      try {
        const result = await codesService.search(query.trim(), ["CPT", "HCPCS"], 25);
        // Flatten grouped results
        const all: UnifiedCodeResult[] = [];
        if (result.grouped) {
          Object.values(result.grouped).forEach((group) => {
            all.push(...group);
          });
        }
        setCptOptions(all);
      } catch {
        setCptOptions([]);
      } finally {
        setCptSearching(false);
      }
    }, 300);
  }, []);

  // ── GFE / Variance auto-populate helpers ───────────────────────────
  const handleGfeSelect = (gfeId: string) => {
    const gfe = patientGfes.find((g) => g.id === gfeId);
    if (!gfe) return;
    const cptCodes = gfe.items
      .map((item) => item.cptCode)
      .filter(Boolean);
    idrForm.setFieldsValue({
      gfeId: gfe.id,
      patientName: gfe.patientName || idrForm.getFieldValue("patientName"),
      billedAmount: gfe.totalCharge,
      cptCodes,
    });
  };

  const handleVarianceSelect = (varianceId: string) => {
    const variance = patientVariances.find((v) => v.id === varianceId);
    if (!variance) return;
    const cptCodes = variance.perItemVariance
      .map((item) => item.cptCode)
      .filter(Boolean);
    idrForm.setFieldsValue({
      varianceRecordId: variance.id,
      gfeId: variance.gfeId,
      claimId: variance.claimId || idrForm.getFieldValue("claimId"),
      billedAmount: variance.finalBilledAmount,
      cptCodes: cptCodes.length ? cptCodes : idrForm.getFieldValue("cptCodes"),
    });
    if (variance.gfeId && cptCodes.length === 0) {
      handleGfeSelect(variance.gfeId);
    }
  };

  const resetDrawerState = () => {
    setIdrModalOpen(false);
    idrForm.resetFields();
    setPatients([]);
    setSelectedPatient(null);
    setCptOptions([]);
    setPatientGfes([]);
    setPatientVariances([]);
  };

  // ── IDR Case Actions ──────────────────────────────────────────────
  const handleCreateIdrCase = async () => {
    try {
      const values = await idrForm.validateFields();
      // cptCodes is now a string[] from the multi-select, or string[] from GFE auto-populate
      const cptCodes: string[] = Array.isArray(values.cptCodes)
        ? values.cptCodes.filter(Boolean)
        : values.cptCodes
          ? values.cptCodes.split(",").map((c: string) => c.trim()).filter(Boolean)
          : [];
      await nsaService.createIdrCase({
        patientId: values.patientId,
        patientName: values.patientName,
        claimId: values.claimId,
        gfeId: values.gfeId,
        varianceRecordId: values.varianceRecordId,
        payerName: values.payerName,
        billedAmount: values.billedAmount,
        encounterNotes: values.encounterNotes,
        cptCodes,
      });
      message.success("IDR case created");
      resetDrawerState();
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || "Failed to create IDR case");
    }
  };

  const handleAssessEligibility = async (idrCase: NsaIdrCase) => {
    setAiLoading(`eligibility-${idrCase.id}`);
    try {
      const state = prompt("Patient state (e.g., CA, NY, TX):");
      if (!state) return;
      const paidAmount = prompt("Paid amount by payer ($):");
      if (!paidAmount) return;
      await nsaService.assessEligibility(idrCase.id, {
        patientState: state,
        paidAmount: parseFloat(paidAmount),
        serviceType: "emergency",
        isEmergency: true,
        isAirAmbulance: false,
        payerType: "commercial",
      });
      message.success("AI eligibility assessment complete");
      loadData();
    } catch (err: any) {
      message.error(err.message || "Assessment failed");
    } finally {
      setAiLoading(null);
    }
  };

  const handleGenerateOffer = async (idrCase: NsaIdrCase) => {
    setAiLoading(`offer-${idrCase.id}`);
    try {
      await nsaService.generateOffer(idrCase.id);
      message.success("AI open negotiation offer generated");
      loadData();
    } catch (err: any) {
      message.error(err.message || "Offer generation failed");
    } finally {
      setAiLoading(null);
    }
  };

  const handleWinProbability = async (idrCase: NsaIdrCase) => {
    setAiLoading(`win-${idrCase.id}`);
    try {
      await nsaService.predictWinProbability(idrCase.id);
      message.success("AI win probability prediction complete");
      loadData();
    } catch (err: any) {
      message.error(err.message || "Prediction failed");
    } finally {
      setAiLoading(null);
    }
  };

  const handleAcuityLetter = async (idrCase: NsaIdrCase) => {
    setAiLoading(`acuity-${idrCase.id}`);
    try {
      await nsaService.generateAcuityLetter(idrCase.id, { conditions: [] });
      message.success("Patient acuity letter generated");
      loadData();
    } catch (err: any) {
      message.error(err.message || "Letter generation failed");
    } finally {
      setAiLoading(null);
    }
  };

  const idrColumns = [
    { title: "Patient", dataIndex: "patientName", key: "patientName" },
    { title: "Payer", dataIndex: "payerName", key: "payerName" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={IDR_STATUS_COLORS[status]}>{status.replace(/_/g, " ")}</Tag>
      ),
    },
    {
      title: "Jurisdiction",
      dataIndex: "jurisdiction",
      key: "jurisdiction",
      render: (j: string) => <Tag>{j.replace(/_/g, " ").toUpperCase()}</Tag>,
    },
    {
      title: "Billed",
      dataIndex: "billedAmount",
      key: "billedAmount",
      render: (v: number | null) => (v ? `$${v.toFixed(2)}` : "-"),
    },
    {
      title: "QPA",
      dataIndex: "qpaAmount",
      key: "qpaAmount",
      render: (v: number | null) => (v ? `$${v.toFixed(2)}` : "-"),
    },
    {
      title: "Eligibility",
      dataIndex: "eligibilityScore",
      key: "eligibilityScore",
      render: (v: number | null) =>
        v ? <Progress percent={v} size="small" /> : "-",
    },
    {
      title: "Win Prob.",
      dataIndex: "winProbability",
      key: "winProbability",
      render: (v: number | null) =>
        v ? (
          <Progress
            percent={v}
            size="small"
            strokeColor={v > 60 ? "#52c41a" : v > 30 ? "#faad14" : "#ff4d4f"}
          />
        ) : (
          "-"
        ),
    },
    {
      title: "Recovery",
      dataIndex: "expectedRecovery",
      key: "expectedRecovery",
      render: (v: number | null) => (v ? `$${v.toFixed(2)}` : "-"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: NsaIdrCase) => (
        <Space size="small">
          <Tooltip title="AI Eligibility Assessment">
            <Button
              size="small"
              icon={<RobotOutlined />}
              loading={aiLoading === `eligibility-${record.id}`}
              onClick={() => handleAssessEligibility(record)}
            />
          </Tooltip>
          <Tooltip title="AI Generate Offer">
            <Button
              size="small"
              icon={<DollarOutlined />}
              loading={aiLoading === `offer-${record.id}`}
              onClick={() => handleGenerateOffer(record)}
            />
          </Tooltip>
          <Tooltip title="AI Win Probability">
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={aiLoading === `win-${record.id}`}
              onClick={() => handleWinProbability(record)}
            />
          </Tooltip>
          <Tooltip title="AI Acuity Letter">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              loading={aiLoading === `acuity-${record.id}`}
              onClick={() => handleAcuityLetter(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const deadlineColumns = [
    {
      title: "Case",
      dataIndex: "idrCaseId",
      key: "idrCaseId",
      render: (id: string) => id.substring(0, 8),
    },
    {
      title: "Type",
      dataIndex: "deadlineType",
      key: "deadlineType",
      render: (t: string) => <Tag>{t.replace(/_/g, " ")}</Tag>,
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={DEADLINE_STATUS_COLORS[s]}>{s.replace(/_/g, " ")}</Tag>
      ),
    },
    {
      title: "Met",
      dataIndex: "isMet",
      key: "isMet",
      render: (m: boolean) =>
        m ? (
          <CheckCircleOutlined style={{ color: "#52c41a" }} />
        ) : (
          <ClockCircleOutlined style={{ color: "#faad14" }} />
        ),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: NsaIdrDeadline) =>
        !record.isMet && (
          <Button
            size="small"
            type="link"
            onClick={async () => {
              await nsaService.markDeadlineMet(record.id);
              loadData();
            }}
          >
            Mark Met
          </Button>
        ),
    },
  ];

  return (
    <div>
      <Title level={3}>
        <AuditOutlined style={{ marginRight: 8 }} />
        No Surprises Act Compliance Dashboard
      </Title>

      {/* Compliance Metrics */}
      {dashboard && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="Total GFEs"
                value={dashboard.totalGfes}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Delivered"
                value={dashboard.delivered}
                prefix={<SendOutlined />}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Acknowledged"
                value={dashboard.acknowledged}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="On-Time Rate"
                value={dashboard.onTimeDeliveryRate}
                suffix="%"
                valueStyle={{
                  color:
                    dashboard.onTimeDeliveryRate > 90 ? "#52c41a" : "#faad14",
                }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Pending Delivery"
                value={dashboard.pendingDelivery}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: "#faad14" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Overdue"
                value={dashboard.overdueDelivery}
                prefix={<WarningOutlined />}
                valueStyle={{ color: "#ff4d4f" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {dashboard && dashboard.overdueDelivery > 0 && (
        <Alert
          type="error"
          message={`${dashboard.overdueDelivery} GFE(s) are OVERDUE for delivery — NSA compliance violation risk`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {dashboard && dashboard.varianceOverThreshold > 0 && (
        <Alert
          type="warning"
          message={`${dashboard.varianceOverThreshold} variance record(s) exceed the $400 NSA threshold — IDR dispute may be warranted`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        items={[
          {
            key: "idr",
            label: (
              <span>
                <AuditOutlined /> IDR Cases ({idrCases.length})
              </span>
            ),
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIdrModalOpen(true)}
                  >
                    Create IDR Case
                  </Button>
                </div>
                <Table
                  columns={idrColumns}
                  dataSource={idrCases}
                  rowKey="id"
                  loading={loading}
                  size="small"
                />
              </>
            ),
          },
          {
            key: "deadlines",
            label: (
              <span>
                <ClockCircleOutlined /> Deadlines ({deadlines.length})
              </span>
            ),
            children: (
              <Table
                columns={deadlineColumns}
                dataSource={deadlines}
                rowKey="id"
                loading={loading}
                size="small"
              />
            ),
          },
        ]}
      />

      {/* Create IDR Case Drawer */}
      <Drawer
        title="Create IDR Case"
        open={idrModalOpen}
        onClose={resetDrawerState}
        width={520}
        extra={
          <Space>
            <Button onClick={resetDrawerState}>Cancel</Button>
            <Button type="primary" onClick={handleCreateIdrCase}>
              Create
            </Button>
          </Space>
        }
      >
        <Form form={idrForm} layout="vertical">
          <Form.Item
            name="patientId"
            label="Patient"
            rules={[{ required: true, message: "Please select a patient" }]}
          >
            <Select
              showSearch
              allowClear
              placeholder="Search patient by name or MRN…"
              filterOption={false}
              onSearch={searchPatients}
              onChange={(value) => {
                if (value) {
                  handlePatientSelect(value);
                } else {
                  handlePatientClear();
                }
              }}
              loading={patientSearching}
              notFoundContent={
                patientSearching ? "Searching…" : "Type to search"
              }
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} · MRN: ${p.mrn || "N/A"} · DOB: ${p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : "N/A"}`,
              }))}
            />
          </Form.Item>

          {selectedPatient && (
            <div
              style={{
                marginBottom: 16,
                padding: "8px 12px",
                background: "#f6f8fa",
                borderRadius: 6,
                fontSize: 12,
                color: "#666",
              }}
            >
              <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
              {selectedPatient.mrn && ` · MRN: ${selectedPatient.mrn}`}
              {selectedPatient.dateOfBirth && ` · DOB: ${new Date(selectedPatient.dateOfBirth).toLocaleDateString()}`}
              {selectedPatient.gender && ` · ${selectedPatient.gender}`}
            </div>
          )}

          <Divider style={{ margin: "8px 0 16px" }} />

          <Form.Item
            name="linkGfe"
            label="Link to GFE (auto-fills CPT codes, billed amount, patient name)"
          >
            <Select
              placeholder={
                selectedPatient
                  ? "Select a GFE to auto-populate fields"
                  : "Select a patient first to load their GFEs"
              }
              loading={gfeLoading}
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!selectedPatient}
              options={patientGfes.map((g) => ({
                value: g.id,
                label: `GFE v${g.version || 1} — $${g.totalCharge.toFixed(2)} (${g.status})${g.items.length ? ` · ${g.items.map((i) => i.cptCode).filter(Boolean).join(", ")}` : ""}`,
              }))}
              onChange={handleGfeSelect}
              notFoundContent={
                gfeLoading
                  ? "Loading…"
                  : selectedPatient
                    ? "No GFEs found for this patient"
                    : "Select a patient first"
              }
            />
          </Form.Item>

          <Form.Item
            name="linkVariance"
            label="Link to Variance Record (auto-fills CPT codes, billed amount, claim ID)"
          >
            <Select
              placeholder={
                selectedPatient
                  ? "Select a variance record to auto-populate"
                  : "Select a patient first to load variance records"
              }
              loading={gfeLoading}
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!selectedPatient}
              options={patientVariances.map((v) => ({
                value: v.id,
                label: `Variance $${v.varianceAmount.toFixed(2)} (${v.status})${v.exceedsThreshold ? " — OVER $400" : ""} · ${v.perItemVariance.map((i) => i.cptCode).filter(Boolean).join(", ")}`,
              }))}
              onChange={handleVarianceSelect}
              notFoundContent={
                gfeLoading
                  ? "Loading…"
                  : selectedPatient
                    ? "No variance records found for this patient"
                    : "Select a patient first"
              }
            />
          </Form.Item>

          <Divider style={{ margin: "8px 0 16px" }} />

          <Form.Item name="patientName" label="Patient Name">
            <Input placeholder="Auto-filled from patient selection" />
          </Form.Item>
          <Form.Item name="payerName" label="Payer Name">
            <Input placeholder="Insurance company" />
          </Form.Item>
          <Form.Item name="billedAmount" label="Billed Amount">
            <InputNumber prefix="$" style={{ width: "100%" }} step={0.01} />
          </Form.Item>
          <Form.Item name="claimId" label="Claim ID">
            <Input placeholder="Claim UUID (optional)" />
          </Form.Item>
          <Form.Item name="gfeId" label="GFE ID">
            <Input placeholder="Auto-filled from GFE selector" />
          </Form.Item>

          <Form.Item
            name="cptCodes"
            label="CPT / HCPCS Codes"
            extra="Search by code or description — or auto-populated from GFE / variance above"
          >
            <Select
              mode="multiple"
              showSearch
              placeholder="Search CPT / HCPCS codes…"
              filterOption={false}
              onSearch={searchCptCodes}
              loading={cptSearching}
              notFoundContent={
                cptSearching ? "Searching…" : "Type to search CPT codes"
              }
              options={cptOptions.map((c) => ({
                value: c.code,
                label: `${c.code} — ${c.description}`,
              }))}
              tagRender={(props) => (
                <Tag
                  color="blue"
                  closable={props.closable}
                  onClose={props.onClose}
                  style={{ marginRight: 4 }}
                >
                  {props.value}
                </Tag>
              )}
            />
          </Form.Item>

          <Form.Item name="encounterNotes" label="Encounter Notes">
            <Input.TextArea
              rows={4}
              placeholder="Clinical notes from the encounter..."
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

import { PlusOutlined } from "@ant-design/icons";

export default NsaDashboardPage;
