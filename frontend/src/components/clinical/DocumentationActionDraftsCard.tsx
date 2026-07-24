import React, { useState } from 'react';
import { Card, Table, Tag, Button, Space, Empty, Alert, Modal, message, Tooltip, Typography } from 'antd';
import {
  ExperimentOutlined,
  CodeOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  DocumentationSuggestion,
  DocumentationSuggestionKind,
  documentationService,
} from '../../services/documentationService';

interface Props {
  drafts: DocumentationSuggestion[];
  canEdit: boolean;
  onRefresh: () => void;
  onAcceptOrder?: (order: { type: string; name: string; reason: string; priority?: string }) => void;
  onAcceptDiagnosis?: (diag: { code: string; description: string }) => void;
  onAcceptProcedure?: (proc: { code: string; description: string }) => void;
}

const kindConfig: Record<DocumentationSuggestionKind, { label: string; icon: React.ReactNode; color: string }> = {
  order: { label: 'Orders', icon: <ExperimentOutlined />, color: 'blue' },
  coding: { label: 'Coding', icon: <CodeOutlined />, color: 'purple' },
  cdi: { label: 'CDI Prompts', icon: <FileSearchOutlined />, color: 'orange' },
  prior_auth: { label: 'Prior Auth', icon: <SafetyCertificateOutlined />, color: 'gold' },
  after_visit_summary: { label: 'After-Visit Summary', icon: <FileTextOutlined />, color: 'cyan' },
  claim_scrub: { label: 'Claim Scrub', icon: <CodeOutlined />, color: 'magenta' },
  revenue_risk: { label: 'Revenue Risk', icon: <ThunderboltOutlined />, color: 'red' },
};

