import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Upload,
  message,
  Statistic,
  Row,
  Col,
  Tag,
  Space,
  Tooltip,
  Drawer,
  Descriptions,
  Typography,
  Input,
  Tabs,
} from 'antd';
import {
  UploadOutlined,
  DollarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import remittanceService, {
  Remittance,
  RemittanceClaim,
  RemittanceStats,
} from '../../services/remittanceService';

const { Text } = Typography;

const statusColors: Record<string, string> = {
  imported: 'blue',
  posted: 'green',
  partially_posted: 'orange',
  error: 'red',
  reversed: 'default',
};

const claimStatusColors: Record<string, string> = {
  '1': 'green', // processed as primary
  '2': 'green',
  '3': 'green',
  '4': 'red', // denied
  '19': 'blue',
  '20': 'blue',
  '21': 'blue',
  '22': 'orange',
  '23': 'orange',
  '25': 'blue',
};

const claimStatusLabels: Record<string, string> = {
  '1': 'Processed (Primary)',
  '2': 'Processed (Secondary)',
  '3': 'Processed (Tertiary)',
  '4': 'Denied',
  '19': 'Primary (Forwarded)',
  '20': 'Secondary (Forwarded)',
  '21': 'Tertiary (Forwarded)',
  '22': 'Reversal',
  '23': 'Not Our Claim',
  '25': 'Predetermination',
};

const RemittancePage: React.FC = () => {
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [stats, setStats] = useState<RemittanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [detailDrawer, setDetailDrawer] = useState<Remittance | null>(null);
  const [claimDetails, setClaimDetails] = useState<RemittanceClaim[]>([]);
  const [claimLoading, setClaimLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [remData, statsData] = await Promise.all([
        remittanceService.findAllRemittances(),
        remittanceService.getStats(),
      ]);
      setRemittances(remData);
      setStats(statsData);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to load remittance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImport = async () => {
    if (!fileContent) {
      message.warning('Please select an 835 file');
      return;
    }
    try {
      setLoading(true);
      const result = await remittanceService.importEra(fileContent, fileName);
      message.success(`ERA imported: ${result.totalClaimCount} claims from ${result.payerName}`);
      setImportModalVisible(false);
      setFileContent('');
      setFileName('');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to import ERA file');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
      setFileName(file.name);
    };
    reader.readAsText(file);
    return false; // Prevent auto upload
  };

  const handleViewDetail = async (record: Remittance) => {
    setDetailDrawer(record);
    setClaimLoading(true);
    try {
      const claims = await remittanceService.getRemittanceClaims(record.id);
      setClaimDetails(claims);
    } catch (err: any) {
      message.error('Failed to load claim details');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleRepost = async (id: string) => {
    try {
      const result = await remittanceService.repostEra(id);
      message.success(`Posted ${result.postedCount} claims, $${result.postedAmount.toFixed(2)}`);
      loadData();
      if (detailDrawer?.id === id) {
        const updated = await remittanceService.findOneRemittance(id);
        setDetailDrawer(updated);
      }
    } catch (err: any) {
      message.error('Failed to re-post ERA');
    }
  };

  const filteredRemittances = remittances.filter(
    (r) =>
      !searchText ||
      r.traceNumber.toLowerCase().includes(searchText.toLowerCase()) ||
      r.payerName.toLowerCase().includes(searchText.toLowerCase()) ||
      r.paymentReference?.toLowerCase().includes(searchText.toLowerCase()),
  );

  const columns: ColumnsType<Remittance> = [
    {
      title: 'Trace Number',
      dataIndex: 'traceNumber',
      key: 'traceNumber',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'remittanceDate',
      key: 'remittanceDate',
      render: (d: string) => (d ? new Date(d).toLocaleDateString() : '-'),
    },
    {
      title: 'Payer',
      dataIndex: 'payerName',
      key: 'payerName',
    },
    {
      title: 'Payment',
      dataIndex: 'totalPaymentAmount',
      key: 'totalPaymentAmount',
      align: 'right',
      render: (amt: number) => `$${(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Claims',
      dataIndex: 'totalClaimCount',
      key: 'totalClaimCount',
      align: 'center',
    },
    {
      title: 'Posted',
      key: 'posted',
      align: 'center',
      render: (_: unknown, r: Remittance) => (
        <span>
          {r.postedCount}/{r.totalClaimCount}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusColors[status] || 'default'}>{status.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: Remittance) => (
        <Space>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)} />
          </Tooltip>
          {(r.status === 'imported' || r.status === 'partially_posted') && (
            <Tooltip title="Re-post Payments">
              <Button size="small" icon={<ReloadOutlined />} onClick={() => handleRepost(r.id)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const claimColumns: ColumnsType<RemittanceClaim> = [
    {
      title: 'Payer Claim ID',
      dataIndex: 'payerClaimId',
      key: 'payerClaimId',
    },
    {
      title: 'Patient',
      dataIndex: 'patientName',
      key: 'patientName',
    },
    {
      title: 'Billed',
      dataIndex: 'billedAmount',
      key: 'billedAmount',
      align: 'right',
      render: (amt: number) => `$${(amt || 0).toFixed(2)}`,
    },
    {
      title: 'Paid',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      align: 'right',
      render: (amt: number) => `$${(amt || 0).toFixed(2)}`,
    },
    {
      title: 'Adjusted',
      dataIndex: 'adjustedAmount',
      key: 'adjustedAmount',
      align: 'right',
      render: (amt: number) => `$${(amt || 0).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'claimStatusCode',
      key: 'claimStatusCode',
      render: (code: string) => (
        <Tag color={claimStatusColors[code] || 'default'}>
          {claimStatusLabels[code] || `Code ${code}`}
        </Tag>
      ),
    },
    {
      title: 'Matched',
      dataIndex: 'isMatched',
      key: 'isMatched',
      render: (matched: boolean) =>
        matched ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <Tooltip title="No matching claim found">
            <WarningOutlined style={{ color: '#faad14' }} />
          </Tooltip>
        ),
    },
    {
      title: 'Posted',
      dataIndex: 'isPosted',
      key: 'isPosted',
      render: (posted: boolean) =>
        posted ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#d9d9d9' }} />
        ),
    },
  ];

  return (
    <div>
      <Typography.Title level={3}>Remittance (ERA/EOB)</Typography.Title>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Remittances"
              value={stats?.totalRemittances || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Payments"
              value={stats?.totalPaymentAmount || 0}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Posted"
              value={stats?.totalPosted || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Pending"
              value={stats?.totalPending || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf8e00' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Unmatched Claims"
              value={stats?.unmatchedClaimCount || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Denied Claims"
              value={stats?.deniedClaimCount || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions Bar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input
          placeholder="Search by trace number, payer, or reference..."
          prefix={<SearchOutlined />}
          style={{ width: 400 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
          Import ERA (835)
        </Button>
      </div>

      {/* Remittances Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredRemittances}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Import Modal */}
      <Modal
        title="Import ERA File (X12 835)"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => setImportModalVisible(false)}
        confirmLoading={loading}
        okText="Import & Auto-Post"
        width={600}
      >
        <Tabs
          items={[
            {
              key: 'upload',
              label: 'Upload File',
              children: (
                <Upload.Dragger
                  accept=".835,.edi,.txt,.x12"
                  beforeUpload={handleFileUpload}
                  maxCount={1}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined />
                  </p>
                  <p className="ant-upload-text">Click or drag 835 file to upload</p>
                  <p className="ant-upload-hint">
                    Supports X12 835 ERA files (.835, .edi, .txt, .x12)
                  </p>
                </Upload.Dragger>
              ),
            },
            {
              key: 'paste',
              label: 'Paste Content',
              children: (
                <Input.TextArea
                  rows={10}
                  placeholder="Paste raw X12 835 file content here..."
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                />
              ),
            },
          ]}
        />
        {fileName && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Selected file: </Text>
            <Text strong>{fileName}</Text>
          </div>
        )}
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={`Remittance: ${detailDrawer?.traceNumber || ''}`}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={900}
      >
        {detailDrawer && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Payer">{detailDrawer.payerName}</Descriptions.Item>
              <Descriptions.Item label="Date">
                {new Date(detailDrawer.remittanceDate).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Method">
                {detailDrawer.paymentMethod || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Reference">
                {detailDrawer.paymentReference || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Payment">
                ${detailDrawer.totalPaymentAmount.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Total Billed">
                ${detailDrawer.totalBilledAmount.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Claims">
                {detailDrawer.totalClaimCount}
              </Descriptions.Item>
              <Descriptions.Item label="Posted">
                {detailDrawer.postedCount} (${detailDrawer.postedAmount.toFixed(2)})
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[detailDrawer.status]}>
                  {detailDrawer.status.replace(/_/g, ' ').toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="File">
                {detailDrawer.fileName || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5}>Claims in this Remittance</Typography.Title>
            <Table
              columns={claimColumns}
              dataSource={claimDetails}
              rowKey="id"
              loading={claimLoading}
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (claim: RemittanceClaim) => (
                  <div style={{ padding: '8px 0' }}>
                    {claim.serviceLines && claim.serviceLines.length > 0 && (
                      <>
                        <Text strong>Service Lines:</Text>
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="id"
                          dataSource={claim.serviceLines}
                          columns={[
                            { title: 'CPT', dataIndex: 'cptCode', key: 'cptCode' },
                            {
                              title: 'Modifiers',
                              key: 'modifiers',
                              render: (_: unknown, r: any) =>
                                [r.modifier1, r.modifier2, r.modifier3, r.modifier4]
                                  .filter(Boolean)
                                  .join(', ') || '-',
                            },
                            { title: 'Units', dataIndex: 'units', key: 'units', align: 'center' as const },
                            {
                              title: 'Billed',
                              dataIndex: 'billedAmount',
                              key: 'billed',
                              align: 'right' as const,
                              render: (v: number) => `$${(v || 0).toFixed(2)}`,
                            },
                            {
                              title: 'Paid',
                              dataIndex: 'paidAmount',
                              key: 'paid',
                              align: 'right' as const,
                              render: (v: number) => `$${(v || 0).toFixed(2)}`,
                            },
                          ]}
                        />
                      </>
                    )}
                    {claim.adjustments && claim.adjustments.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text strong>Adjustments (CARC/RARC):</Text>
                        <div style={{ marginTop: 4 }}>
                          {claim.adjustments.map((adj) => (
                            <div key={adj.id} style={{ marginBottom: 4 }}>
                              <Tag color={adj.groupCode === 'PR' ? 'blue' : 'red'}>
                                {adj.groupCode}-{adj.carcCode}
                              </Tag>
                              <Text>{adj.carcDescription || adj.carcCode}</Text>
                              <Text type="secondary"> — ${adj.adjustmentAmount.toFixed(2)}</Text>
                              {adj.rarcCode && (
                                <Tag style={{ marginLeft: 8 }}>{adj.rarcCode}</Tag>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ),
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RemittancePage;
