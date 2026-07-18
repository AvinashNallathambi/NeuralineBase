import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Card,
  DatePicker,
  Badge,
  Tooltip,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  CalendarOutlined,
  UserOutlined,
  FilterOutlined,
  ReloadOutlined,
  LockOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import isToday from "dayjs/plugin/isToday";
import {
  encounterService,
  Encounter,
  PaginatedEncounters,
} from "../../services/encounterService";
import { patientService } from "../../services/patientService";
import ClinicalTemplateGallery from "../../components/clinical/ClinicalTemplateGallery";
import type { ColumnsType } from "antd/es/table";

dayjs.extend(isToday);

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const statusColors: Record<string, string> = {
  scheduled: "blue",
  in_progress: "orange",
  completed: "green",
  cancelled: "default",
  no_show: "red",
};

const typeLabels: Record<string, string> = {
  office_visit: "Office Visit",
  telehealth: "Telehealth",
  hospital: "Hospital",
  emergency: "Emergency",
  home_health: "Home Health",
  nursing_facility: "Nursing Facility",
};

const PROVIDERS = [
  { id: "550e8400-e29b-41d4-a716-446655440001", name: "Dr. Sarah Chen" },
  { id: "550e8400-e29b-41d4-a716-446655440002", name: "Dr. Michael Ross" },
  { id: "550e8400-e29b-41d4-a716-446655440003", name: "Dr. Emily Park" },
  { id: "550e8400-e29b-41d4-a716-446655440004", name: "Dr. James Wilson" },
];

type TabKey = "all" | "today" | "scheduled" | "in_progress" | "completed";

const ClinicalPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedEncounters | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [patientMap, setPatientMap] = useState<
    Record<string, { firstName: string; lastName: string; mrn?: string }>
  >({});

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const result = await patientService.findAll({ page: 1, limit: 500 });
      const map: Record<
        string,
        { firstName: string; lastName: string; mrn?: string }
      > = {};
      result.data.forEach((p: any) => {
        map[p.id] = {
          firstName: p.firstName,
          lastName: p.lastName,
          mrn: p.mrn,
        };
      });
      setPatientMap(map);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [activeTab, statusFilter, typeFilter, providerFilter, dateRange, page]);

  const fetchEncounters = async () => {
    setLoading(true);
    try {
      let startDateFrom: string | undefined;
      let startDateTo: string | undefined;
      let statusParam = statusFilter;

      if (activeTab === "today") {
        startDateFrom = dayjs().startOf("day").toISOString();
        startDateTo = dayjs().endOf("day").toISOString();
      } else if (activeTab === "scheduled") {
        statusParam = "scheduled";
      } else if (activeTab === "in_progress") {
        statusParam = "in_progress";
      } else if (activeTab === "completed") {
        statusParam = "completed";
      }

      if (dateRange && activeTab !== "today") {
        startDateFrom = dateRange[0].startOf("day").toISOString();
        startDateTo = dateRange[1].endOf("day").toISOString();
      }

      const result = await encounterService.findAll({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusParam || undefined,
        type: typeFilter || undefined,
        providerId: providerFilter || undefined,
        startDateFrom,
        startDateTo,
      });
      setData(result);
    } catch {
      // error handling is silent to avoid disruption
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchEncounters();
  };

  const handleReset = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setProviderFilter("");
    setDateRange(null);
    setPage(1);
    setActiveTab("all");
  };

  const columns: ColumnsType<Encounter> = [
    {
      title: "Date / Time",
      dataIndex: "startTime",
      width: 160,
      sorter: (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      render: (t) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>
            {dayjs(t).format("MM/DD/YYYY")}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(t).format("h:mm A")}
          </Text>
          {dayjs(t).isToday() && (
            <Tag color="green" style={{ fontSize: 10, lineHeight: "14px" }}>
              Today
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Patient",
      dataIndex: "patientId",
      width: 180,
      render: (patientId) => {
        const patient = patientMap[patientId];
        const displayName = patient
          ? `${patient.firstName} ${patient.lastName}`
          : patientId?.substring(0, 8) + "…";
        return (
          <Space>
            <UserOutlined style={{ color: "#1890ff" }} />
            {/* <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/patients/${patientId}`);
              }}
            >
              
            </Button> */}
            {displayName}
          </Space>
        );
      },
    },
    {
      title: "Chief Complaint",
      dataIndex: "chiefComplaint",
      ellipsis: true,
      render: (cc, record) => (
        <Space direction="vertical" size={0}>
          {cc && <Text style={{ fontSize: 13 }}>{cc}</Text>}
          {!cc && record.visitReason && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.visitReason}
            </Text>
          )}
          {!cc && !record.visitReason && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              —
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 130,
      render: (t) => <Tag>{typeLabels[t] || t}</Tag>,
    },
    {
      title: "Provider",
      dataIndex: "providerId",
      width: 160,
      render: (providerId) => {
        const provider = PROVIDERS.find((p) => p.id === providerId);
        return provider ? (
          <Text style={{ fontSize: 13 }}>{provider.name}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {providerId?.substring(0, 8)}
          </Text>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (status, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={statusColors[status]}>
            {status
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l: string) => l.toUpperCase())}
          </Tag>
          {record.isLocked && (
            <Tooltip title="Encounter locked">
              <Tag
                icon={<LockOutlined />}
                color="orange"
                style={{ fontSize: 11 }}
              >
                Locked
              </Tag>
            </Tooltip>
          )}
          {record.signedAt && !record.isLocked && (
            <Tag
              icon={<FileDoneOutlined />}
              color="green"
              style={{ fontSize: 11 }}
            >
              Signed
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Duration",
      dataIndex: "durationMinutes",
      width: 90,
      render: (d) => (d ? <Text type="secondary">{d} min</Text> : "—"),
    },
    {
      title: "Actions",
      width: 80,
      render: (_, record) => {
        const primaryDx = record.diagnoses?.find((d) => d.isPrimary);
        return primaryDx ? (
          <Tooltip title={primaryDx.description}>
            <Tag color="blue">{primaryDx.code}</Tag>
          </Tooltip>
        ) : record.diagnoses?.length ? (
          <Tag>{record.diagnoses.length} dx</Tag>
        ) : null;
      },
    },
    {
      title: "",
      width: 60,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/clinical/${record.id}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const tabItems = [
    { key: "all", label: "All Encounters" },
    {
      key: "today",
      label: (
        <Space>
          <CalendarOutlined />
          Today
        </Space>
      ),
    },
    { key: "scheduled", label: <Badge color="blue" text="Scheduled" /> },
    { key: "in_progress", label: <Badge color="orange" text="In Progress" /> },
    { key: "completed", label: <Badge color="green" text="Completed" /> },
  ];

  const todayCount =
    data?.data.filter((e) => dayjs(e.startTime).isToday()).length || 0;
  const inProgressCount =
    data?.data.filter((e) => e.status === "in_progress").length || 0;

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Clinical Encounters
          </Title>
          <Text type="secondary">{data?.total ?? 0} total encounters</Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/clinical/new")}
          >
            New Encounter
          </Button>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Today's Encounters"
              value={
                data?.data.filter((e) => dayjs(e.startTime).isToday()).length ??
                0
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="In Progress"
              value={
                data?.data.filter((e) => e.status === "in_progress").length ?? 0
              }
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Completed"
              value={
                data?.data.filter((e) => e.status === "completed").length ?? 0
              }
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic title="Total Shown" value={data?.total ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 12 }}>
          <Space wrap>
            {tabItems.map((item) => (
              <Button
                key={item.key}
                type={activeTab === item.key ? "primary" : "default"}
                size="small"
                onClick={() => {
                  setActiveTab(item.key as TabKey);
                  setPage(1);
                }}
              >
                {item.label}
              </Button>
            ))}
          </Space>
        </div>

        <Row gutter={8} style={{ marginBottom: 12 }}>
          <Col xs={24} md={6}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search chief complaint, reason, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Status"
              value={statusFilter || undefined}
              onChange={(v) => {
                setStatusFilter(v || "");
                setPage(1);
              }}
              allowClear
            >
              <Option value="scheduled">Scheduled</Option>
              <Option value="in_progress">In Progress</Option>
              <Option value="completed">Completed</Option>
              <Option value="cancelled">Cancelled</Option>
              <Option value="no_show">No Show</Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Type"
              value={typeFilter || undefined}
              onChange={(v) => {
                setTypeFilter(v || "");
                setPage(1);
              }}
              allowClear
            >
              <Option value="office_visit">Office Visit</Option>
              <Option value="telehealth">Telehealth</Option>
              <Option value="hospital">Hospital</Option>
              <Option value="emergency">Emergency</Option>
              <Option value="home_health">Home Health</Option>
              <Option value="nursing_facility">Nursing Facility</Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Provider"
              value={providerFilter || undefined}
              onChange={(v) => {
                setProviderFilter(v || "");
                setPage(1);
              }}
              allowClear
            >
              {PROVIDERS.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <RangePicker
              style={{ width: "100%" }}
              value={dateRange as any}
              onChange={(range) => {
                setDateRange(range as [Dayjs, Dayjs] | null);
                setPage(1);
              }}
              format="MM/DD/YYYY"
              placeholder={["Start Date", "End Date"]}
              disabled={activeTab === "today"}
            />
          </Col>
        </Row>

        <Row gutter={8} style={{ marginBottom: 12 }}>
          <Col>
            <Space>
              <Button
                icon={<SearchOutlined />}
                type="primary"
                onClick={handleSearch}
              >
                Search
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                Reset
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={data?.data || []}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: "max-content" }}
          onRow={(record) => ({
            onClick: () => navigate(`/clinical/${record.id}`),
            style: { cursor: "pointer" },
          })}
          rowClassName={(record) => {
            if (record.status === "in_progress")
              return "encounter-row-in-progress";
            return "";
          }}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total || 0,
            showSizeChanger: false,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} encounters`,
            onChange: (p) => setPage(p),
          }}
          locale={{
            emptyText: (
              <div style={{ padding: 32, textAlign: "center" }}>
                <CalendarOutlined
                  style={{ fontSize: 40, color: "#d9d9d9", marginBottom: 8 }}
                />
                <div>No encounters found</div>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate("/clinical/new")}
                  style={{ marginTop: 12 }}
                >
                  Create First Encounter
                </Button>
              </div>
            ),
          }}
        />
      </Card>

      <ClinicalTemplateGallery />
    </div>
  );
};

export default ClinicalPage;
