import React, { useState, useEffect } from "react";
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Input,
  Select,
  DatePicker,
  Typography,
  message,
  Modal,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSuperbillStore } from "../../store/dataStore";
import { Superbill } from "../../types";
import dayjs from "dayjs";

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const SuperbillListPage: React.FC = () => {
  const navigate = useNavigate();
  const { superbills, loading, fetchSuperbills, deleteSuperbill } =
    useSuperbillStore();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null,
  );

  useEffect(() => {
    fetchSuperbills();
  }, [fetchSuperbills]);

  const filteredSuperbills = superbills.filter((superbill) => {
    const matchesSearch =
      superbill.patientName?.toLowerCase().includes(searchText.toLowerCase()) ||
      superbill.providerName
        ?.toLowerCase()
        .includes(searchText.toLowerCase()) ||
      superbill.insurance?.provider
        ?.toLowerCase()
        .includes(searchText.toLowerCase());

    const matchesStatus = !statusFilter || superbill.status === statusFilter;

    const matchesDateRange =
      !dateRange ||
      (dayjs(superbill.serviceDate).isAfter(dateRange[0]) &&
        dayjs(superbill.serviceDate).isBefore(dateRange[1]));

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: "Delete Superbill",
      content: "Are you sure you want to delete this superbill?",
      onOk: async () => {
        try {
          await deleteSuperbill(id);
          message.success("Superbill deleted successfully");
        } catch (error) {
          message.error("Failed to delete superbill");
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "default",
      submitted: "processing",
      processed: "warning",
      paid: "success",
      rejected: "error",
    };
    return colors[status] || "default";
  };

  const columns = [
    {
      title: "Superbill ID",
      dataIndex: "id",
      key: "id",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace" }}>{id.slice(0, 8)}...</span>
      ),
    },
    {
      title: "Patient",
      dataIndex: "patientName",
      key: "patientName",
      sorter: (a: Superbill, b: Superbill) =>
        (a.patientName || "").localeCompare(b.patientName || ""),
    },
    {
      title: "Provider",
      dataIndex: "providerName",
      key: "providerName",
      sorter: (a: Superbill, b: Superbill) =>
        (a.providerName || "").localeCompare(b.providerName || ""),
    },
    {
      title: "Insurance",
      dataIndex: ["insurance", "provider"],
      key: "insurance",
    },
    {
      title: "Service Date",
      dataIndex: "serviceDate",
      key: "serviceDate",
      render: (date: string) => dayjs(date).format("MM/DD/YYYY"),
      sorter: (a: Superbill, b: Superbill) =>
        dayjs(a.serviceDate).unix() - dayjs(b.serviceDate).unix(),
    },
    {
      title: "Total Amount",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (amount: number | string) => `$${Number(amount || 0).toFixed(2)}`,
      sorter: (a: Superbill, b: Superbill) => Number(a.totalAmount) - Number(b.totalAmount),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
      filters: [
        { text: "Draft", value: "draft" },
        { text: "Submitted", value: "submitted" },
        { text: "Processed", value: "processed" },
        { text: "Paid", value: "paid" },
        { text: "Rejected", value: "rejected" },
      ],
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Superbill) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/superbills/${record.id}`)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/superbills/${record.id}/edit`)}
            disabled={record.status !== "draft"}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            disabled={record.status !== "draft"}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            <FileTextOutlined /> Superbills
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/superbills/new")}
          >
            Create Superbill
          </Button>
        </div>

        <Space style={{ marginBottom: "16px" }} size="middle">
          <Input
            placeholder="Search by patient, provider, or insurance"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            placeholder="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 150 }}
          >
            <Option value="draft">Draft</Option>
            <Option value="submitted">Submitted</Option>
            <Option value="processed">Processed</Option>
            <Option value="paid">Paid</Option>
            <Option value="rejected">Rejected</Option>
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) =>
              setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
            }
            placeholder={["Start Date", "End Date"]}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={filteredSuperbills}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} superbills`,
          }}
        />
      </Card>
    </div>
  );
};

export default SuperbillListPage;
