import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Alert, Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import VideoRoom from '../../components/telemedicine/VideoRoom';
import { patientAuthService } from '../../services/patientAuthService';
import { patientPortalService } from '../../services/patientPortalService';
import type { Patient } from '../../services/patientService';

const { Title, Text } = Typography;

const PortalVideoVisitPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Partial<Patient> | null>(null);

  const [token, setToken] = useState<{ token: string; roomUrl: string; roomId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentPatient = patientAuthService.getCurrentPatient();
    if (currentPatient) {
      setPatient(currentPatient);
    }

    if (!sessionId) {
      setError('No session ID provided.');
      setLoading(false);
      return;
    }

    const loadToken = async () => {
      try {
        const data = await patientPortalService.getTelemedicineToken(sessionId);
        setToken(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Unable to join the video visit. Please wait for your provider to start the visit.');
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Preparing your video visit...</Text>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div style={{ padding: 40 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/portal/appointments')} style={{ marginBottom: 24 }}>
          Back to Appointments
        </Button>
        <Alert message="Unable to join visit" description={error || 'Unknown error'} type="error" showIcon />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/portal/appointments')} style={{ marginBottom: 16 }}>
        Leave Visit
      </Button>
      <Title level={3} style={{ marginBottom: 16 }}>Your Video Visit</Title>
      <VideoRoom
        sessionId={sessionId!}
        roomId={token.roomId}
        userId={patient?.id || ''}
        role="patient"
        userName={`${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || patient?.email || 'Patient'}
        token={token.token}
        onEndCall={() => navigate('/portal/appointments')}
      />
    </div>
  );
};

export default PortalVideoVisitPage;
