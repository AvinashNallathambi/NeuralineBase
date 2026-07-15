import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Button, Space, Typography, Badge, Tooltip, Row, Col, Input, List, Avatar, message, Modal } from 'antd';
import {
  VideoCameraOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  DesktopOutlined,
  PhoneOutlined,
  SendOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  VideoCameraAddOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';

const { Text, Title } = Typography;

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  sentAt: string;
}

interface VideoRoomProps {
  sessionId: string;
  roomId: string;
  userId: string;
  role: 'provider' | 'patient' | 'interpreter';
  userName: string;
  token: string;
  onEndCall: () => void;
  onRequestRecordingConsent?: () => void;
  recordingConsent?: boolean;
}

const VideoRoom: React.FC<VideoRoomProps> = ({
  sessionId,
  roomId,
  userId,
  role,
  userName,
  token,
  onEndCall,
  onRequestRecordingConsent,
  recordingConsent = false,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<Array<{ socketId: string; userId?: string; role?: string; name?: string }>>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [recordingConsented, setRecordingConsented] = useState(recordingConsent);

  const startTimer = useCallback(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return interval;
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Initialize local media and socket
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const socket = io(`${import.meta.env.VITE_API_URL || ''}/telemedicine`, {
          transports: ['websocket'],
          auth: { token },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          setConnectionStatus('connected');
          socket.emit('join-room', { sessionId, role, name: userName });
        });

        socket.on('connect_error', () => {
          setConnectionStatus('error');
          message.error('Failed to connect to video server');
        });

        socket.on('joined-room', (data: { role: string; participants: any[] }) => {
          setParticipants(data.participants || []);
          timerInterval = startTimer();
        });

        socket.on('participant-joined', (data: { socketId: string; userId?: string; role?: string; name?: string }) => {
          setParticipants((prev) => [...prev.filter((p) => p.socketId !== data.socketId), data]);
          message.info(`${data.name || 'Participant'} joined the call`);
        });

        socket.on('participant-left', (data: { socketId: string; userId?: string }) => {
          setParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[data.socketId];
            return next;
          });
          if (peersRef.current[data.socketId]) {
            peersRef.current[data.socketId].destroy();
            delete peersRef.current[data.socketId];
          }
        });

        socket.on('offer', (payload: { sdp: RTCSessionDescriptionInit; callerSocketId: string }) => {
          handleReceiveOffer(payload.callerSocketId, payload.sdp);
        });

        socket.on('answer', (payload: { sdp: RTCSessionDescriptionInit; calleeSocketId: string }) => {
          if (peersRef.current[payload.calleeSocketId]) {
            peersRef.current[payload.calleeSocketId].signal(payload.sdp);
          }
        });

        socket.on('ice-candidate', (payload: { candidate: RTCIceCandidateInit; senderSocketId: string }) => {
          if (peersRef.current[payload.senderSocketId]) {
            peersRef.current[payload.senderSocketId].signal(payload.candidate);
          }
        });

        socket.on('chat-message', (msg: ChatMessage) => {
          setChatMessages((prev) => [...prev, msg]);
        });

        socket.on('screen-share-state', (payload: { socketId: string; isSharing: boolean }) => {
          message.info(payload.isSharing ? 'Participant started screen sharing' : 'Participant stopped screen sharing');
        });

        socket.on('recording-consent-requested', () => {
          setShowConsentModal(true);
        });

        socket.on('recording-consent-response', (payload: { userId: string; consented: boolean }) => {
          setRecordingConsented(payload.consented);
          message.info(`Patient ${payload.consented ? 'consented to' : 'declined'} recording`);
        });

        socket.on('session-in-progress', () => {
          // Provider already starts session; patient can ignore.
        });
      } catch (error: any) {
        setConnectionStatus('error');
        message.error(`Could not access camera/microphone: ${error.message}`);
      }
    };

    init();

    return () => {
      if (timerInterval) clearInterval(timerInterval);
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      if (socketRef.current) {
        socketRef.current.emit('leave-room');
        socketRef.current.disconnect();
      }
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [sessionId, roomId, userId, role, userName, token, startTimer]);

  // Create peer as initiator when a new participant joins
  useEffect(() => {
    const newParticipants = participants.filter((p) => p.socketId !== socketRef.current?.id && !peersRef.current[p.socketId]);
    newParticipants.forEach((participant) => {
      createPeer(participant.socketId, true);
    });
  }, [participants]);

  const createPeer = (targetSocketId: string, initiator: boolean) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: localStreamRef.current || undefined,
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        socketRef.current?.emit('offer', { targetSocketId, sdp: data });
      } else if (data.type === 'answer') {
        socketRef.current?.emit('answer', { targetSocketId, sdp: data });
      } else {
        socketRef.current?.emit('ice-candidate', { targetSocketId, candidate: data });
      }
    });

    peer.on('stream', (stream) => {
      setRemoteStreams((prev) => ({ ...prev, [targetSocketId]: stream }));
    });

    peer.on('error', (err) => {
      console.error('Peer error', err);
    });

    peersRef.current[targetSocketId] = peer;
    return peer;
  };

  const handleReceiveOffer = (callerSocketId: string, sdp: RTCSessionDescriptionInit) => {
    const peer = createPeer(callerSocketId, false);
    peer.signal(sdp);
  };

  const handleToggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMicMuted((prev) => !prev);
  };

  const handleToggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff((prev) => !prev);
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      screenShareStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current = null;
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      Object.values(peersRef.current).forEach((peer) => {
        if (localStreamRef.current) peer.addStream(localStreamRef.current);
      });
      setIsScreenSharing(false);
      socketRef.current?.emit('screen-share-state', { isSharing: false });
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenShareStreamRef.current = screenStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
      Object.values(peersRef.current).forEach((peer) => {
        peer.addStream(screenStream);
      });
      setIsScreenSharing(true);
      socketRef.current?.emit('screen-share-state', { isSharing: true });
      screenStream.getVideoTracks()[0].onended = () => handleScreenShare();
    } catch {
      message.error('Screen sharing failed or was cancelled');
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chat-message', { text: chatInput });
    setChatInput('');
  };

  const handleRequestRecordingConsent = () => {
    socketRef.current?.emit('request-recording-consent');
    if (onRequestRecordingConsent) onRequestRecordingConsent();
  };

  const handleConsentResponse = (consented: boolean) => {
    socketRef.current?.emit('recording-consent-response', { consented });
    setRecordingConsented(consented);
    setShowConsentModal(false);
  };

  const handleEndCallInternal = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
    }
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenShareStreamRef.current?.getTracks().forEach((track) => track.stop());
    onEndCall();
  };

  const remoteStreamList = Object.entries(remoteStreams);

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={18}>
          <Card
            title={
              <Space>
                <Badge status={connectionStatus === 'connected' ? 'success' : 'error'} />
                <Text strong>{role === 'provider' ? 'Provider Video Room' : 'Patient Video Visit'}</Text>
                <Badge count={formatDuration(callDuration)} style={{ backgroundColor: '#0D7C8A' }} />
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: remoteStreamList.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
              {/* Local video */}
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#1a1a2e', minHeight: 300 }}>
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 6 }}>
                  <Text style={{ color: '#fff' }}>{userName} (You)</Text>
                </div>
                {isVideoOff && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#16213e' }}>
                    <VideoCameraAddOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                )}
              </div>

              {/* Remote videos */}
              {remoteStreamList.map(([socketId, stream]) => (
                <RemoteVideo key={socketId} socketId={socketId} stream={stream} participants={participants} />
              ))}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <Tooltip title={isMicMuted ? 'Unmute' : 'Mute'}>
                <Button
                  shape="circle"
                  size="large"
                  type={isMicMuted ? 'primary' : 'default'}
                  danger={isMicMuted}
                  icon={isMicMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                  onClick={handleToggleMute}
                />
              </Tooltip>
              <Tooltip title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}>
                <Button
                  shape="circle"
                  size="large"
                  type={isVideoOff ? 'primary' : 'default'}
                  danger={isVideoOff}
                  icon={<VideoCameraOutlined />}
                  onClick={handleToggleVideo}
                />
              </Tooltip>
              <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
                <Button
                  shape="circle"
                  size="large"
                  type={isScreenSharing ? 'primary' : 'default'}
                  icon={<DesktopOutlined />}
                  onClick={handleScreenShare}
                />
              </Tooltip>
              {role === 'provider' && (
                <Tooltip title="Request recording consent">
                  <Button
                    shape="circle"
                    size="large"
                    type={recordingConsented ? 'primary' : 'default'}
                    icon={<MedicineBoxOutlined />}
                    onClick={handleRequestRecordingConsent}
                  />
                </Tooltip>
              )}
              <Tooltip title="End call">
                <Button
                  shape="circle"
                  size="large"
                  type="primary"
                  danger
                  icon={<PhoneOutlined style={{ transform: 'rotate(135deg)' }} />}
                  onClick={handleEndCallInternal}
                />
              </Tooltip>
            </div>

            {recordingConsented && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Badge status="processing" color="red" />
                <Text type="danger" style={{ marginLeft: 8 }}>Recording in progress (consented)</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card
            title={
              <Space>
                <TeamOutlined />
                <Text strong>Participants ({participants.length})</Text>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 16 }}
          >
            <List
              dataSource={participants}
              renderItem={(p) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={p.name || 'Participant'}
                    description={<Text type="secondary" style={{ textTransform: 'capitalize' }}>{p.role || 'Guest'}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card
            title={
              <Space>
                <MedicineBoxOutlined />
                <Text strong>In-Visit Chat</Text>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ height: 280, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: msg.senderId === userId ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      background: msg.senderId === userId ? '#0D7C8A' : '#fff',
                      color: msg.senderId === userId ? '#fff' : '#1a2b3c',
                      padding: '8px 14px',
                      borderRadius: msg.senderId === userId ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}
                  >
                    <Text style={{ fontSize: 11, display: 'block', marginBottom: 2, color: msg.senderId === userId ? 'rgba(255,255,255,0.7)' : '#8c8c8c' }}>
                      {msg.senderName} · {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={{ color: msg.senderId === userId ? '#fff' : '#1a2b3c', fontSize: 13 }}>{msg.text}</Text>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
              <Input
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={handleSendMessage}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage} />
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Recording Consent"
        open={showConsentModal}
        onCancel={() => handleConsentResponse(false)}
        onOk={() => handleConsentResponse(true)}
        okText="I Consent"
        cancelText="Decline"
      >
        <Text>
          Your provider is requesting permission to record this telehealth visit for documentation purposes.
          Do you consent to being recorded?
        </Text>
      </Modal>
    </div>
  );
};

const RemoteVideo: React.FC<{
  socketId: string;
  stream: MediaStream;
  participants: Array<{ socketId: string; name?: string; role?: string }>;
}> = ({ socketId, stream, participants }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const participant = participants.find((p) => p.socketId === socketId);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#1a1a2e', minHeight: 300 }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 6 }}>
        <Text style={{ color: '#fff' }}>{participant?.name || 'Remote Participant'}</Text>
      </div>
    </div>
  );
};

export default VideoRoom;
