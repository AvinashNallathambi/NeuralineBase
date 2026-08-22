import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Select,
  DatePicker,
  InputNumber,
  Divider,
  Table,
  message,
  Row,
  Col,
  Switch,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { encounterService } from "../../services/encounterService";
import {
  useSuperbillStore,
  usePatientStore,
  useUserStore,
} from "../../store/dataStore";
import {
  Superbill,
  SuperbillDiagnosis,
  SuperbillProcedure,
  SuperbillCharge,
} from "../../types";
import dayjs from "dayjs";
import AiCodingAssistant from "../../components/superbills/AiCodingAssistant";
import IcdSearchInput from "../../components/icd/IcdSearchInput";
import CptSearchInput from "../../components/superbills/CptSearchInput";

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface CreateSuperbillPageProps {
  initialData?: Superbill;
}

const CreateSuperbillPage: React.FC<CreateSuperbillPageProps> = ({
  initialData,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const encounterId = searchParams.get("encounterId");
  const [form] = Form.useForm();
  const { addSuperbill, updateSuperbill } = useSuperbillStore();
  const { patients, fetchPatients } = usePatientStore();
  const { users } = useUserStore();
  const [diagnoses, setDiagnoses] = useState<SuperbillDiagnosis[]>(
    initialData?.diagnoses || [],
  );
  const [procedures, setProcedures] = useState<SuperbillProcedure[]>(
    initialData?.procedures || [],
  );
  const [charges, setCharges] = useState<SuperbillCharge[]>(
    initialData?.charges || [],
  );
  const [totalAmount, setTotalAmount] = useState(Number(initialData?.totalAmount || 0));
  const [clinicalNotes, setClinicalNotes] = useState(initialData?.notes || "");
  const isEditing = !!initialData;

  useEffect(() => {
    if (patients.length === 0) {
      fetchPatients();
    }
  }, [patients.length, fetchPatients]);

  useEffect(() => {
    if (!encounterId || initialData) return;
    const loadEncounter = async () => {
      try {
        const encounter = await encounterService.findOne(encounterId);
        form.setFieldsValue({
          patientId: encounter.patientId,
          providerId: encounter.providerId,
          serviceDate: dayjs(encounter.startTime),
          notes: [
            encounter.soapNote?.assessment ? `Assessment: ${encounter.soapNote.assessment}` : '',
            encounter.soapNote?.plan ? `Plan: ${encounter.soapNote.plan}` : '',
          ].filter(Boolean).join('\n\n'),
        });
        setClinicalNotes([
          encounter.soapNote?.assessment ? `Assessment: ${encounter.soapNote.assessment}` : '',
          encounter.soapNote?.plan ? `Plan: ${encounter.soapNote.plan}` : '',
        ].filter(Boolean).join('\n\n'));
        setDiagnoses(encounter.diagnoses.map((diagnosis, index) => ({
          id: `encounter-dx-${index}`,
          icdCode: diagnosis.code,
          description: diagnosis.description,
          type: diagnosis.isPrimary ? 'primary' : 'secondary',
        })));
        setProcedures((encounter.treatmentPlan?.procedures || [])
          .filter((procedure) => procedure.cptCode)
          .map((procedure, index) => ({
            id: `encounter-procedure-${index}`,
            cptCode: procedure.cptCode || '',
            description: procedure.description,
            units: 1,
            charge: 0,
            serviceDate: encounter.startTime,
            diagnosisPointer: [1],
          })));
      } catch {
        message.error('Unable to load encounter details for this superbill.');
      }
    };
    void loadEncounter();
  }, [encounterId, form, initialData]);

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue({
        patientId: initialData.patientId,
        providerId: initialData.providerId,
        serviceDate: dayjs(initialData.serviceDate),
        insuranceProvider: initialData.insurance.provider,
        policyNumber: initialData.insurance.policyNumber,
        groupNumber: initialData.insurance.groupNumber,
        payerId: initialData.insurance.payerId,
        subscriberName: initialData.insurance.subscriberName,
        subscriberRelation: initialData.insurance.subscriberRelation,
        authorizationNumber: initialData.insurance.authorizationNumber,
        notes: initialData.notes,
      });
      setClinicalNotes(initialData.notes || "");
      calculateTotal(initialData.procedures, initialData.charges);
    }
  }, [initialData, form]);

  const calculateTotal = (procs = procedures, chgs = charges) => {
    let total = 0;
    procs.forEach((proc) => {
      total += proc.charge * proc.units;
    });
    chgs.forEach((charge) => {
      total += charge.amount;
    });
    setTotalAmount(total);
    return total;
  };

  const handleAddDiagnosis = () => {
    const newDiagnosis: SuperbillDiagnosis = {
      id: `dx-${Date.now()}`,
      icdCode: "",
      description: "",
      type: "primary",
    };
    setDiagnoses([...diagnoses, newDiagnosis]);
  };

  const handleRemoveDiagnosis = (id: string) => {
    setDiagnoses(diagnoses.filter((d) => d.id !== id));
  };

  const handleUpdateDiagnosis = (id: string, field: string, value: any) => {
    setDiagnoses((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    );
  };

  const handleAddProcedure = () => {
    const newProcedure: SuperbillProcedure = {
      id: `proc-${Date.now()}`,
      cptCode: "",
      description: "",
      modifiers: [],
      units: 1,
      charge: 0,
      serviceDate: new Date().toISOString(),
      diagnosisPointer: [],
    };
    const newProcs = [...procedures, newProcedure];
    setProcedures(newProcs);
    calculateTotal(newProcs, charges);
  };

  const handleRemoveProcedure = (id: string) => {
    const newProcs = procedures.filter((p) => p.id !== id);
    setProcedures(newProcs);
    calculateTotal(newProcs, charges);
  };

  const handleUpdateProcedure = (id: string, field: string, value: any) => {
    setProcedures((prev) => {
      const newProcs = prev.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      );
      calculateTotal(newProcs, charges);
      return newProcs;
    });
  };

  const handleAddCharge = () => {
    const newCharge: SuperbillCharge = {
      id: `charge-${Date.now()}`,
      description: "",
      amount: 0,
      type: "service",
      taxable: false,
    };
    const newCharges = [...charges, newCharge];
    setCharges(newCharges);
    calculateTotal(procedures, newCharges);
  };

  const handleRemoveCharge = (id: string) => {
    const newCharges = charges.filter((c) => c.id !== id);
    setCharges(newCharges);
    calculateTotal(procedures, newCharges);
  };

  const handleUpdateCharge = (id: string, field: string, value: any) => {
    setCharges((prev) => {
      const newCharges = prev.map((c) =>
        c.id === id ? { ...c, [field]: value } : c,
      );
      calculateTotal(procedures, newCharges);
      return newCharges;
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const patient = patients.find((p) => p.id === values.patientId);
      const provider = users.find((u) => u.id === values.providerId);

      if (!patient || !provider) {
        message.error("Patient or provider not found");
        return;
      }

      // Filter out empty diagnoses/procedures (rows where the user didn't
      // select a code). The backend DTO requires non-empty icdCode/cptCode.
      const validDiagnoses = diagnoses.filter(
        (d) => d.icdCode?.trim() && d.description?.trim(),
      );
      const validProcedures = procedures.filter(
        (p) => p.cptCode?.trim() && p.description?.trim(),
      );

      if (validDiagnoses.length === 0) {
        message.error("At least one diagnosis with an ICD-10 code is required");
        return;
      }
      if (validProcedures.length === 0) {
        message.error("At least one procedure with a CPT code is required");
        return;
      }

      // Map patient address (uses street1/street2) to the superbill address
      // DTO shape (uses street/street2).
      const patientAddr = patient.address || ({} as any);
      const mappedAddress = {
        street: patientAddr.street1 || patientAddr.street || "",
        street2: patientAddr.street2,
        city: patientAddr.city || "",
        state: patientAddr.state || "",
        zipCode: patientAddr.zipCode || patientAddr.zip || "",
        country: patientAddr.country || "US",
      };

      const payload: any = {
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientDOB: patient.dateOfBirth,
        patientAddress: mappedAddress,
        patientPhone: patient.phone,
        patientSex: patient.gender?.startsWith('M') ? 'M' : patient.gender?.startsWith('F') ? 'F' : values.patientSex,
        providerId: provider.id,
        encounterId: encounterId || undefined,
        providerName: `${provider.firstName} ${provider.lastName}`,
        providerNPI: provider.specialization || "NPI-1234567890",
        providerAddress: {
          street: "123 Medical Center Dr",
          city: "Healthcare City",
          state: "CA",
          zipCode: "90210",
          country: "USA",
        },
        serviceDate: values.serviceDate.toISOString(),
        status: initialData?.status || "draft",
        insurance: {
          provider: values.insuranceProvider,
          policyNumber: values.policyNumber,
          groupNumber: values.groupNumber,
          subscriberName: values.subscriberName,
          subscriberRelation: values.subscriberRelation,
          payerId: values.payerId,
          authorizationNumber: values.authorizationNumber,
        },
        insuranceProgram: values.insuranceProgram,
        acceptAssignment: values.acceptAssignment,
        referringProviderName: values.referringProviderName,
        referringProviderNPI: values.referringProviderNPI,
        priorAuthNumber: values.priorAuthNumber,
        dateOfIllness: values.dateOfIllness?.toISOString(),
        outsideLab: values.outsideLab,
        outsideLabCharges: values.outsideLabCharges,
        resubmissionCode: values.resubmissionCode,
        originalRefNo: values.originalRefNo,
        patientAccountNo: values.patientAccountNo,
        isEmploymentRelated: values.isEmploymentRelated,
        isAutoAccident: values.isAutoAccident,
        isOtherAccident: values.isOtherAccident,
        amountPaid: values.amountPaid,
        physicianSignature: values.physicianSignature,
        physicianSignatureDate: values.physicianSignatureDate?.toISOString(),
        diagnoses: validDiagnoses.map(({ id, ...rest }) => rest),
        procedures: validProcedures.map(({ id, ...rest }) => rest),
        charges: charges
          .filter((c) => c.description?.trim())
          .map(({ id, ...rest }) => rest),
        totalAmount,
        patientResponsibility: totalAmount * 0.2,
        notes: values.notes,
      };

      if (initialData) {
        await updateSuperbill(initialData.id, payload);
        message.success("Superbill updated successfully");
      } else {
        await addSuperbill(payload);
        message.success("Superbill created successfully");
      }
      navigate("/superbills");
    } catch (error) {
      console.error(error);
      message.error("Failed to save superbill");
    }
  };

  const diagnosisColumns = [
    {
      title: "ICD Code",
      render: (_: any, record: SuperbillDiagnosis) => (
        <IcdSearchInput
          value={record.icdCode}
          description={record.description}
          onSelect={(selection) => {
            handleUpdateDiagnosis(record.id, "icdCode", selection.code);
            handleUpdateDiagnosis(record.id, "description", selection.description);
          }}
          placeholder="Search ICD-10 code or description"
          patientId={form.getFieldValue("patientId")}
          providerId={form.getFieldValue("providerId")}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Description",
      render: (_: any, record: SuperbillDiagnosis) => (
        <Input
          value={record.description}
          onChange={(e) =>
            handleUpdateDiagnosis(record.id, "description", e.target.value)
          }
          placeholder="Diagnosis description"
        />
      ),
    },
    {
      title: "Type",
      render: (_: any, record: SuperbillDiagnosis) => (
        <Select
          value={record.type}
          onChange={(value) => handleUpdateDiagnosis(record.id, "type", value)}
          style={{ width: 120 }}
        >
          <Option value="primary">Primary</Option>
          <Option value="secondary">Secondary</Option>
          <Option value="admitting">Admitting</Option>
          <Option value="working">Working</Option>
        </Select>
      ),
    },
    {
      title: "Action",
      render: (_: any, record: SuperbillDiagnosis) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveDiagnosis(record.id)}
        />
      ),
    },
  ];

  const procedureColumns = [
    {
      title: "CPT Code",
      render: (_: any, record: SuperbillProcedure) => (
        <CptSearchInput
          value={record.cptCode}
          onSelect={(code, description, price) => {
            handleUpdateProcedure(record.id, "cptCode", code);
            if (description) {
              handleUpdateProcedure(record.id, "description", description);
            }
            if (price && price > 0) {
              handleUpdateProcedure(record.id, "charge", price);
              calculateTotal(
                procedures.map((p) =>
                  p.id === record.id
                    ? { ...p, cptCode: code, description, charge: price }
                    : p,
                ),
                charges,
              );
            }
          }}
          placeholder="Search CPT/HCPCS code"
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Description",
      render: (_: any, record: SuperbillProcedure) => (
        <Input
          value={record.description}
          onChange={(e) =>
            handleUpdateProcedure(record.id, "description", e.target.value)
          }
          placeholder="Procedure description"
        />
      ),
    },
    {
      title: "Modifiers",
      render: (_: any, record: SuperbillProcedure) => (
        <Select
          mode="tags"
          value={record.modifiers || []}
          onChange={(value: string[]) =>
            handleUpdateProcedure(record.id, "modifiers", value)
          }
          placeholder="Add modifiers (e.g., 25, 59)"
          tokenSeparators={[",", " "]}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Units",
      render: (_: any, record: SuperbillProcedure) => (
        <InputNumber
          value={record.units}
          onChange={(value) =>
            handleUpdateProcedure(record.id, "units", value || 1)
          }
          min={1}
          max={99}
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: "Charge",
      render: (_: any, record: SuperbillProcedure) => (
        <InputNumber
          value={record.charge}
          onChange={(value) =>
            handleUpdateProcedure(record.id, "charge", value || 0)
          }
          min={0}
          precision={2}
          prefix="$"
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: "DX Pointer",
      render: (_: any, record: SuperbillProcedure) => (
        <Input
          value={record.diagnosisPointer?.join(", ")}
          onChange={(e) =>
            handleUpdateProcedure(
              record.id,
              "diagnosisPointer",
              e.target.value.split(", ").filter(Boolean),
            )
          }
          placeholder="ICD codes"
        />
      ),
    },
    {
      title: "Action",
      render: (_: any, record: SuperbillProcedure) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveProcedure(record.id)}
        />
      ),
    },
  ];

  const chargeColumns = [
    {
      title: "Description",
      render: (_: any, record: SuperbillCharge) => (
        <Input
          value={record.description}
          onChange={(e) =>
            handleUpdateCharge(record.id, "description", e.target.value)
          }
          placeholder="Charge description"
        />
      ),
    },
    {
      title: "Type",
      render: (_: any, record: SuperbillCharge) => (
        <Select
          value={record.type}
          onChange={(value) => handleUpdateCharge(record.id, "type", value)}
          style={{ width: 120 }}
        >
          <Option value="service">Service</Option>
          <Option value="supply">Supply</Option>
          <Option value="equipment">Equipment</Option>
          <Option value="other">Other</Option>
        </Select>
      ),
    },
    {
      title: "Amount",
      render: (_: any, record: SuperbillCharge) => (
        <InputNumber
          value={record.amount}
          onChange={(value) =>
            handleUpdateCharge(record.id, "amount", value || 0)
          }
          min={0}
          precision={2}
          prefix="$"
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: "Taxable",
      render: (_: any, record: SuperbillCharge) => (
        <Switch
          checked={record.taxable}
          onChange={(checked) =>
            handleUpdateCharge(record.id, "taxable", checked)
          }
        />
      ),
    },
    {
      title: "Action",
      render: (_: any, record: SuperbillCharge) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveCharge(record.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
              {isEditing ? "Edit Superbill" : "Create Superbill"}
            </Title>
          </Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit}>
            {isEditing ? "Update Superbill" : "Save Superbill"}
          </Button>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Patient"
                name="patientId"
                rules={[{ required: true, message: "Please select a patient" }]}
              >
                <Select
                  placeholder="Select patient"
                  showSearch
                  optionFilterProp="children"
                >
                  {patients.map((patient) => (
                    <Option key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName} ({patient.mrn})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Provider"
                name="providerId"
                rules={[
                  { required: true, message: "Please select a provider" },
                ]}
              >
                <Select
                  placeholder="Select provider"
                  showSearch
                  optionFilterProp="children"
                >
                  {users
                    .filter((u) => u.role === "doctor" || u.role === "admin" || u.role === "tenant_admin" || u.role === "super_admin")
                    .map((provider) => (
                      <Option key={provider.id} value={provider.id}>
                        {provider.firstName} {provider.lastName} (
                        {provider.specialization})
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Service Date"
                name="serviceDate"
                rules={[
                  { required: true, message: "Please select service date" },
                ]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Insurance Information</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Insurance Provider"
                name="insuranceProvider"
                rules={[
                  {
                    required: true,
                    message: "Please enter insurance provider",
                  },
                ]}
              >
                <Input placeholder="e.g., Blue Cross Blue Shield" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Policy Number"
                name="policyNumber"
                rules={[
                  { required: true, message: "Please enter policy number" },
                ]}
              >
                <Input placeholder="e.g., XYZ123456789" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Group Number"
                name="groupNumber"
                rules={[
                  { required: true, message: "Please enter group number" },
                ]}
              >
                <Input placeholder="e.g., 12345" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Payer ID"
                name="payerId"
                rules={[{ required: true, message: "Please enter payer ID" }]}
              >
                <Input placeholder="e.g., 00123" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Subscriber Name"
                name="subscriberName"
                rules={[
                  { required: true, message: "Please enter subscriber name" },
                ]}
              >
                <Input placeholder="Full name of subscriber" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Subscriber Relation"
                name="subscriberRelation"
                rules={[{ required: true, message: "Please enter relation" }]}
              >
                <Select placeholder="Select relation">
                  <Option value="self">Self</Option>
                  <Option value="spouse">Spouse</Option>
                  <Option value="child">Child</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Authorization Number"
                name="authorizationNumber"
              >
                <Input placeholder="Optional authorization number" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">CMS-1500 Claim Form Fields</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Insurance Program (Field 1)" name="insuranceProgram">
                <Select placeholder="Select program">
                  <Option value="medicare">Medicare</Option>
                  <Option value="medicaid">Medicaid</Option>
                  <Option value="tricare">TRICARE</Option>
                  <Option value="champva">CHAMPVA</Option>
                  <Option value="group_health_plan">Group Health Plan</Option>
                  <Option value="feca">FECA</Option>
                  <Option value="blk_lung">Black Lung</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Patient Sex (Field 3)" name="patientSex">
                <Select placeholder="Select sex">
                  <Option value="M">Male</Option>
                  <Option value="F">Female</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Accept Assignment? (Field 27)" name="acceptAssignment" initialValue={true}>
                <Select>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Referring Provider Name (Field 17)" name="referringProviderName">
                <Input placeholder="e.g., Dr. Jane Smith" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Referring Provider NPI (Field 17b)" name="referringProviderNPI">
                <Input placeholder="e.g., 1234567890" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Prior Auth Number (Field 23)" name="priorAuthNumber">
                <Input placeholder="e.g., PA-12345" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Date of Current Illness (Field 14)" name="dateOfIllness">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Outside Lab? (Field 20)" name="outsideLab">
                <Select placeholder="Select">
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Outside Lab Charges (Field 20)" name="outsideLabCharges">
                <InputNumber style={{ width: "100%" }} prefix="$" placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Resubmission Code (Field 22)" name="resubmissionCode">
                <Input placeholder="e.g., 7" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Original Ref No (Field 22)" name="originalRefNo">
                <Input placeholder="Original claim reference" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Patient Account No (Field 26)" name="patientAccountNo">
                <Input placeholder="Patient account number" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Employment Related? (Field 10a)" name="isEmploymentRelated" initialValue={false}>
                <Select>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Auto Accident? (Field 10b)" name="isAutoAccident" initialValue={false}>
                <Select>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Other Accident? (Field 10c)" name="isOtherAccident" initialValue={false}>
                <Select>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Amount Paid by Patient (Field 29)" name="amountPaid">
                <InputNumber style={{ width: "100%" }} prefix="$" placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Physician Signature (Field 31)" name="physicianSignature">
                <Input placeholder="e.g., Dr. James Wilson, MD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Signature Date (Field 31)" name="physicianSignatureDate">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">
            <Space>
              Diagnoses (ICD-10)
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddDiagnosis}
              >
                Add Diagnosis
              </Button>
            </Space>
          </Divider>
          <Table
            columns={diagnosisColumns}
            dataSource={diagnoses}
            rowKey="id"
            pagination={false}
            size="small"
          />

          <Divider orientation="left">
            <Space>
              Procedures (CPT/HCPCS)
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddProcedure}
              >
                Add Procedure
              </Button>
            </Space>
          </Divider>
          <Table
            columns={procedureColumns}
            dataSource={procedures}
            rowKey="id"
            pagination={false}
            size="small"
          />

          <Divider orientation="left">
            <Space>
              Additional Charges
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddCharge}
              >
                Add Charge
              </Button>
            </Space>
          </Divider>
          <Table
            columns={chargeColumns}
            dataSource={charges}
            rowKey="id"
            pagination={false}
            size="small"
          />

          <Divider orientation="left">Financial Summary</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small">
                <Typography.Text type="secondary">Total Amount</Typography.Text>
                <br />
                <Typography.Text strong style={{ fontSize: 24 }}>
                  ${totalAmount.toFixed(2)}
                </Typography.Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Typography.Text type="secondary">
                  Patient Responsibility (20%)
                </Typography.Text>
                <br />
                <Typography.Text strong style={{ fontSize: 24 }}>
                  ${(totalAmount * 0.2).toFixed(2)}
                </Typography.Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Typography.Text type="secondary">
                  Insurance Payment (80%)
                </Typography.Text>
                <br />
                <Typography.Text strong style={{ fontSize: 24 }}>
                  ${(totalAmount * 0.8).toFixed(2)}
                </Typography.Text>
              </Card>
            </Col>
          </Row>

          <Divider orientation="left">Notes</Divider>
          <Form.Item name="notes">
            <TextArea
              rows={4}
              placeholder="Additional notes for this superbill"
              onChange={(e) => setClinicalNotes(e.target.value)}
            />
          </Form.Item>

          <AiCodingAssistant
            clinicalNotes={clinicalNotes}
            onApplyDiagnosis={(code, description) => {
              const newDiagnosis: SuperbillDiagnosis = {
                id: `dx-${Date.now()}`,
                icdCode: code,
                description,
                type: "primary",
              };
              setDiagnoses([...diagnoses, newDiagnosis]);
              message.success(`Added diagnosis ${code}`);
            }}
            onApplyProcedure={(code, description, modifiers) => {
              const newProcedure: SuperbillProcedure = {
                id: `proc-${Date.now()}`,
                cptCode: code,
                description,
                modifiers: modifiers || [],
                units: 1,
                charge: 0, // Should be updated manually by user
                serviceDate: new Date().toISOString(),
                diagnosisPointer: [],
              };
              setProcedures([...procedures, newProcedure]);
              message.success(`Added procedure ${code}`);
            }}
          />
        </Form>
      </Card>
    </div>
  );
};

export default CreateSuperbillPage;
