import React, { useEffect, useState } from "react";
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Tag,
  Avatar,
  List,
  Space,
  Badge,
  Statistic,
  Table,
  Tooltip,
  message,
  Modal,
  Spin,
  Descriptions,
} from "antd";
import {
  VideoCameraOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  VideoCameraAddOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  UserOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import type { Appointment } from "../../types";
import { useAppointmentStore } from "../../store/dataStore";
import { useAuthStore } from "../../store";
import {
  telemedicineService,
  TelemedicineSession,
} from "../../services/telemedicineService";
import { appointmentService } from "../../services/appointmentService";
import VideoRoom from "../../components/telemedicine/VideoRoom";

const { Title, Text, Paragraph } = Typography;

const statusColor = (status: string) => {
  switch (status) {
    case "confirmed":
      return "green";
    case "scheduled":
      return "blue";
    case "in_progress":
      return "orange";
    case "completed":
      return "default";
    case "cancelled":
      return "red";
    default:
      return "default";
  }
};

const sessionStatusColor = (status: string) => {
  switch (status) {
    case "scheduled":
      return "blue";
    case "waiting":
      return "orange";
    case "in_progress":
      return "green";
    case "completed":
      return "default";
    case "cancelled":
      return "red";
    case "no_show":
      return "volcano";
    default:
      return "default";
  }
};

const TelemedicinePage: React.FC = () => {
  const {
    appointments,
    loading: appointmentsLoading,
    fetchAppointments,
  } = useAppointmentStore();
  const { user } = useAuthStore();

  const [activeSession, setActiveSession] =
    useState<TelemedicineSession | null>(null);
  const [activeAppointment, setActiveAppointment] =
    useState<Appointment | null>(null);
  const [sessionToken, setSessionToken] = useState<{
    token: string;
    roomUrl: string;
    roomId: string;
  } | null>(null);
  const [postVisitSession, setPostVisitSession] =
    useState<TelemedicineSession | null>(null);
  const [analytics, setAnalytics] = useState<{
    averageDurationMinutes: number;
    totalSessions: number;
    completedSessions: number;
  } | null>(null);
  const [waitingSessions, setWaitingSessions] = useState<TelemedicineSession[]>(
    [],
  );
  const [loadingSession, setLoadingSession] = useState(false);
  const [carePlanModalVisible, setCarePlanModalVisible] = useState(false);
  const [carePlan, setCarePlan] = useState<any>(null);
  const [loadingCarePlan, setLoadingCarePlan] = useState(false);

  useEffect(() => {
    fetchAppointments({ limit: 200 });
    loadAnalytics();
    loadWaitingSessions();
  }, []);

  const telehealthAppointments = appointments.filter((a) => a.isTelehealth);
  const todayTelehealthAppointments = telehealthAppointments.filter(
    (a) =>
      a.status === "confirmed" ||
      a.status === "scheduled" ||
      a.status === "in_progress",
  );
  const pastVirtualVisits = telehealthAppointments.filter(
    (a) => a.status === "completed",
  );

  const loadAnalytics = async () => {
    try {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const data = await telemedicineService.getAnalytics({
        startDate: start.toISOString(),
        endDate: new Date().toISOString(),
      });
      setAnalytics(data);
    } catch (error: any) {
      console.error("Failed to load analytics:", error);
    }
  };

  const loadWaitingSessions = async () => {
    try {
      const data = await telemedicineService.listSessions({
        status: "waiting",
        limit: 50,
      });
      setWaitingSessions(data.data);
    } catch (error: any) {
      console.error("Failed to load waiting sessions:", error);
    }
  };

  const handleStartVisit = async (appointment: Appointment) => {
    setLoadingSession(true);
    try {
      const session = await telemedicineService.createSession({
        appointmentId: appointment.id,
        patientId: appointment.patientId || "",
        providerId: user?.id || appointment.providerId || "",
      });

      // Update the appointment so the patient portal can navigate to the visit
      await appointmentService.update(appointment.id, {
        location: {
          type: "telehealth",
          meetingLink: `/portal/visit/${session.id}`,
          meetingId: session.id,
        },
      });

      const token = await telemedicineService.getToken(session.id, "provider");

      setActiveSession(session);
      setActiveAppointment(appointment);
      setSessionToken(token);
      setPostVisitSession(null);
    } catch (error: any) {
      message.error(
        error.response?.data?.message || "Failed to start virtual visit",
      );
    } finally {
      setLoadingSession(false);
    }
  };

  const handleAdmitFromWaiting = async (session: TelemedicineSession) => {
    setLoadingSession(true);
    try {
      const token = await telemedicineService.getToken(session.id, "provider");
      setActiveSession(session);
      setActiveAppointment(null);
      setSessionToken(token);
      setPostVisitSession(null);
    } catch (error: any) {
      message.error(error.response?.data?.message || "Failed to admit patient");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleEndCall = async () => {
    if (!activeSession) return;
    setLoadingSession(true);
    try {
      const ended = await telemedicineService.endSession(activeSession.id, {
        generateEncounter: true,
        generateSuperbill: true,
      });
      message.success("Visit ended. Encounter and superbill generated.");
      setPostVisitSession(ended);
      setActiveSession(null);
      setActiveAppointment(null);
      setSessionToken(null);
      fetchAppointments({ limit: 200 });
      loadAnalytics();
      loadWaitingSessions();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Failed to end session");
    } finally {
      setLoadingSession(false);
    }
  };

  const handleViewCarePlan = async (sessionId: string) => {
    setLoadingCarePlan(true);
    setCarePlanModalVisible(true);
    try {
      const data = await telemedicineService.postVisitCarePlan(sessionId);
      setCarePlan(data);
    } catch (error: any) {
      message.error("Failed to load care plan");
    } finally {
      setLoadingCarePlan(false);
    }
  };

  const pastVisitColumns = [
    {
      title: "Date",
      dataIndex: "startTime",
      key: "date",
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    { title: "Patient", dataIndex: "patientName", key: "patient" },
    {
      title: "Duration",
      key: "duration",
      render: (_: unknown, record: Appointment) => {
        if (!record.endTime) return "-";
        const mins = Math.round(
          (new Date(record.endTime).getTime() -
            new Date(record.startTime).getTime()) /
            60000,
        );
        return `${mins} min`;
      },
    },
    {
      title: "Notes",
      key: "notes",
      render: (_: unknown, record: Appointment) =>
        record.notes ? (
          <Tooltip title={record.notes}>
            <Button type="link" size="small" icon={<FileTextOutlined />}>
              View
            </Button>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  if (activeSession && sessionToken) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleEndCall}
          style={{ marginBottom: 16 }}
        >
          End Visit & Back to Dashboard
        </Button>
        <VideoRoom
          sessionId={activeSession.id}
          roomId={sessionToken.roomId}
          userId={user?.id || ""}
          role="provider"
          userName={
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            user?.email ||
            "Provider"
          }
          token={sessionToken.token}
          onEndCall={handleEndCall}
        />
      </div>
    );
  }

  return (
    <Spin spinning={loadingSession} tip="Starting virtual visit...">
      <div>
        {/* Header */}
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 24 }}
        >
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <VideoCameraOutlined
                style={{ marginRight: 12, color: "#0D7C8A" }}
              />
              Telemedicine
            </Title>
          </Col>
          <Col>
            <Button
              type="primary"
              size="large"
              icon={<ReloadOutlined />}
              style={{ borderRadius: 8, marginRight: 8 }}
              onClick={() => {
                fetchAppointments({ limit: 200 });
                loadWaitingSessions();
                loadAnalytics();
              }}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<VideoCameraAddOutlined />}
              style={{ borderRadius: 8 }}
              onClick={() => {
                if (todayTelehealthAppointments.length > 0) {
                  handleStartVisit(todayTelehealthAppointments[0]);
                } else {
                  message.info(
                    "No telehealth appointments today. Schedule one first.",
                  );
                }
              }}
            >
              Start Virtual Visit
            </Button>
          </Col>
        </Row>

        {/* Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <Statistic
                title="Virtual Visits Today"
                value={todayTelehealthAppointments.length}
                prefix={<VideoCameraOutlined style={{ color: "#0D7C8A" }} />}
                valueStyle={{ color: "#0D7C8A" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <Statistic
                title="Average Duration (30d)"
                value={analytics?.averageDurationMinutes || 0}
                suffix="min"
                prefix={<FieldTimeOutlined style={{ color: "#36CFC9" }} />}
                valueStyle={{ color: "#36CFC9" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <Statistic
                title="Patients Waiting"
                value={waitingSessions.length}
                prefix={<TeamOutlined style={{ color: "#FF7A45" }} />}
                valueStyle={{ color: "#FF7A45" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Post-visit summary */}
        {postVisitSession && (
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text strong>Visit Completed</Text>
              </Space>
            }
            style={{ marginBottom: 24, borderRadius: 12 }}
            extra={
              <Space>
                {postVisitSession.encounterId && (
                  <Button
                    type="link"
                    href={`/clinical/encounters/${postVisitSession.encounterId}`}
                  >
                    View Encounter
                  </Button>
                )}
                {postVisitSession.superbillId && (
                  <Button
                    type="link"
                    href={`/superbills/${postVisitSession.superbillId}`}
                  >
                    View Superbill
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<MedicineBoxOutlined />}
                  onClick={() => handleViewCarePlan(postVisitSession.id)}
                >
                  AI Care Plan
                </Button>
              </Space>
            }
          >
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Duration">
                {postVisitSession.durationMinutes} min
              </Descriptions.Item>
              <Descriptions.Item label="Room">
                {postVisitSession.roomId}
              </Descriptions.Item>
              <Descriptions.Item label="AI SOAP Subjective" span={2}>
                {postVisitSession.soapNote?.subjective || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="AI SOAP Objective" span={2}>
                {postVisitSession.soapNote?.objective || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="AI Assessment" span={2}>
                {postVisitSession.soapNote?.assessment || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="AI Plan" span={2}>
                {postVisitSession.soapNote?.plan || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Suggested Diagnoses" span={2}>
                {postVisitSession.suggestedCodes?.diagnoses?.map((d) => (
                  <Tag key={d.code} color="blue">
                    {d.code} — {d.description}
                  </Tag>
                )) || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Suggested Procedures" span={2}>
                {postVisitSession.suggestedCodes?.procedures?.map((p) => (
                  <Tag key={p.code} color="cyan">
                    {p.code} — {p.description}
                  </Tag>
                )) || "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            {/* Today's Virtual Appointments */}
            <Card
              title={
                <Space>
                  <CalendarOutlined style={{ color: "#0D7C8A" }} />
                  <Text strong>Today's Virtual Appointments</Text>
                  <Badge
                    count={todayTelehealthAppointments.length}
                    style={{ backgroundColor: "#0D7C8A" }}
                  />
                </Space>
              }
              bordered={false}
              style={{ marginBottom: 16, borderRadius: 12 }}
            >
              <List
                dataSource={todayTelehealthAppointments}
                renderItem={(apt) => (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        icon={<VideoCameraOutlined />}
                        onClick={() => handleStartVisit(apt)}
                        style={{ borderRadius: 8 }}
                      >
                        Start Visit
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={<UserOutlined />}
                          style={{ backgroundColor: "#0D7C8A" }}
                        />
                      }
                      title={
                        <Space>
                          <Text strong>{apt.patientName}</Text>
                          <Tag color={statusColor(apt.status)}>
                            {apt.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {new Date(apt.startTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            -{" "}
                            {new Date(apt.endTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                          <Text type="secondary">{apt.reason}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
                locale={{
                  emptyText: appointmentsLoading
                    ? "Loading..."
                    : "No virtual appointments today",
                }}
              />
            </Card>

            {/* Past Virtual Visits */}
            <Card
              title={
                <Space>
                  <FileTextOutlined style={{ color: "#0D7C8A" }} />
                  <Text strong>Past Virtual Visits</Text>
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12 }}
            >
              <Table
                dataSource={pastVirtualVisits}
                columns={pastVisitColumns}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            {/* Waiting Room */}
            <Card
              title={
                <Space>
                  <TeamOutlined style={{ color: "#FF7A45" }} />
                  <Text strong>Waiting Room</Text>
                  <Badge
                    count={waitingSessions.length}
                    style={{ backgroundColor: "#FF7A45" }}
                  />
                </Space>
              }
              bordered={false}
              style={{ marginBottom: 16, borderRadius: 12 }}
            >
              <List
                dataSource={waitingSessions}
                renderItem={(session) => (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleAdmitFromWaiting(session)}
                        style={{
                          borderRadius: 6,
                          background: "#52c41a",
                          borderColor: "#52c41a",
                        }}
                      >
                        Admit
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={<UserOutlined />}
                          style={{ backgroundColor: "#B37FEB" }}
                        />
                      }
                      title={`Patient ${session.patientId.slice(0, 8)}`}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Waiting since{" "}
                            {new Date(session.createdAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </Text>
                          <Tag color={sessionStatusColor(session.status)}>
                            {session.status}
                          </Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: "No patients waiting" }}
              />
            </Card>
          </Col>
        </Row>

        <Modal
          title="AI Post-Visit Care Plan"
          open={carePlanModalVisible}
          onCancel={() => setCarePlanModalVisible(false)}
          footer={[
            <Button
              key="close"
              type="primary"
              onClick={() => setCarePlanModalVisible(false)}
            >
              Close
            </Button>,
          ]}
          width={700}
        >
          <Spin spinning={loadingCarePlan}>
            {carePlan && (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Paragraph>
                  <Text strong>Follow-up:</Text> {carePlan.followUp}
                </Paragraph>
                <div>
                  <Text strong>Patient Education:</Text>
                  <ul>
                    {carePlan.education?.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Text strong>Medications:</Text>
                  <ul>
                    {carePlan.medications?.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Text strong>Warnings:</Text>
                  <ul>
                    {carePlan.warnings?.map((item: string, idx: number) => (
                      <li key={idx} style={{ color: "#cf1322" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Space>
            )}
          </Spin>
        </Modal>
      </div>
    </Spin>
  );
};

export default TelemedicinePage;
