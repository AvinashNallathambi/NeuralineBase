import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Input,
  Spin,
  message,
  Collapse,
  Alert,
  Row,
  Col,
  Tooltip,
  Divider,
  Typography,
} from 'antd';
import {
  AudioOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  SettingOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  LockOutlined,
  SendOutlined,
} from '@ant-design/icons';
import AudioRecorder from '../AudioRecorder';
import DocumentationStatusBanner from './DocumentationStatusBanner';
import DocumentationQualityCard from './DocumentationQualityCard';
import DocumentationPayerPromptsCard from './DocumentationPayerPromptsCard';
import DocumentationActionDraftsCard from './DocumentationActionDraftsCard';
import DocumentationVersionHistoryDrawer from './DocumentationVersionHistoryDrawer';
import DocumentationEvidencePopover from './DocumentationEvidencePopover';
import DocumentationPreferencesModal from './DocumentationPreferencesModal';
import {
  documentationService,
  DocumentationSession,
  DocumentationSoapNote,
  DocumentationIntelligenceBundle,
  DocumentationEvidence,
} from '../../services/documentationService';

const { TextArea } = Input;
const { Text } = Typography;

interface Props {
  encounterId: string;
  patientId: string;
  providerId: string;
  encounterStatus: string;
  canEdit: boolean;
  onSoapChange: (soap: DocumentationSoapNote) => void;
}

const SOAP_SECTIONS = ['subjective', 'objective', 'assessment', 'plan'] as const;
type SOAPSection = (typeof SOAP_SECTIONS)[number];

