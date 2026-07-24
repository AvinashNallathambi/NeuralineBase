import React from 'react';
import { Tag, Button, Space, Typography } from 'antd';
import {
  PlayCircleOutlined,
  AudioOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  LockOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { DocumentationSession } from '../../services/documentationService';

const { Text } = Typography;

interface Props {
  session: DocumentationSession | null;
  canEdit: boolean;
  onStart: () => void;
  onSign: () => void;
  loading?: boolean;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'default', icon: <FileTextOutlined />, label: 'Draft' },
  transcribed: { color: 'blue', icon: <AudioOutlined />, label: 'Transcribed' },
  note_generated: { color: 'cyan', icon: <FileTextOutlined />, label: 'Note Generated' },
  reviewed: { color: 'gold', icon: <CheckCircleOutlined />, label: 'Reviewed' },
  signed: { color: 'green', icon: <LockOutlined />, label: 'Signed' },
  cancelled: { color: 'red', icon: <CloseCircleOutlined />, label: 'Cancelled' },
};

const DocumentationStatusBanner: React.FC<Props> = ({ session, canEdit, onStart, onSign, loading }) => {
  if (!session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
        <Text type="secondary">No documentation session linked to this encounter yet.</Text>
        {canEdit && (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={onStart} loading={loading}>
            Start Documentation
          </Button>
        )}
      </div>
    );
  }

  const cfg = statusConfig[session.status] || statusConfig.draft;
  const isSigned = session.status === 'signed';
  const isCancelled = session.status === 'cancelled';
  const canSign = canEdit && !isSigned && !isCancelled && session.status !== 'draft';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
      <Space size="middle">
        <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 13, padding: '4px 12px' }}>
          {cfg.label}
        </Tag>
        {session.consentStatus === 'pending' && (
          <Tag color="orange">Consent Pending</Tag>
        )}
        {session.transcript && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Transcript: {session.transcript.length.toLocaleString()} chars
          </Text>
        )}
        {session.signedAt && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Signed: {new Date(session.signedAt).toLocaleString()}
          </Text>
        )}
      </Space>
      <Space>
        {canSign && (
          <Button type="primary" icon={<LockOutlined />} onClick={onSign} loading={loading}>
            Sign Note
          </Button>
        )}
      </Space>
    </div>
  );
};

export default DocumentationStatusBanner;
