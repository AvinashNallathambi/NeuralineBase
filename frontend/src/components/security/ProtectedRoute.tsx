import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store';

/**
 * HIPAA Route Guard
 *
 * Wraps protected routes to ensure only authenticated users can access them.
 * Unauthenticated users are redirected to /login with the original URL
 * preserved so they can be sent back after authentication.
 */

interface Props {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
