import React, { useState, useEffect } from "react";
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Typography,
  Table,
  Divider,
  message,
  Modal,
  Spin,
  Row,
  Col,
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  PrinterOutlined,
  DownloadOutlined,
  SendOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useSuperbillStore } from "../../store/dataStore";
import { superbillService } from "../../services/superbillService";
import { Superbill } from "../../types";
import dayjs from "dayjs";
import AiScrubPanel from "../../components/superbills/AiScrubPanel";
import DenialRiskPanel from "../../components/superbills/DenialRiskPanel";

const { Title, Text } = Typography;

const SuperbillDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { superbills, updateSuperbill, submitSuperbill, fetchSuperbills } =
    useSuperbillStore();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(superbills.length === 0);

  useEffect(() => {
    const load = async () => {
      if (superbills.length === 0) {
        await fetchSuperbills();
      }
      setDataLoading(false);
    };
    load();
  }, [superbills.length, fetchSuperbills]);

  const superbill = superbills.find((s) => s.id === id);

  if (dataLoading || !superbill) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  const handleSubmit = () => {
    Modal.confirm({
      title: "Submit Superbill for Processing",
      content:
        "Are you sure you want to submit this superbill for insurance processing?",
      onOk: async () => {
        setLoading(true);
        try {
          await submitSuperbill(superbill.id);
          message.success("Superbill submitted successfully");
          setLoading(false);
        } catch (error) {
          message.error("Failed to submit superbill");
          setLoading(false);
        }
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!superbill) return;
    setLoading(true);
    try {
      const blob = await superbillService.downloadCms1500(superbill.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `claim_${superbill.patientName?.replace(/[^a-zA-Z0-9]/g, "") || superbill.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success("CMS-1500 claim form downloaded");
    } catch (error: any) {
      message.error(
        "Failed to download CMS-1500: " +
          (error?.response?.data?.message || error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
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

  const diagnosisColumns = [
    {
      title: "ICD Code",
      dataIndex: "icdCode",
      key: "icdCode",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
  ];

  const procedureColumns = [
    {
      title: "CPT Code",
      dataIndex: "cptCode",
      key: "cptCode",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Modifiers",
      dataIndex: "modifiers",
      key: "modifiers",
      render: (modifiers: string[]) => modifiers?.join(", ") || "-",
    },
    {
      title: "Units",
      dataIndex: "units",
      key: "units",
    },
    {
      title: "Charge",
      dataIndex: "charge",
      key: "charge",
      render: (charge: number | string) => `$${Number(charge || 0).toFixed(2)}`,
    },
    {
      title: "DX Pointer",
      dataIndex: "diagnosisPointer",
      key: "diagnosisPointer",
      render: (pointers: string[]) => pointers?.join(", ") || "-",
    },
  ];

  const chargeColumns = [
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number | string) => `$${Number(amount || 0).toFixed(2)}`,
    },
    {
      title: "Taxable",
      dataIndex: "taxable",
      key: "taxable",
      render: (taxable: boolean) => (taxable ? "Yes" : "No"),
    },
  ];

  return (
    <div>
      <Spin spinning={loading}>
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2%",
            }}
          >
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/superbills")}
              >
                Back
              </Button>
              <Title level={3} style={{ margin: 0 }}>
                Superbill Details
              </Title>
            </Space>
            <Space>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Print
              </Button>
              <Button
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/superbills/${superbill.id}/cms1500`)}
              >
                View CMS-1500 Form
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownload} loading={loading}>
                Download CMS-1500
              </Button>
              {superbill.status === "draft" && (
                <>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/superbills/${superbill.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSubmit}
                  >
                    Submit for Processing
                  </Button>
                </>
              )}
            </Space>
          </div>

          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Superbill ID" span={2}>
              <Text code>{superbill.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag
                color={getStatusColor(superbill.status)}
                icon={<CheckCircleOutlined />}
              >
                {superbill.status.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Service Date">
              {dayjs(superbill.serviceDate).format("MM/DD/YYYY")}
            </Descriptions.Item>
            <Descriptions.Item label="Submission Date">
              {superbill.submissionDate
                ? dayjs(superbill.submissionDate).format("MM/DD/YYYY")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {dayjs(superbill.createdAt).format("MM/DD/YYYY HH:mm")}
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">Patient Information</Divider>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Patient Name">
              {superbill.patientName}
            </Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {dayjs(superbill.patientDOB).format("MM/DD/YYYY")}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              {superbill.patientPhone}
            </Descriptions.Item>
            <Descriptions.Item label="Address" span={2}>
              {superbill.patientAddress.street}, {superbill.patientAddress.city}
              , {superbill.patientAddress.state}{" "}
              {superbill.patientAddress.zipCode}
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">Provider Information</Divider>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Provider Name">
              {superbill.providerName}
            </Descriptions.Item>
            <Descriptions.Item label="NPI">
              {superbill.providerNPI}
            </Descriptions.Item>
            <Descriptions.Item label="Address" span={2}>
              {superbill.providerAddress.street},{" "}
              {superbill.providerAddress.city},{" "}
              {superbill.providerAddress.state}{" "}
              {superbill.providerAddress.zipCode}
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">Insurance Information</Divider>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Insurance Provider">
              {superbill.insurance.provider}
            </Descriptions.Item>
            <Descriptions.Item label="Policy Number">
              {superbill.insurance.policyNumber}
            </Descriptions.Item>
            <Descriptions.Item label="Group Number">
              {superbill.insurance.groupNumber}
            </Descriptions.Item>
            <Descriptions.Item label="Payer ID">
              {superbill.insurance.payerId}
            </Descriptions.Item>
            <Descriptions.Item label="Subscriber Name">
              {superbill.insurance.subscriberName}
            </Descriptions.Item>
            <Descriptions.Item label="Subscriber Relation">
              {superbill.insurance.subscriberRelation}
            </Descriptions.Item>
            {superbill.insurance.authorizationNumber && (
              <Descriptions.Item label="Authorization Number" span={2}>
                {superbill.insurance.authorizationNumber}
              </Descriptions.Item>
            )}
          </Descriptions>

          <Divider orientation="left">CMS-1500 Claim Form Details</Divider>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Insurance Program (Field 1)">
              {(superbill as any).insuranceProgram || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Patient Sex (Field 3)">
              {(superbill as any).patientSex || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Accept Assignment (Field 27)">
              {(superbill as any).acceptAssignment === false ? "No" : "Yes"}
            </Descriptions.Item>
            <Descriptions.Item label="Patient Account No (Field 26)">
              {(superbill as any).patientAccountNo || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Referring Provider (Field 17)">
              {(superbill as any).referringProviderName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Referring Provider NPI (Field 17b)">
              {(superbill as any).referringProviderNPI || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Prior Auth Number (Field 23)">
              {(superbill as any).priorAuthNumber || superbill.referralNumber || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Date of Illness (Field 14)">
              {(superbill as any).dateOfIllness
                ? dayjs((superbill as any).dateOfIllness).format("MM/DD/YYYY")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Outside Lab (Field 20)">
              {(superbill as any).outsideLab === true ? "Yes" : (superbill as any).outsideLab === false ? "No" : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Outside Lab Charges (Field 20)">
              {(superbill as any).outsideLabCharges
                ? `$${Number((superbill as any).outsideLabCharges).toFixed(2)}`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Resubmission Code (Field 22)">
              {(superbill as any).resubmissionCode || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Original Ref No (Field 22)">
              {(superbill as any).originalRefNo || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Employment Related (Field 10a)">
              {superbill.isEmploymentRelated ? "Yes" : "No"}
            </Descriptions.Item>
            <Descriptions.Item label="Auto Accident (Field 10b)">
              {superbill.isAutoAccident ? "Yes" : "No"}
            </Descriptions.Item>
            <Descriptions.Item label="Other Accident (Field 10c)">
              {superbill.isOtherAccident ? "Yes" : "No"}
            </Descriptions.Item>
            <Descriptions.Item label="Amount Paid (Field 29)">
              {(superbill as any).amountPaid
                ? `$${Number((superbill as any).amountPaid).toFixed(2)}`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Physician Signature (Field 31)">
              {(superbill as any).physicianSignature || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Signature Date (Field 31)">
              {(superbill as any).physicianSignatureDate
                ? dayjs((superbill as any).physicianSignatureDate).format("MM/DD/YYYY")
                : "-"}
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">Diagnoses (ICD-10)</Divider>
          <Table
            columns={diagnosisColumns}
            dataSource={superbill.diagnoses}
            rowKey="id"
            pagination={false}
            size="small"
          />

          <Divider orientation="left">Procedures (CPT/HCPCS)</Divider>
          <Table
            columns={procedureColumns}
            dataSource={superbill.procedures}
            rowKey="id"
            pagination={false}
            size="small"
          />

          <Divider orientation="left">Additional Charges</Divider>
          <Table
            columns={chargeColumns}
            dataSource={superbill.charges}
            rowKey="id"
            pagination={false}
            size="small"
          />

          <Divider orientation="left">Financial Summary</Divider>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Total Amount">
              <Text strong>
                ${Number(superbill.totalAmount || 0).toFixed(2)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Insurance Payment">
              <Text strong>
                {superbill.insurancePayment
                  ? `$${Number(superbill.insurancePayment).toFixed(2)}`
                  : "-"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Patient Responsibility">
              <Text strong>
                ${Number(superbill.patientResponsibility || 0).toFixed(2)}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          {superbill.notes && (
            <>
              <Divider orientation="left">Notes</Divider>
              <Card size="small">{superbill.notes}</Card>
            </>
          )}

          <Divider orientation="left">AI Analysis</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <AiScrubPanel
                superbillId={superbill.id}
                clinicalNotes={superbill.notes}
                onFixSuggestion={
                  superbill.status === "draft"
                    ? (field, suggestion) => {
                        message.info(
                          `Please go to Edit page to apply fix for ${field}: ${suggestion}`,
                        );
                      }
                    : undefined
                }
              />
            </Col>
            <Col span={12}>
              <DenialRiskPanel superbillId={superbill.id} />
            </Col>
          </Row>
        </Card>
      </Spin>
    </div>
  );
};

export default SuperbillDetailPage;
