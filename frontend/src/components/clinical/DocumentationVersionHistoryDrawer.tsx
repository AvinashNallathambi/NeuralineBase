import React, { useEffect, useState } from 'react';
import { Drawer, Timeline, Tag, Button, Empty, Spin, Typography, Space } from 'antd';
import { HistoryOutlined, RobotOutlined, EditOutlined, LockOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  DocumentationNoteVersion,
  DocumentationSoapNote,
  documentationService,
} from '../../services/documentationService';

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  currentSoap: DocumentationSoapNote;
  onRestore: (soap: DocumentationSoapNote) => void;
}

const sourceConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  ai_generated: { color: 'purple', icon: <RobotOutlined />, label: 'AI Generated' },
  clinician_edited: { color: 'blue', icon: <EditOutlined />, label: 'Clinician Edited' },
  signed: { color: 'green', icon: <LockOutlined />, label: 'Signed' },
};

const DocumentationVersionHistoryDrawer: React.FC<Props> = ({ open, onClose, sessionId, currentSoap, onRestore }) => {
  const [versions, setVersions] = useState<DocumentationNoteVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && sessionId) {
      fetchVersions();
    }
  }, [open, sessionId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await documentationService.getVersions(sessionId);
      setVersions(res.data || []);
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (version: DocumentationNoteVersion) => {
    onRestore(version.soapNote);
    onClose();
  };

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>Version History</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={520}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : versions.length === 0 ? (
        <Empty description="No versions yet" />
      ) : (
        <Timeline
          items={versions.map((v) => {
            const cfg = sourceConfig[v.source] || sourceConfig.clinician_edited;
            return {
              dot: cfg.icon,
              color: cfg.color,
              children: (
                <div style={{ paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      v{v.versionNumber} · {dayjs(v.createdAt).format('MMM D, HH:mm')}
                    </Text>
                  </div>
                  {v.aiModel && (
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                      Model: {v.aiModel}
                    </Text>
                  )}
                  <div style={{ marginTop: 8, padding: 8, background: '#f9fafb', borderRadius: 6, fontSize: 12 }}>
                    {(['subjective', 'objective', 'assessment', 'plan'] as const).map((section) => {
                      const text = v.soapNote[section];
                      if (!text) return null;
                      return (
                        <div key={section} style={{ marginBottom: 4 }}>
                          <Text strong style={{ fontSize: 11, textTransform: 'capitalize' }}>{section}: </Text>
                          <Text style={{ fontSize: 12 }}>{text.slice(0, 120)}{text.length > 120 ? '…' : ''}</Text>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    size="small"
                    icon={<UndoOutlined />}
                    style={{ marginTop: 8 }}
                    onClick={() => handleRestore(v)}
                  >
                    Restore this version
                  </Button>
                </div>
              ),
            };
          })}
        />
      )}
    </Drawer>
  );
};

export default DocumentationVersionHistoryDrawer;
