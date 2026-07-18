import React, { Suspense, ComponentType } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { Spin } from "antd";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import ProtectedRoute from "../components/security/ProtectedRoute";
import PatientRoute from "../components/security/PatientRoute";
import SessionTimeoutProvider from "../components/security/SessionTimeoutProvider";

// Retry wrapper for dynamic imports – handles stale chunk errors after redeployment
function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    factory().catch((err) => {
      // Only auto-reload once per session to avoid infinite loops
      const key = "chunk_reload";
      const hasReloaded = sessionStorage.getItem(key);
      if (!hasReloaded) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        // Return a never-resolving promise while reload happens
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

// Lazy-loaded page components with auto-retry on chunk load failure
const LandingPage = lazyWithRetry(() => import("../pages/landing/LandingPage"));
const PricingPage = lazyWithRetry(() => import("../pages/landing/PricingPage"));
const DashboardPage = lazyWithRetry(
  () => import("../pages/dashboard/DashboardPage"),
);
const PatientListPage = lazyWithRetry(
  () => import("../pages/patients/PatientListPage"),
);
const PatientGroupsPage = lazyWithRetry(
  () => import("../pages/patients/PatientGroupsPage"),
);
const PatientDetailPage = lazyWithRetry(
  () => import("../pages/patients/PatientDetailPage"),
);
const AppointmentPage = lazyWithRetry(
  () => import("../pages/appointments/AppointmentPage"),
);
const ClinicalPage = lazyWithRetry(
  () => import("../pages/clinical/ClinicalPage"),
);
const NewEncounterPage = lazyWithRetry(
  () => import("../pages/clinical/NewEncounterPage"),
);
const EncounterDetailPage = lazyWithRetry(
  () => import("../pages/clinical/EncounterDetailPage"),
);
const PrescriptionPage = lazyWithRetry(
  () => import("../pages/prescriptions/PrescriptionPage"),
);
const PrescriptionDetailPage = lazyWithRetry(
  () => import("../pages/prescriptions/PrescriptionDetailPage"),
);
const NewPrescriptionPage = lazyWithRetry(
  () => import("../pages/prescriptions/NewPrescriptionPage"),
);
const EditPrescriptionPage = lazyWithRetry(
  () => import("../pages/prescriptions/EditPrescriptionPage"),
);
const LaboratoryPage = lazyWithRetry(
  () => import("../pages/laboratory/LaboratoryPage"),
);
const LabOrderDetailPage = lazyWithRetry(
  () => import("../pages/laboratory/LabOrderDetailPage"),
);
const PatientLabHistoryPage = lazyWithRetry(
  () => import("../pages/laboratory/PatientLabHistoryPage"),
);
const BillingPage = lazyWithRetry(() => import("../pages/billing/BillingPage"));
const ClaimDetailPage = lazyWithRetry(
  () => import("../pages/billing/ClaimDetailPage"),
);
const RemittancePage = lazyWithRetry(() => import("../pages/remittance/RemittancePage"));
const DenialsPage = lazyWithRetry(() => import("../pages/denials/DenialsPage"));
const AppealsPage = lazyWithRetry(() => import("../pages/appeals/AppealsPage"));
const UnderpaymentsPage = lazyWithRetry(() => import("../pages/underpayments/UnderpaymentsPage"));
const AutomationPage = lazyWithRetry(() => import("../pages/automation/AutomationPage"));
const EligibilityPage = lazyWithRetry(() => import('../pages/eligibility/EligibilityPage'));
const SuperbillListPage = lazyWithRetry(() => import('../pages/superbills/SuperbillListPage'));
const SuperbillDetailPage = lazyWithRetry(() => import('../pages/superbills/SuperbillDetailPage'));
const CreateSuperbillPage = lazyWithRetry(() => import('../pages/superbills/CreateSuperbillPage'));
const EditSuperbillPage = lazyWithRetry(() => import('../pages/superbills/EditSuperbillPage'));
const WorkflowListPage = lazyWithRetry(() => import('../pages/workflow/WorkflowListPage'));
const WorkflowBuilderPage = lazyWithRetry(() => import('../pages/workflow/WorkflowBuilderPage'));
const ProviderAvailabilityPage = lazyWithRetry(() => import('../pages/provider-availability/ProviderAvailabilityPage'));
const ProviderScheduleDetailPage = lazyWithRetry(() => import('../pages/provider-availability/ProviderScheduleDetailPage'));
const AiEncounterPage = lazyWithRetry(
  () => import("../pages/ai-encounter/AiEncounterPage"),
);
const TelemedicinePage = lazyWithRetry(
  () => import("../pages/telemedicine/TelemedicinePage"),
);
const ReportsPage = lazyWithRetry(() => import("../pages/reports/ReportsPage"));
const SettingsPage = lazyWithRetry(
  () => import("../pages/settings/SettingsPage"),
);
const AdminTrialsPage = lazyWithRetry(
  () => import("../pages/admin/AdminTrialsPage"),
);
const PatientPortalPage = lazyWithRetry(
  () => import("../pages/portal/PatientPortalPage"),
);
const LoginPage = lazyWithRetry(() => import("../pages/auth/LoginPage"));
const RegisterPage = lazyWithRetry(() => import("../pages/auth/RegisterPage"));
const ForgotPasswordPage = lazyWithRetry(
  () => import("../pages/auth/ForgotPasswordPage"),
);

// Patient Portal
const PatientLoginPage = lazyWithRetry(() => import("../pages/auth/PatientLoginPage"));
const PatientPortalLayout = lazyWithRetry(() => import("../layouts/PatientPortalLayout"));
const PortalDashboardPage = lazyWithRetry(() => import("../pages/portal/PortalDashboardPage"));
const PortalAppointmentsPage = lazyWithRetry(() => import("../pages/portal/PortalAppointmentsPage"));
const PortalPrescriptionsPage = lazyWithRetry(() => import("../pages/portal/PortalPrescriptionsPage"));
const PortalLabResultsPage = lazyWithRetry(() => import("../pages/portal/PortalLabResultsPage"));
const PortalBillingPage = lazyWithRetry(() => import("../pages/portal/PortalBillingPage"));
const PortalEobsPage = lazyWithRetry(() => import("../pages/portal/PortalEobsPage"));
const PortalInsurancePage = lazyWithRetry(() => import("../pages/portal/PortalInsurancePage"));
const PortalProfilePage = lazyWithRetry(() => import("../pages/portal/PortalProfilePage"));
const PortalMessagesPage = lazyWithRetry(() => import("../pages/portal/PortalMessagesPage"));
const PortalAiAssistantPage = lazyWithRetry(() => import("../pages/portal/PortalAiAssistantPage"));

// Suspense fallback spinner
const PageLoader: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "60vh",
      width: "100%",
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
    path: "/",
    element: (
      <LazyPage>
        <LandingPage />
      </LazyPage>
    ),
  },

  // Public pricing page
  {
    path: "/pricing",
    element: (
      <LazyPage>
        <PricingPage />
      </LazyPage>
    ),
  },

  // Auth routes
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        element: (
          <LazyPage>
            <LoginPage />
          </LazyPage>
        ),
      },
      {
        path: "/register",
        element: (
          <LazyPage>
            <RegisterPage />
          </LazyPage>
        ),
      },
      {
        path: "/forgot-password",
        element: (
          <LazyPage>
            <ForgotPasswordPage />
          </LazyPage>
        ),
      },
      // Patient portal login (separate from staff login)
      {
        path: "/patient/login",
        element: (
          <LazyPage>
            <PatientLoginPage />
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
        path: "/dashboard",
        element: (
          <LazyPage>
            <DashboardPage />
          </LazyPage>
        ),
      },
      {
        path: "/patients",
        element: (
          <LazyPage>
            <PatientListPage />
          </LazyPage>
        ),
      },
      {
        path: "/patients/:id",
        element: (
          <LazyPage>
            <PatientDetailPage />
          </LazyPage>
        ),
      },
      {
        path: "/patient-groups",
        element: (
          <LazyPage>
            <PatientGroupsPage />
          </LazyPage>
        ),
      },
      {
        path: "/appointments",
        element: (
          <LazyPage>
            <AppointmentPage />
          </LazyPage>
        ),
      },
      {
        path: "/clinical",
        element: (
          <LazyPage>
            <ClinicalPage />
          </LazyPage>
        ),
      },
      {
        path: "/clinical/new",
        element: (
          <LazyPage>
            <NewEncounterPage />
          </LazyPage>
        ),
      },
      {
        path: "/clinical/:id",
        element: (
          <LazyPage>
            <EncounterDetailPage />
          </LazyPage>
        ),
      },
      {
        path: "/prescriptions",
        element: (
          <LazyPage>
            <PrescriptionPage />
          </LazyPage>
        ),
      },
      {
        path: "/prescriptions/new",
        element: (
          <LazyPage>
            <NewPrescriptionPage />
          </LazyPage>
        ),
      },
      {
        path: "/prescriptions/:id/edit",
        element: (
          <LazyPage>
            <EditPrescriptionPage />
          </LazyPage>
        ),
      },
      {
        path: "/prescriptions/:id",
        element: (
          <LazyPage>
            <PrescriptionDetailPage />
          </LazyPage>
        ),
      },
      {
        path: "/laboratory",
        element: (
          <LazyPage>
            <LaboratoryPage />
          </LazyPage>
        ),
      },
      {
        path: "/laboratory/:id",
        element: (
          <LazyPage>
            <LabOrderDetailPage />
          </LazyPage>
        ),
      },
      {
        path: "/laboratory/patient/:patientId",
        element: (
          <LazyPage>
            <PatientLabHistoryPage />
          </LazyPage>
        ),
      },
      {
        path: "/billing",
        element: (
          <LazyPage>
            <BillingPage />
          </LazyPage>
        ),
      },
      {
        path: "/billing/:id",
        element: (
          <LazyPage>
            <ClaimDetailPage />
          </LazyPage>
        ),
      },
      {
        path: "/remittance",
        element: (
          <LazyPage>
            <RemittancePage />
          </LazyPage>
        ),
      },
      {
        path: "/denials",
        element: (
          <LazyPage>
            <DenialsPage />
          </LazyPage>
        ),
      },
      {
        path: "/appeals",
        element: (
          <LazyPage>
            <AppealsPage />
          </LazyPage>
        ),
      },
      {
        path: "/underpayments",
        element: (
          <LazyPage>
            <UnderpaymentsPage />
          </LazyPage>
        ),
      },
      {
        path: "/automation",
        element: (
          <LazyPage>
            <AutomationPage />
          </LazyPage>
        ),
      },
      {
        path: '/eligibility',
        element: (
          <LazyPage>
            <EligibilityPage />
          </LazyPage>
        ),
      },
      {
        path: '/superbills',
        element: (
          <LazyPage>
            <SuperbillListPage />
          </LazyPage>
        ),
      },
      {
        path: '/superbills/new',
        element: (
          <LazyPage>
            <CreateSuperbillPage />
          </LazyPage>
        ),
      },
      {
        path: '/superbills/:id',
        element: (
          <LazyPage>
            <SuperbillDetailPage />
          </LazyPage>
        ),
      },
      {
        path: '/superbills/:id/edit',
        element: (
          <LazyPage>
            <EditSuperbillPage />
          </LazyPage>
        ),
      },
      {
        path: '/provider-availability',
        element: (
          <LazyPage>
            <ProviderAvailabilityPage />
          </LazyPage>
        ),
      },
      {
        path: '/provider-availability/:id',
        element: (
          <LazyPage>
            <ProviderScheduleDetailPage />
          </LazyPage>
        ),
      },
      {
        path: "/ai-encounter",
        element: (
          <LazyPage>
            <AiEncounterPage />
          </LazyPage>
        ),
      },
      {
        path: "/telemedicine",
        element: (
          <LazyPage>
            <TelemedicinePage />
          </LazyPage>
        ),
      },
      {
        path: "/reports",
        element: (
          <LazyPage>
            <ReportsPage />
          </LazyPage>
        ),
      },
      {
        path: "/workflow",
        element: (
          <LazyPage>
            <WorkflowListPage />
          </LazyPage>
        ),
      },
      {
        path: "/workflow/new",
        element: (
          <LazyPage>
            <WorkflowBuilderPage />
          </LazyPage>
        ),
      },
      {
        path: "/workflow/:id",
        element: (
          <LazyPage>
            <WorkflowBuilderPage />
          </LazyPage>
        ),
      },
      {
        path: "/settings",
        element: (
          <LazyPage>
            <SettingsPage />
          </LazyPage>
        ),
      },
      {
        path: "/admin/trials",
        element: (
          <LazyPage>
            <AdminTrialsPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal",
        element: (
          <LazyPage>
            <PatientPortalPage />
          </LazyPage>
        ),
      },
    ],
  },

  // Patient Portal routes – separate layout, patient-only auth
  {
    element: (
      <PatientRoute>
        <PatientPortalLayout />
      </PatientRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <LazyPage>
            <PortalDashboardPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/dashboard",
        element: (
          <LazyPage>
            <PortalDashboardPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/appointments",
        element: (
          <LazyPage>
            <PortalAppointmentsPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/prescriptions",
        element: (
          <LazyPage>
            <PortalPrescriptionsPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/lab-results",
        element: (
          <LazyPage>
            <PortalLabResultsPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/billing",
        element: (
          <LazyPage>
            <PortalBillingPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/eobs",
        element: (
          <LazyPage>
            <PortalEobsPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/insurance",
        element: (
          <LazyPage>
            <PortalInsurancePage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/profile",
        element: (
          <LazyPage>
            <PortalProfilePage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/messages",
        element: (
          <LazyPage>
            <PortalMessagesPage />
          </LazyPage>
        ),
      },
      {
        path: "/portal/ai-assistant",
        element: (
          <LazyPage>
            <PortalAiAssistantPage />
          </LazyPage>
        ),
      },
    ],
  },

  // Default redirect
  {
    path: "*",
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
