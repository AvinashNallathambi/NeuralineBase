import React, { Suspense, ComponentType } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import ProtectedRoute from '../components/security/ProtectedRoute';
import SessionTimeoutProvider from '../components/security/SessionTimeoutProvider';

// Retry wrapper for dynamic imports – handles stale chunk errors after redeployment
function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    factory().catch((err) => {
      // Only auto-reload once per session to avoid infinite loops
      const key = 'chunk_reload';
      const hasReloaded = sessionStorage.getItem(key);
      if (!hasReloaded) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Return a never-resolving promise while reload happens
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

// Lazy-loaded page components with auto-retry on chunk load failure
const LandingPage = lazyWithRetry(() => import('../pages/landing/LandingPage'));
const DashboardPage = lazyWithRetry(() => import('../pages/dashboard/DashboardPage'));
const PatientListPage = lazyWithRetry(() => import('../pages/patients/PatientListPage'));
const PatientDetailPage = lazyWithRetry(() => import('../pages/patients/PatientDetailPage'));
const AppointmentPage = lazyWithRetry(() => import('../pages/appointments/AppointmentPage'));
const ClinicalPage = lazyWithRetry(() => import('../pages/clinical/ClinicalPage'));
const EncounterDetailPage = lazyWithRetry(() => import('../pages/clinical/EncounterDetailPage'));
const PrescriptionPage = lazyWithRetry(() => import('../pages/prescriptions/PrescriptionPage'));
const NewPrescriptionPage = lazyWithRetry(() => import('../pages/prescriptions/NewPrescriptionPage'));
const LaboratoryPage = lazyWithRetry(() => import('../pages/laboratory/LaboratoryPage'));
const BillingPage = lazyWithRetry(() => import('../pages/billing/BillingPage'));
const ClaimDetailPage = lazyWithRetry(() => import('../pages/billing/ClaimDetailPage'));
// const InsuranceEligibilityPage = lazyWithRetry(() => import('../pages/insurance/InsuranceEligibilityPage'));
// const SuperbillListPage = lazyWithRetry(() => import('../pages/superbill/SuperbillListPage'));
// const SuperbillDetailPage = lazyWithRetry(() => import('../pages/superbill/SuperbillDetailPage'));
// const CreateSuperbillPage = lazyWithRetry(() => import('../pages/superbill/CreateSuperbillPage'));
// const ProviderAvailabilityPage = lazyWithRetry(() => import('../pages/provider-availability/ProviderAvailabilityPage'));
// const ProviderScheduleDetailPage = lazyWithRetry(() => import('../pages/provider-availability/ProviderScheduleDetailPage'));
const AiEncounterPage = lazyWithRetry(() => import('../pages/ai-encounter/AiEncounterPage'));
const TelemedicinePage = lazyWithRetry(() => import('../pages/telemedicine/TelemedicinePage'));
const ReportsPage = lazyWithRetry(() => import('../pages/reports/ReportsPage'));
const SettingsPage = lazyWithRetry(() => import('../pages/settings/SettingsPage'));
const PatientPortalPage = lazyWithRetry(() => import('../pages/portal/PatientPortalPage'));
const LoginPage = lazyWithRetry(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('../pages/auth/ForgotPasswordPage'));

// Suspense fallback spinner
const PageLoader: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      width: '100%',
    }}
  >
    <Spin size="large" tip="Loading..." />
  </div>
);

// Wrap lazy components with Suspense
const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const router = createBrowserRouter([
  // Landing page
  {
    path: '/',
    element: (
      <LazyPage>
        <LandingPage />
      </LazyPage>
    ),
  },

  // Auth routes
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: (
          <LazyPage>
            <LoginPage />
          </LazyPage>
        ),
      },
      {
        path: '/register',
        element: (
          <LazyPage>
            <RegisterPage />
          </LazyPage>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <LazyPage>
            <ForgotPasswordPage />
          </LazyPage>
        ),
      },
    ],
  },

  // Protected app routes – HIPAA: wrapped with ProtectedRoute
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/dashboard',
        element: (
          <LazyPage>
            <DashboardPage />
          </LazyPage>
        ),
      },
      {
        path: '/patients',
        element: (
          <LazyPage>
            <PatientListPage />
          </LazyPage>
        ),
      },
      {
        path: '/patients/:id',
        element: (
          <LazyPage>
            <PatientDetailPage />
          </LazyPage>
        ),
      },
      {
        path: '/appointments',
        element: (
          <LazyPage>
            <AppointmentPage />
          </LazyPage>
        ),
      },
      {
        path: '/clinical',
        element: (
          <LazyPage>
            <ClinicalPage />
          </LazyPage>
        ),
      },
      {
        path: '/clinical/:id',
        element: (
          <LazyPage>
            <EncounterDetailPage />
          </LazyPage>
        ),
      },
      {
        path: '/prescriptions',
        element: (
          <LazyPage>
            <PrescriptionPage />
          </LazyPage>
        ),
      },
      {
        path: '/prescriptions/new',
        element: (
          <LazyPage>
            <NewPrescriptionPage />
          </LazyPage>
        ),
      },
      {
        path: '/laboratory',
        element: (
          <LazyPage>
            <LaboratoryPage />
          </LazyPage>
        ),
      },
      {
        path: '/billing',
        element: (
          <LazyPage>
            <BillingPage />
          </LazyPage>
        ),
      },
      {
        path: '/billing/:id',
        element: (
          <LazyPage>
            <ClaimDetailPage />
          </LazyPage>
        ),
      },
      // {
      //   path: '/eligibility',
      //   element: (
      //     <LazyPage>
      //       <InsuranceEligibilityPage />
      //     </LazyPage>
      //   ),
      // },
      // {
      //   path: '/superbills',
      //   element: (
      //     <LazyPage>
      //       <SuperbillListPage />
      //     </LazyPage>
      //   ),
      // },
      // {
      //   path: '/superbills/new',
      //   element: (
      //     <LazyPage>
      //       <CreateSuperbillPage />
      //     </LazyPage>
      //   ),
      // },
      // {
      //   path: '/superbills/:id',
      //   element: (
      //     <LazyPage>
      //       <SuperbillDetailPage />
      //     </LazyPage>
      //   ),
      // },
      // {
      //   path: '/provider-availability',
      //   element: (
      //     <LazyPage>
      //       <ProviderAvailabilityPage />
      //     </LazyPage>
      //   ),
      // },
      // {
      //   path: '/provider-availability/:id',
      //   element: (
      //     <LazyPage>
      //       <ProviderScheduleDetailPage />
      //     </LazyPage>
      //   ),
      // },
      {
        path: '/ai-encounter',
        element: (
          <LazyPage>
            <AiEncounterPage />
          </LazyPage>
        ),
      },
      {
        path: '/telemedicine',
        element: (
          <LazyPage>
            <TelemedicinePage />
          </LazyPage>
        ),
      },
      {
        path: '/reports',
        element: (
          <LazyPage>
            <ReportsPage />
          </LazyPage>
        ),
      },
      {
        path: '/settings',
        element: (
          <LazyPage>
            <SettingsPage />
          </LazyPage>
        ),
      },
      {
        path: '/portal',
        element: (
          <LazyPage>
            <PatientPortalPage />
          </LazyPage>
        ),
      },
    ],
  },

  // Default redirect
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

const AppRouter: React.FC = () => {
  return (
    <SessionTimeoutProvider>
      <RouterProvider router={router} />
    </SessionTimeoutProvider>
  );
};

export default AppRouter;
