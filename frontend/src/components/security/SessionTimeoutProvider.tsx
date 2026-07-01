import React, { useEffect, useRef, useCallback } from 'react';
import { Modal, message } from 'antd';
import { useAuthStore } from '../../store';

/**
 * HIPAA Session Timeout Provider
 *
 * Automatically logs the user out after a period of inactivity.
 * Shows a warning modal 60 seconds before timeout.
 *
 * Default: 15 minutes of inactivity (configurable via SESSION_TIMEOUT_MS).
 */

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;   // 15 minutes
const WARNING_BEFORE_MS  = 60 * 1000;         // Show warning 60s before logout

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown', 'mousemove', 'keydown',
  'scroll', 'touchstart', 'click',
];

interface Props {
  children: React.ReactNode;
  timeoutMs?: number;
}

const SessionTimeoutProvider: React.FC<Props> = ({
  children,
  timeoutMs = SESSION_TIMEOUT_MS,
}) => {
  const { isAuthenticated, logout } = useAuthStore();
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = React.useState(false);

  const handleLogout = useCallback(() => {
    setShowWarning(false);
    message.info('Logged out due to security concern');
    logout();
    // Navigation to /login is handled by the ProtectedRoute redirect
  }, [logout]);

  const resetTimers = useCallback(() => {
    if (!isAuthenticated) return;

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    setShowWarning(false);

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
    }, timeoutMs - WARNING_BEFORE_MS);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);
  }, [isAuthenticated, timeoutMs, handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial timer setup
    resetTimers();

    // Listen for user activity
    const onActivity = () => resetTimers();
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true }),
    );

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, onActivity),
      );
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [isAuthenticated, resetTimers]);

  return (
    <>
      {children}
      <Modal
        title="Session Expiring"
        open={showWarning}
        onOk={resetTimers}
        onCancel={handleLogout}
        okText="Stay Logged In"
        cancelText="Log Out Now"
        closable={false}
        maskClosable={false}
      >
        <p>
          Your session will expire in 60 seconds due to inactivity.
          Click "Stay Logged In" to continue, or you will be logged out
          automatically to protect patient data.
        </p>
      </Modal>
    </>
  );
};

export default SessionTimeoutProvider;