const DocumentationActionDraftsCard: React.FC<Props> = ({
  drafts,
  canEdit,
  onRefresh,
  onAcceptOrder,
  onAcceptDiagnosis,
  onAcceptProcedure,
}) => {
  const [reviewing, setReviewing] = useState<string | null>(null);

  const pendingDrafts = drafts.filter((d) => d.status === 'pending' && hasContent(d));
  const reviewedDrafts = drafts.filter((d) => d.status !== 'pending');

  const handleReview = async (draft: DocumentationSuggestion, status: 'accepted' | 'dismissed') => {
    setReviewing(draft.id);
    try {
      await documentationService.reviewActionDraft(draft.id, status);
      message.success(status === 'accepted' ? 'Draft accepted' : 'Draft dismissed');

      if (status === 'accepted') {
        const payload = draft.payload as Record<string, any>;
        if (draft.kind === 'order' && payload.orders && onAcceptOrder) {
          payload.orders.forEach((o: any) => onAcceptOrder(o));
        }
        if (draft.kind === 'coding') {
          if (payload.diagnoses && onAcceptDiagnosis) {
            payload.diagnoses.forEach((d: any) => onAcceptDiagnosis(d));
          }
          if (payload.procedures && onAcceptProcedure) {
            payload.procedures.forEach((p: any) => onAcceptProcedure(p));
          }
        }
      }
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to review draft');
    } finally {
      setReviewing(null);
    }
  };

  if (drafts.length === 0) {
    return (
      <Card size="small" title="AI Action Drafts" style={{ marginBottom: 16 }}>
        <Empty description="No action drafts yet. Generate drafts from the SOAP note to see AI-suggested orders, codes, and CDI prompts." />
      </Card>
    );
  }

  // Group drafts by kind
  const grouped = pendingDrafts.reduce((acc, d) => {
    if (!acc[d.kind]) acc[d.kind] = [];
    acc[d.kind].push(d);
    return acc;
  }, {} as Record<string, DocumentationSuggestion[]>);

  return (
    <Card
      size="small"
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#722ed1' }} />
          <span>AI Action Drafts</span>
          {pendingDrafts.length > 0 && <Tag color="purple">{pendingDrafts.length} pending</Tag>}
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {/* CDI Prompts — render as alerts */}
      {grouped.cdi && grouped.cdi.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {grouped.cdi.map((draft) => {
            const rawPrompts = (draft.payload as any).prompts || [];
            const prompts = normalizePrompts(rawPrompts);
            return prompts.map((p: any, i: number) => (
              <Alert
                key={`${draft.id}-${i}`}
                type="warning"
                showIcon
                message={p.message}
                description={p.section ? `Section: ${p.section}` : undefined}
                style={{ marginBottom: 8 }}
              />
            ));
          })}
        </div>
      )}

      {/* Orders table */}
      {grouped.order && grouped.order.length > 0 && (
        <DraftTable
          title="Suggested Orders"
          icon={<ExperimentOutlined />}
          drafts={grouped.order}
          canEdit={canEdit}
          reviewing={reviewing}
          onReview={handleReview}
          columns={[
            { title: 'Type', dataIndex: 'type', key: 'type', width: 80 },
            { title: 'Name', dataIndex: 'name', key: 'name' },
            { title: 'Reason', dataIndex: 'reason', key: 'reason' },
            { title: 'Priority', dataIndex: 'priority', key: 'priority', width: 80 },
          ]}
          extractRows={(d) => normalizeOrders((d.payload as any).orders || [])}
        />
      )}

      {/* Coding table */}
      {grouped.coding && grouped.coding.length > 0 && (
        <>
          {grouped.coding.map((draft) => {
            const payload = draft.payload as any;
            const diagRows = payload.diagnoses || [];
            const procRows = payload.procedures || [];
            return (
              <div key={draft.id} style={{ marginBottom: 12 }}>
                {diagRows.length > 0 && (
                  <DraftTable
                    title="Suggested Diagnoses"
                    icon={<CodeOutlined />}
                    drafts={[draft]}
                    canEdit={canEdit}
                    reviewing={reviewing}
                    onReview={handleReview}
                    columns={[
                      { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
                      { title: 'Description', dataIndex: 'description', key: 'description' },
                      { title: 'Rationale', dataIndex: 'rationale', key: 'rationale' },
                    ]}
                    extractRows={() => normalizeCodeItems(diagRows, 'code')}
                  />
                )}
                {procRows.length > 0 && (
                  <DraftTable
                    title="Suggested Procedures"
                    icon={<CodeOutlined />}
                    drafts={[draft]}
                    canEdit={canEdit}
                    reviewing={reviewing}
                    onReview={handleReview}
                    columns={[
                      { title: 'CPT', dataIndex: 'code', key: 'code', width: 80 },
                      { title: 'Description', dataIndex: 'description', key: 'description' },
                      { title: 'Rationale', dataIndex: 'rationale', key: 'rationale' },
                    ]}
                    extractRows={() => normalizeCodeItems(procRows, 'code')}
                  />
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Prior Auth */}
      {grouped.prior_auth && grouped.prior_auth.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {grouped.prior_auth.map((draft) => {
            const pa = draft.payload as any;
            return (
              <Alert
                key={draft.id}
                type={pa.recommended ? 'warning' : 'info'}
                showIcon
                icon={<SafetyCertificateOutlined />}
                message={pa.recommended ? 'Prior Authorization Recommended' : 'Prior Authorization Not Required'}
                description={
                  <div>
                    <p style={{ margin: '4px 0' }}>{pa.rationale}</p>
                    {pa.requiredEvidence && pa.requiredEvidence.length > 0 && (
                      <div>
                        <Text strong style={{ fontSize: 12 }}>Required Evidence:</Text>
                        <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 12 }}>
                          {pa.requiredEvidence.map((e: string, i: number) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                    {canEdit && (
                      <Space style={{ marginTop: 8 }}>
                        <Button size="small" type="primary" icon={<CheckOutlined />}
                          onClick={() => handleReview(draft, 'accepted')} loading={reviewing === draft.id}>
                          Acknowledge
                        </Button>
                        <Button size="small" icon={<CloseOutlined />}
                          onClick={() => handleReview(draft, 'dismissed')} loading={reviewing === draft.id}>
                          Dismiss
                        </Button>
                      </Space>
                    )}
                  </div>
                }
                style={{ marginBottom: 8 }}
              />
            );
          })}
        </div>
      )}

      {/* After-Visit Summary */}
      {grouped.after_visit_summary && grouped.after_visit_summary.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {grouped.after_visit_summary.map((draft) => {
            const avs = normalizeAvs(draft.payload as any);
            if (!avs.summary) return null;
            return (
              <Card key={draft.id} size="small" type="inner" title="After-Visit Summary" style={{ marginBottom: 8 }}>
                <p style={{ margin: '4px 0' }}>{avs.summary}</p>
                {avs.followUp && <p style={{ margin: '4px 0', fontSize: 12 }}><strong>Follow-up:</strong> {avs.followUp}</p>}
                {avs.warnings && avs.warnings.length > 0 && (
                  <div>
                    {avs.warnings.map((w: string, i: number) => (
                      <Tag key={i} color="orange" style={{ marginBottom: 4 }}>{w}</Tag>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <Space style={{ marginTop: 8 }}>
                    <Button size="small" type="primary" icon={<CheckOutlined />}
                      onClick={() => handleReview(draft, 'accepted')} loading={reviewing === draft.id}>
                      Accept
                    </Button>
                    <Button size="small" icon={<CloseOutlined />}
                      onClick={() => handleReview(draft, 'dismissed')} loading={reviewing === draft.id}>
                      Dismiss
                    </Button>
                  </Space>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Payer Coaching (Roadmap #6) */}
      {grouped.revenue_risk && grouped.revenue_risk.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {grouped.revenue_risk.map((draft) => {
            const coaching = (draft.payload as any).coaching || [];
            return coaching.map((c: any, i: number) => (
              <Alert
                key={`${draft.id}-${i}`}
                type={c.severity === 'critical' ? 'error' : c.severity === 'warning' ? 'warning' : 'info'}
                showIcon
                icon={<ThunderboltOutlined />}
                message={`${c.payerName}: ${c.message}`}
                description={`Section: ${c.section}`}
                style={{ marginBottom: 8 }}
              />
            ));
          })}
        </div>
      )}

      {/* Reviewed drafts */}
      {reviewedDrafts.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Reviewed ({reviewedDrafts.length})</Text>
          <div style={{ marginTop: 4 }}>
            {reviewedDrafts.map((d) => (
              <Tag key={d.id} color={d.status === 'accepted' ? 'green' : 'default'} style={{ marginBottom: 4 }}>
                {kindConfig[d.kind]?.label || d.kind}: {d.status}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

// Helper sub-component for table-based drafts
const { Text } = Typography;

// Normalize orders: AI may return strings instead of { type, name, reason, priority } objects
function normalizeOrders(orders: any[]): any[] {
  return orders.map((o) => {
    if (typeof o === 'string') {
      return { type: '—', name: o, reason: '', priority: '' };
    }
    return o;
  });
}

// Normalize coding items (diagnoses/procedures): AI may return strings instead of objects
function normalizeCodeItems(items: any[], codeField: string): any[] {
  return items.map((item) => {
    if (typeof item === 'string') {
      return { [codeField]: '', description: item, rationale: '' };
    }
    return item;
  });
}

// Normalize CDI prompts: AI may return strings instead of { message, section } objects
function normalizePrompts(prompts: any[]): any[] {
  return prompts.map((p) => {
    if (typeof p === 'string') {
      return { message: p, section: '' };
    }
    return p;
  }).filter((p) => p.message); // skip items with no message
}

// Check if a draft has renderable content
function hasContent(d: DocumentationSuggestion): boolean {
  const p = d.payload as any;
  if (d.kind === 'order') return (p.orders?.length || 0) > 0;
  if (d.kind === 'coding') return (p.diagnoses?.length || 0) > 0 || (p.procedures?.length || 0) > 0;
  if (d.kind === 'cdi') return normalizePrompts(p.prompts || []).length > 0;
  if (d.kind === 'prior_auth') return !!p.rationale || !!p.recommended;
  if (d.kind === 'after_visit_summary') return !!(p.summary || p.instructions?.length);
  if (d.kind === 'revenue_risk') return (p.coaching?.length || 0) > 0;
  if (d.kind === 'claim_scrub') return (p.issues?.length || 0) > 0;
  return true;
}

// Normalize AVS: handle alternative field names from different AI runs
function normalizeAvs(payload: any): { summary: string; followUp: string; warnings: string[] } {
  return {
    summary: payload.summary || payload.instructions?.join('; ') || '',
    followUp: payload.followUp || '',
    warnings: payload.warnings || payload.redFlags || [],
  };
}

function DraftTable({
  title,
  icon,
  drafts,
  canEdit,
  reviewing,
  onReview,
  columns,
  extractRows,
}: {
  title: string;
  icon: React.ReactNode;
  drafts: DocumentationSuggestion[];
  canEdit: boolean;
  reviewing: string | null;
  onReview: (d: DocumentationSuggestion, s: 'accepted' | 'dismissed') => void;
  columns: ColumnsType<any>;
  extractRows: (d: DocumentationSuggestion) => any[];
}) {
  const rows = drafts.flatMap(extractRows);
  if (rows.length === 0) return null;

  const actionColumn: ColumnsType<any>[0] = {
    title: 'Action',
    key: 'action',
    width: 120,
    render: (_, __, idx) => {
      const draft = drafts[0];
      return canEdit ? (
        <Space size="small">
          <Tooltip title="Accept">
            <Button size="small" type="primary" icon={<CheckOutlined />}
              onClick={() => onReview(draft, 'accepted')} loading={reviewing === draft.id} />
          </Tooltip>
          <Tooltip title="Dismiss">
            <Button size="small" icon={<CloseOutlined />}
              onClick={() => onReview(draft, 'dismissed')} loading={reviewing === draft.id} />
          </Tooltip>
        </Space>
      ) : null;
    },
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <Text strong style={{ fontSize: 13 }}>
        {icon} {title}
      </Text>
      <Table
        size="small"
        dataSource={rows}
        columns={[...columns, actionColumn]}
        rowKey={(_, idx) => String(idx)}
        pagination={false}
        style={{ marginTop: 4 }}
      />
    </div>
  );
}

export default DocumentationActionDraftsCard;