const DocumentationPanel: React.FC<Props> = ({
  encounterId,
  patientId,
  providerId,
  encounterStatus,
  canEdit,
  onSoapChange,
}) => {
  const [session, setSession] = useState<DocumentationSession | null>(null);
  const [bundle, setBundle] = useState<DocumentationIntelligenceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [soapValues, setSoapValues] = useState<DocumentationSoapNote>({});
  const [transcript, setTranscript] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [preVisitSummary, setPreVisitSummary] = useState<string | null>(null);
  const [preVisitLoading, setPreVisitLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReadOnly = !canEdit || session?.status === 'signed' || session?.status === 'cancelled';

  // Initialize: find or create session, then fetch intelligence bundle
  useEffect(() => {
    if (encounterId) {
      initSession();
    }
  }, [encounterId]);

  const initSession = async () => {
    setLoading(true);
    try {
      const res = await documentationService.findOrCreateForEncounter(encounterId);
      setSession(res.data);
      setSoapValues(res.data.soapNote || {});
      setTranscript(res.data.transcript || '');
      await fetchIntelligence(res.data.id);
      fetchPreVisit();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to initialize documentation session');
    } finally {
      setLoading(false);
    }
  };

  const fetchIntelligence = async (sessionId: string) => {
    try {
      const res = await documentationService.getWithIntelligence(sessionId);
      setBundle(res.data);
    } catch {
      // non-blocking — intelligence is optional
    }
  };

  const fetchPreVisit = async () => {
    if (!patientId || !providerId) return;
    setPreVisitLoading(true);
    try {
      const res = await documentationService.prepareChart(patientId, providerId);
      setPreVisitSummary(res.data.summary);
    } catch {
      // non-blocking
    } finally {
      setPreVisitLoading(false);
    }
  };

  // Debounced SOAP save
  const handleSoapChange = (section: SOAPSection, value: string) => {
    const newSoap = { ...soapValues, [section]: value };
    setSoapValues(newSoap);
    onSoapChange(newSoap);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!session || isReadOnly) return;

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await documentationService.updateNote(session.id, newSoap);
        setSession(res.data);
      } catch {
        // non-blocking — will retry on next change
      }
    }, 1500);
  };

  // Audio handlers
  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
  };

  const handleTranscribe = async () => {
    if (!audioBlob || !session) {
      message.warning('Record audio first');
      return;
    }
    setActionLoading(true);
    try {
      const res = await documentationService.transcribe(session.id, audioBlob);
      setSession(res.data);
      setTranscript(res.data.transcript || '');
      message.success('Transcription complete');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Transcription failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveTranscript = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await documentationService.saveTranscript(session.id, transcript);
      setSession(res.data);
      message.success('Transcript saved');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save transcript');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateNote = async () => {
    if (!session) return;
    if (!session.transcript?.trim()) {
      message.warning('A transcript is required before generating a note. Record audio or paste a transcript first.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await documentationService.generateNote(session.id);
      setSession(res.data);
      setSoapValues(res.data.soapNote || {});
      onSoapChange(res.data.soapNote || {});
      await fetchIntelligence(session.id);
      message.success('SOAP note generated from transcript');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Note generation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSign = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await documentationService.sign(session.id);
      setSession(res.data);
      await fetchIntelligence(session.id);
      message.success('Documentation signed');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to sign documentation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateDrafts = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      await documentationService.generateActionDrafts(session.id);
      await fetchIntelligence(session.id);
      message.success('AI action drafts generated');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to generate drafts');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendAvs = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      await documentationService.sendAfterVisitSummary(session.id);
      message.success('After-visit summary sent to patient portal');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to send after-visit summary');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuildEvidence = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      await documentationService.buildEvidence(session.id);
      await fetchIntelligence(session.id);
      message.success('Evidence links rebuilt');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to build evidence');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreVersion = (soap: DocumentationSoapNote) => {
    setSoapValues(soap);
    onSoapChange(soap);
    if (session && !isReadOnly) {
      documentationService.updateNote(session.id, soap).then((res) => {
        setSession(res.data);
        message.success('Version restored. A new version will be created on save.');
      }).catch(() => {
        message.error('Failed to restore version');
      });
    }
  };

  const evidence = bundle?.evidence || [];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin tip="Loading documentation session..." />
      </div>
    );
  }

  return (
    <div>
      {/* Status Banner */}
      <DocumentationStatusBanner
        session={session}
        canEdit={canEdit}
        onStart={initSession}
        onSign={handleSign}
        loading={actionLoading}
      />

      {/* Pre-Visit Summary */}
      {preVisitSummary && (
        <Collapse
          size="small"
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'previsit',
              label: 'Pre-Visit Chart Summary',
              children: (
                <div>
                  {preVisitLoading ? <Spin size="small" /> : <p style={{ margin: 0 }}>{preVisitSummary}</p>}
                  <Button size="small" icon={<ReloadOutlined />} onClick={fetchPreVisit} style={{ marginTop: 8 }}>
                    Refresh
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Audio + Transcript section */}
      {!isReadOnly && (
        <Collapse
          size="small"
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'audio',
              label: <span><AudioOutlined /> Audio & Transcript</span>,
              children: (
                <div>
                  <AudioRecorder onRecordingComplete={handleRecordingComplete} disabled={isReadOnly} />
                  {audioBlob && (
                    <Space style={{ marginTop: 8 }}>
                      <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleTranscribe} loading={actionLoading}>
                        Transcribe Audio
                      </Button>
                    </Space>
                  )}
                  <Divider style={{ margin: '12px 0' }} />
                  <Text strong style={{ fontSize: 13 }}>Transcript</Text>
                  <TextArea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={6}
                    placeholder="Transcript will appear here after transcription, or paste/type a transcript manually..."
                    style={{ marginTop: 4 }}
                    disabled={isReadOnly}
                  />
                  <Space style={{ marginTop: 8 }}>
                    <Button size="small" onClick={handleSaveTranscript} loading={actionLoading} disabled={isReadOnly}>
                      Save Transcript
                    </Button>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleGenerateNote}
                      loading={actionLoading}
                      disabled={isReadOnly || !transcript.trim()}
                    >
                      Generate SOAP from Transcript
                    </Button>
                  </Space>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* SOAP Note Editor */}
      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined />
            <span>SOAP Note</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            {!isReadOnly && (
              <Tooltip title="Build evidence links from transcript">
                <Button size="small" icon={<ExperimentOutlined />} onClick={handleBuildEvidence} loading={actionLoading}>
                  Evidence
                </Button>
              </Tooltip>
            )}
            <Button size="small" icon={<HistoryOutlined />} onClick={() => setVersionDrawerOpen(true)}>
              History
            </Button>
            <Tooltip title="Documentation preferences">
              <Button size="small" icon={<SettingOutlined />} onClick={() => setPrefsModalOpen(true)} />
            </Tooltip>
          </Space>
        }
      >
        {SOAP_SECTIONS.map((section) => (
          <div key={section} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: 13 }}>{section}</span>
              <DocumentationEvidencePopover section={section} evidence={evidence} />
            </div>
            <TextArea
              value={soapValues[section] || ''}
              onChange={(e) => handleSoapChange(section, e.target.value)}
              rows={4}
              placeholder={`${section}...`}
              disabled={isReadOnly}
              showCount
            />
          </div>
        ))}
        {!isReadOnly && (
          <Space style={{ marginTop: 4 }}>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerateDrafts}
              loading={actionLoading}
              disabled={!Object.values(soapValues).some((v) => v?.trim())}
            >
              Generate AI Action Drafts
            </Button>
            <Tooltip title="Send after-visit summary to patient portal via secure messaging">
              <Button
                icon={<SendOutlined />}
                onClick={handleSendAvs}
                loading={actionLoading}
                disabled={!Object.values(soapValues).some((v) => v?.trim())}
              >
                Send AVS to Patient
              </Button>
            </Tooltip>
          </Space>
        )}
      </Card>

      {/* Quality Score */}
      {bundle?.quality && (
        <DocumentationQualityCard
          quality={bundle.quality}
          onRefresh={() => session && fetchIntelligence(session.id)}
          loading={actionLoading}
        />
      )}

      {/* Payer Prompts */}
      {bundle?.payerPrompts && bundle.payerPrompts.length > 0 && (
        <DocumentationPayerPromptsCard payerPrompts={bundle.payerPrompts} />
      )}

      {/* Action Drafts */}
      {bundle?.actionDrafts && (
        <DocumentationActionDraftsCard
          drafts={bundle.actionDrafts}
          canEdit={!isReadOnly}
          onRefresh={() => session && fetchIntelligence(session.id)}
        />
      )}

      {/* Version History Drawer */}
      <DocumentationVersionHistoryDrawer
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        sessionId={session?.id || ''}
        currentSoap={soapValues}
        onRestore={handleRestoreVersion}
      />

      {/* Preferences Modal */}
      <DocumentationPreferencesModal
        open={prefsModalOpen}
        onClose={() => setPrefsModalOpen(false)}
        providerId={providerId}
      />
    </div>
  );
};

export default DocumentationPanel;
