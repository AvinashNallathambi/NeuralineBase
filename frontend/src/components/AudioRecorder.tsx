import React, { useState, useRef, useCallback } from 'react';
import { Button, Space, Tag, Typography, Progress, message } from 'antd';
import {
  AudioOutlined,
  PauseCircleOutlined,
  StopOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  disabled?: boolean;
}

/** Pick the first supported mimeType or fall back to browser default. */
function getSupportedMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mt of candidates) {
    if (MediaRecorder.isTypeSupported(mt)) return mt;
  }
  return undefined; // let browser choose default
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, disabled }) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'recorded'>('idle');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);
  // Use a ref to track duration so the onstop callback always reads the
  // latest value instead of a stale closure capture.
  const durationRef = useRef(0);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const current = elapsedRef.current + (Date.now() - startTimeRef.current) / 1000;
      durationRef.current = current;
      setDuration(current);
    }, 200);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    elapsedRef.current = durationRef.current;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus('recorded');
        onRecordingComplete(blob, durationRef.current);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);

      setDuration(0);
      elapsedRef.current = 0;
      durationRef.current = 0;
      setStatus('recording');
      startTimer();
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message.error(
          'Microphone access denied. Please allow microphone access in your browser settings and try again.',
        );
      } else if (error.name === 'NotFoundError') {
        message.error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        message.error('Microphone is in use by another application. Close it and try again.');
      } else {
        message.error(`Recording failed: ${error.message || 'Unknown error'}`);
      }
      console.error('Recording error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRecordingComplete]);

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      stopTimer();
      setStatus('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      startTimer();
      setStatus('recording');
    }
  };

  const stopRecording = () => {
    stopTimer();
    mediaRecorderRef.current?.stop();
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    elapsedRef.current = 0;
    durationRef.current = 0;
    setStatus('idle');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        padding: 16,
        background: status === 'recording' ? '#fff1f0' : status === 'paused' ? '#fffbe6' : '#f6ffed',
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {status === 'recording' && (
              <Tag color="red" icon={<AudioOutlined />}>
                Recording
              </Tag>
            )}
            {status === 'paused' && <Tag color="warning">Paused</Tag>}
            {status === 'recorded' && <Tag color="success">Recorded</Tag>}
            {status === 'idle' && <Tag color="default">Ready</Tag>}
          </Space>
          <Text strong style={{ fontSize: 20, fontFamily: 'monospace' }}>
            {formatTime(duration)}
          </Text>
        </div>

        {status === 'recording' && (
          <Progress
            percent={100}
            status="active"
            showInfo={false}
            strokeColor="#ff4d4f"
            size="small"
          />
        )}

        <Space>
          {status === 'idle' && (
            <Button
              type="primary"
              icon={<AudioOutlined />}
              onClick={startRecording}
              disabled={disabled}
              style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
              size="large"
            >
              Start Recording
            </Button>
          )}

          {status === 'recording' && (
            <>
              <Button icon={<PauseCircleOutlined />} onClick={pauseRecording} size="large">
                Pause
              </Button>
              <Button danger icon={<StopOutlined />} onClick={stopRecording} size="large">
                Stop
              </Button>
            </>
          )}

          {status === 'paused' && (
            <>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={resumeRecording}
                size="large"
                style={{ backgroundColor: '#0D7C8A', borderColor: '#0D7C8A' }}
              >
                Resume
              </Button>
              <Button danger icon={<StopOutlined />} onClick={stopRecording} size="large">
                Stop
              </Button>
            </>
          )}

          {status === 'recorded' && (
            <>
              {audioUrl && <audio controls src={audioUrl} style={{ height: 40 }} />}
              <Button icon={<DeleteOutlined />} onClick={resetRecording} danger>
                Discard
              </Button>
            </>
          )}
        </Space>
      </Space>
    </div>
  );
};

export default AudioRecorder;
