import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Input, List, message, Spin, Tag, Typography, Space, Tooltip, Modal } from 'antd';
import {
  ArrowLeftOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
  SendOutlined,
  MessageOutlined,
  DesktopOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { telemedicineService, type TelemedicineSession } from '../../services/telemedicineService';
import patientPortalService from '../../services/patientPortalService';

const { Title, Text } = Typography;
const { TextArea } = Input;

// STUN/TURN servers — coturn from docker-compose.yml
// In production, set VITE_TURN_SERVERS to a JSON array of RTCIceServer configs
// with your public IP and real credentials.
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function getIceServers(): RTCIceServer[] {
  const envServers = import.meta.env.VITE_TURN_SERVERS as string | undefined;
  if (envServers) {
    try {
      const parsed = JSON.parse(envServers) as RTCIceServer[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore parse error, fall back to defaults
    }
  }
  // Default local-dev coturn (assumes docker-compose on localhost)
  return [
    ...DEFAULT_ICE_SERVERS,
    {
      urls: 'turn:localhost:3478',
      username: import.meta.env.VITE_TURN_USER || 'neuraline',
      credential: import.meta.env.VITE_TURN_PASSWORD || 'neuraline_turn_dev',
    },
  ];
}

// Backend WebSocket URL — defaults to the API host with ws protocol
function getSocketUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
  // Strip /api/v1 suffix and use the host root for the socket namespace
  const hostRoot = apiBase.replace(/\/api\/v\d+\/?$/, '');
  return hostRoot;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  sentAt: string;
}

const TelemedicineCallPage: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const isPatient = !!sessionStorage.getItem('neuraline_patient_token');

  const [session, setSession] = useState<TelemedicineSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'waiting' | 'in-call' | 'ended'>('connecting');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [recordingConsentGranted, setRecordingConsentGranted] = useState(false);
  const [recordingConsentRequested, setRecordingConsentRequested] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [endingCall, setEndingCall] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chatListRef = useRef<HTMLDivElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Load the session metadata
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      setLoading(true);
      try {
        // Use the patient portal service if the user is a patient
        // (patient JWT in sessionStorage), otherwise use the staff service.
        const isPatient = !!sessionStorage.getItem('neuraline_patient_token');
        const s = isPatient
          ? await patientPortalService.getTelemedicineSession(sessionId)
          : await telemedicineService.getSession(sessionId);
        setSession(s as TelemedicineSession);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load telemedicine session');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // ── MediaRecorder: capture the local stream for upload on call end ──────
  const startRecording = useCallback((stream: MediaStream) => {
    try {
      // Prefer webm; fall back to mp4 for Safari
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.start(10000); // gather data in 10s chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.warn('MediaRecorder failed to start — visit will not be recorded:', err);
    }
  }, []);

  const stopAndUploadRecording = useCallback(async (): Promise<void> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    // Stop the recorder and wait for the final chunk
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (recordedChunksRef.current.length === 0) return;

    const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    const filename = `session-${sessionId}.${(recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`;

    try {
      await telemedicineService.uploadRecording(sessionId!, blob, filename);
      message.success('Visit recording uploaded. Transcription will begin shortly.');
    } catch (err) {
      console.error('Failed to upload recording:', err);
      message.warning('Visit recording could not be uploaded — SOAP note may be incomplete.');
    }
  }, [sessionId]);

  // ── WebRTC connection setup ──────────────────────────────────────────────
  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    peerConnectionRef.current = pc;

    // Add local tracks
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    // Receive remote tracks
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    // ICE candidate handling — relay through the socket gateway
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        // Broadcast to all other participants in the room
        socketRef.current.emit('ice-candidate', {
          targetSocketId: '*', // gateway will relay to room
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setCallStatus('in-call');
      } else if (state === 'disconnected' || state === 'failed') {
        setCallStatus('waiting');
      } else if (state === 'closed') {
        setCallStatus('ended');
      }
    };

    return pc;
  }, []);

  // ── Main call setup effect ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || loading || error || !session) return;

    let cancelled = false;

    const startCall = async () => {
      try {
        // 1. Get user media (camera + mic)
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // 2. Start recording the local stream
        startRecording(localStream);

        // 3. Connect to the Socket.IO telemedicine gateway
        const token = sessionStorage.getItem('neuraline_token') || sessionStorage.getItem('neuraline_patient_token');
        const socket = io(`${getSocketUrl()}/telemedicine`, {
          auth: { token },
          transports: ['websocket'],
        });
        socketRef.current = socket;

        socket.on('connect', async () => {
          // 4. Join the session room
          const role = sessionStorage.getItem('neuraline_patient_token') ? 'patient' : 'provider';
          socket.emit('join-room', {
            sessionId,
            role,
            name: role === 'provider' ? 'Provider' : 'Patient',
          });
        });

        socket.on('joined-room', () => {
          setCallStatus((prev) => (prev === 'in-call' ? prev : 'waiting'));
          // 5. Set up the peer connection and send an offer to any existing participants
          const pc = setupPeerConnection();
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              socket.emit('offer', {
                targetSocketId: '*',
                sdp: pc.localDescription,
              });
            })
            .catch((err) => console.error('Offer creation failed:', err));
        });

        socket.on('participant-joined', async (data: { socketId: string; userId: string; role: string; name: string }) => {
          // A new participant joined — send them an offer
          const pc = peerConnectionRef.current || setupPeerConnection();
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { targetSocketId: data.socketId, sdp: offer });
          } catch (err) {
            console.error('Failed to send offer to new participant:', err);
          }
        });

        socket.on('participant-left', () => {
          setCallStatus('waiting');
        });

        socket.on('offer', async (data: { sdp: RTCSessionDescriptionInit; callerSocketId: string }) => {
          const pc = peerConnectionRef.current || setupPeerConnection();
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { targetSocketId: data.callerSocketId, sdp: answer });
          } catch (err) {
            console.error('Failed to handle offer:', err);
          }
        });

        socket.on('answer', async (data: { sdp: RTCSessionDescriptionInit; calleeSocketId: string }) => {
          const pc = peerConnectionRef.current;
          if (pc && pc.signalingState !== 'stable') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            } catch (err) {
              console.error('Failed to handle answer:', err);
            }
          }
        });

        socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit; senderSocketId: string }) => {
          const pc = peerConnectionRef.current;
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              // ICE errors are common during negotiation race conditions — log but don't fail
              console.debug('ICE candidate error (non-fatal):', err);
            }
          }
        });

        socket.on('chat-message', (msg: ChatMessage) => {
          setChatMessages((prev) => [...prev, msg]);
        });

        socket.on('session-in-progress', () => {
          setCallStatus('in-call');
        });

        // Recording consent flow
        socket.on('recording-consent-requested', () => {
          setRecordingConsentRequested(true);
          Modal.confirm({
            title: 'Recording Consent',
            content: 'The provider is requesting consent to record this telehealth visit. The recording will be used for clinical documentation. Do you consent?',
            okText: 'I Consent',
            cancelText: 'I Decline',
            onOk: () => {
              socket.emit('recording-consent-response', { granted: true });
              setRecordingConsentGranted(true);
            },
            onCancel: () => {
              socket.emit('recording-consent-response', { granted: false });
            },
          });
        });

        socket.on('recording-consent-response', (data: { granted: boolean; userId: string }) => {
          if (data.granted) {
            setRecordingConsentGranted(true);
            message.success('Patient has consented to recording.');
          } else {
            setRecordingConsentGranted(false);
            message.warning('Patient declined recording consent. Recording has been stopped.');
            // Stop recording if in progress
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
            }
          }
        });

        // Screen share state from remote participant
        socket.on('screen-share-state', (data: { isSharing: boolean; userId: string }) => {
          if (data.isSharing) {
            message.info('The other participant is sharing their screen.');
          } else {
            message.info('Screen sharing stopped.');
          }
        });

        socket.on('error', (data: { message: string }) => {
          message.error(data.message || 'Telemedicine connection error');
        });

        socket.on('connect_error', (err: Error) => {
          setError(`Failed to connect to telemedicine server: ${err.message}`);
        });
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to access camera/microphone. Please check browser permissions.');
        }
      }
    };

    startCall();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, loading, error, session, startRecording, setupPeerConnection]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMicMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsVideoMuted((prev) => !prev);
  };

  // ── Screen share ──────────────────────────────────────────────────────────
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen share — restore original camera track
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const pc = peerConnectionRef.current;
      const localStream = localStreamRef.current;
      const sender = pc?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && originalVideoTrackRef.current) {
        sender.replaceTrack(originalVideoTrackRef.current);
      }
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
      socketRef.current?.emit('screen-share-state', { isSharing: false });
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      screenStreamRef.current = screenStream;

      const pc = peerConnectionRef.current;
      const localStream = localStreamRef.current;
      const videoSender = pc?.getSenders().find((s) => s.track?.kind === 'video');

      // Save original video track for restoration
      if (localStream && !originalVideoTrackRef.current) {
        originalVideoTrackRef.current = localStream.getVideoTracks()[0];
      }

      // Replace the video track in the peer connection
      const screenTrack = screenStream.getVideoTracks()[0];
      if (videoSender) {
        await videoSender.replaceTrack(screenTrack);
      }

      // Update local preview to show screen share
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      // Handle user clicking "Stop sharing" in browser UI
      screenTrack.onended = () => {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }
        if (videoSender && originalVideoTrackRef.current) {
          videoSender.replaceTrack(originalVideoTrackRef.current);
        }
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        setIsScreenSharing(false);
        socketRef.current?.emit('screen-share-state', { isSharing: false });
      };

      setIsScreenSharing(true);
      socketRef.current?.emit('screen-share-state', { isSharing: true });
    } catch (err: any) {
      message.error('Failed to start screen sharing: ' + (err?.message || 'permission denied'));
    }
  };

  // ── Recording consent request (provider only) ─────────────────────────────
  const requestRecordingConsent = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('request-recording-consent');
    setRecordingConsentRequested(true);
    message.info('Recording consent request sent to patient.');
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit('chat-message', { text: chatInput });
    setChatInput('');
  };

  const handleEndCall = useCallback(async () => {
    if (endingCall) return;
    setEndingCall(true);
    try {
      const isPatient = !!sessionStorage.getItem('neuraline_patient_token');

      // 1. Stop recording and upload the blob (both provider and patient
      //    upload their local recordings — the backend uses the provider's
      //    recording for transcription, but having both is useful for
      //    redundancy)
      await stopAndUploadRecording();

      if (isPatient) {
        // Patients just leave the room — they do NOT trigger endSession
        // (which generates SOAP notes, encounters, superbills). Only the
        // provider ends the clinical visit.
        if (socketRef.current) {
          socketRef.current.emit('leave-room');
          socketRef.current.disconnect();
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        message.info('You have left the visit.');
      } else {
        // 2. End the session on the backend — this triggers:
        //    AssemblyAI transcription → SOAP note → encounter → draft superbill
        await telemedicineService.endSession(sessionId!, {
          generateEncounter: true,
          generateSuperbill: true,
        });
        message.success('Visit ended. Encounter and superbill are being generated.');

        // 3. Disconnect socket and clean up
        if (socketRef.current) {
          socketRef.current.emit('leave-room');
          socketRef.current.disconnect();
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      }
      setCallStatus('ended');
    } catch (err: any) {
      message.error('Failed to end visit cleanly: ' + (err?.message || 'unknown error'));
    } finally {
      setEndingCall(false);
      // Navigate back after a short delay so the user sees the success message
      setTimeout(() => navigate(-1), 1500);
    }
  }, [endingCall, sessionId, stopAndUploadRecording, navigate]);

  // Warn before closing the tab during a call
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (callStatus === 'in-call' || isRecording) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [callStatus, isRecording]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading telemedicine session..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Title level={4} type="danger">Cannot start visit</Title>
          <Text type="danger">{error}</Text>
          <div style={{ marginTop: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
          <Title level={4} style={{ margin: 0 }}>
            Telehealth Visit
          </Title>
          {callStatus === 'connecting' && <Tag color="processing">Connecting…</Tag>}
          {callStatus === 'waiting' && <Tag color="blue">Waiting for patient…</Tag>}
          {callStatus === 'in-call' && <Tag color="green">In Call</Tag>}
          {callStatus === 'ended' && <Tag color="default">Ended</Tag>}
          {isRecording && (
            <Tag color="red" icon={<CloseCircleOutlined />}>
              REC
            </Tag>
          )}
          {recordingConsentGranted && (
            <Tag color="green" icon={<ExclamationCircleOutlined />}>
              Consent: Yes
            </Tag>
          )}
          {recordingConsentRequested && !recordingConsentGranted && (
            <Tag color="gold" icon={<ExclamationCircleOutlined />}>
              Consent: Pending
            </Tag>
          )}
          {isScreenSharing && (
            <Tag color="blue" icon={<DesktopOutlined />}>
              Sharing Screen
            </Tag>
          )}
        </Space>
        {session?.patientId && (
          <Text type="secondary">Patient ID: {session.patientId}</Text>
        )}
      </div>

      {/* Video area + chat sidebar */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Video area */}
        <Card
          bodyStyle={{ padding: 0, height: '100%', position: 'relative', background: '#000', borderRadius: 8 }}
          style={{ flex: 1, overflow: 'hidden' }}
        >
          {/* Remote video (full size) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {callStatus === 'waiting' && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexDirection: 'column',
              gap: 12,
            }}>
              <Spin size="large" />
              <Text style={{ color: '#fff' }}>Waiting for the other participant to join…</Text>
            </div>
          )}

          {/* Local video (picture-in-picture) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 200,
              height: 150,
              objectFit: 'cover',
              borderRadius: 8,
              border: '2px solid #fff',
              background: '#000',
              transform: 'scaleX(-1)', // mirror
            }}
          />

          {/* Call controls */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            background: 'rgba(0,0,0,0.6)',
            padding: '8px 16px',
            borderRadius: 24,
          }}>
            <Tooltip title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}>
              <Button
                shape="circle"
                size="large"
                icon={isMicMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                onClick={toggleMic}
                danger={isMicMuted}
              />
            </Tooltip>
            <Tooltip title={isVideoMuted ? 'Turn On Camera' : 'Turn Off Camera'}>
              <Button
                shape="circle"
                size="large"
                icon={<VideoCameraOutlined />}
                onClick={toggleVideo}
                danger={isVideoMuted}
              />
            </Tooltip>
            <Tooltip title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}>
              <Button
                shape="circle"
                size="large"
                icon={<DesktopOutlined />}
                onClick={toggleScreenShare}
                type={isScreenSharing ? 'primary' : 'default'}
              />
            </Tooltip>
            {/* Recording consent request — provider only */}
            {!isPatient && !recordingConsentRequested && !recordingConsentGranted && (
              <Tooltip title="Request Recording Consent">
                <Button
                  shape="circle"
                  size="large"
                  icon={<ExclamationCircleOutlined />}
                  onClick={requestRecordingConsent}
                />
              </Tooltip>
            )}
            <Tooltip title="End Call">
              <Button
                shape="circle"
                size="large"
                type="primary"
                danger
                icon={<PhoneOutlined />}
                loading={endingCall}
                onClick={() => {
                  const isPatient = !!sessionStorage.getItem('neuraline_patient_token');
                  Modal.confirm({
                    title: isPatient ? 'Leave this visit?' : 'End this telehealth visit?',
                    content: isPatient
                      ? 'You will leave the video call. The provider will end the visit and generate the clinical note.'
                      : 'The recording will be uploaded and transcribed. An encounter and superbill will be generated automatically.',
                    okText: isPatient ? 'Leave Visit' : 'End Visit',
                    okButtonProps: { danger: true },
                    cancelText: isPatient ? 'Stay in Call' : 'Stay in Call',
                    onOk: handleEndCall,
                  });
                }}
              />
            </Tooltip>
          </div>
        </Card>

        {/* Chat sidebar */}
        <Card
          title={<Space><MessageOutlined /> Chat</Space>}
          style={{ width: 320, display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minHeight: 0 }}
        >
          <div ref={chatListRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {chatMessages.length === 0 ? (
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 24 }}>
                No messages yet
              </Text>
            ) : (
              <List
                dataSource={chatMessages}
                renderItem={(msg) => (
                  <List.Item style={{ border: 'none', padding: '4px 0' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {msg.senderRole} · {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <div>{msg.text}</div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 4 }}>
            <TextArea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onPressEnter={sendChatMessage}
              placeholder="Type a message…"
              autoSize={{ minRows: 1, maxRows: 3 }}
              style={{ flex: 1 }}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={sendChatMessage} />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TelemedicineCallPage;
