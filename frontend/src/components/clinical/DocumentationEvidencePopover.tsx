import React from 'react';
import { Popover, Tag, Typography, Empty } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { DocumentationEvidence } from '../../services/documentationService';

const { Text } = Typography;

interface Props {
  section: 'subjective' | 'objective' | 'assessment' | 'plan';
  evidence: DocumentationEvidence[];
}

const DocumentationEvidencePopover: React.FC<Props> = ({ section, evidence }) => {
  const matches = evidence.filter((e) => e.noteSection === section);

  if (matches.length === 0) return null;

  const bestMatch = matches.reduce((best, e) => (e.matchScore > (best?.matchScore || 0) ? e : best), matches[0]);
  const score = Math.round((bestMatch.matchScore || 0) * 100);

  const content = (
    <div style={{ maxWidth: 360 }}>
      {matches.map((m) => (
        <div key={m.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Tag color={score >= 70 ? 'green' : score >= 40 ? 'orange' : 'default'}>
              {Math.round((m.matchScore || 0) * 100)}% match
            </Tag>
            {m.speakerLabel && <Text type="secondary" style={{ fontSize: 11 }}>{m.speakerLabel}</Text>}
          </div>
          <Text style={{ fontSize: 12, display: 'block', color: '#475569' }}>
            "{m.sourceText.slice(0, 200)}{m.sourceText.length > 200 ? '…' : ''}"
          </Text>
        </div>
      ))}
    </div>
  );

  return (
    <Popover content={content} title="Transcript Evidence" trigger="click" placement="left">
      <InfoCircleOutlined style={{ color: score >= 70 ? '#52c41a' : '#faad14', marginLeft: 4, cursor: 'pointer' }} />
    </Popover>
  );
};

export default DocumentationEvidencePopover;
