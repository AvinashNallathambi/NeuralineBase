import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import patientAuthService from '../../services/patientAuthService';

interface Props {
  children: React.ReactNode;
}

const PatientRoute: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const isAuth = patientAuthService.isAuthenticated();

  if (!isAuth) {
    return <Navigate to="/patient/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default PatientRoute;
