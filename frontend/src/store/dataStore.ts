import { create } from 'zustand';
// HIPAA: Removed `persist` middleware – PHI must NOT be written to
// localStorage / IndexedDB.  All clinical data is kept in-memory only
// and seeded from mock data (or fetched from the API) on each session.
import type {
  Appointment, AppointmentStatus,
  Patient,
  Encounter,
  Prescription,
  LabOrder,
  Claim,
  Message,
  Notification,
  EligibilityCheck,
  Superbill,
  ProviderSchedule,
  ProviderAvailabilityOverride,
} from '../types';
import type { Payment, RefillRequest, ImagingOrder } from '../data/mockData';
import {
  mockAppointments,
  mockPatients,
  mockProviders,
  mockEncounters,
  mockPrescriptions,
  mockLabOrders,
  mockClaims,
  mockMessages,
  mockNotifications,
  mockPayments,
  mockRefillRequests,
  mockImagingOrders,
  mockRecentActivities,
  mockDashboardStats,
  mockUsers,
  mockAuditLog,
  mockEligibilityChecks,
  mockSuperbills,
  mockProviderSchedules,
  mockAvailabilityOverrides,
} from '../data/mockData';
import type { User, Activity, DashboardStats } from '../types';

// ── Appointments Store ────────────────────────────────────────────────────────
interface AppointmentStore {
  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  changeStatus: (id: string, status: AppointmentStatus) => void;
  deleteAppointment: (id: string) => void;
}

export const useAppointmentStore = create<AppointmentStore>(
  (set) => ({
    appointments: [...mockAppointments],
    addAppointment: (appointment) =>
      set((s) => ({ appointments: [appointment, ...s.appointments] })),
    updateAppointment: (id, updates) =>
      set((s) => ({
        appointments: s.appointments.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      })),
    changeStatus: (id, status) =>
      set((s) => ({
        appointments: s.appointments.map((a) =>
          a.id === id ? { ...a, status } : a
        ),
      })),
    deleteAppointment: (id) =>
      set((s) => ({
        appointments: s.appointments.filter((a) => a.id !== id),
      })),
  }),
);

// ── Patients Store ────────────────────────────────────────────────────────────
interface PatientStore {
  patients: Patient[];
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  deletePatient: (id: string) => void;
}

export const usePatientStore = create<PatientStore>(
  (set) => ({
    patients: [...mockPatients],
    addPatient: (patient) =>
      set((s) => ({ patients: [patient, ...s.patients] })),
    updatePatient: (id, updates) =>
      set((s) => ({
        patients: s.patients.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),
    deletePatient: (id) =>
      set((s) => ({ patients: s.patients.filter((p) => p.id !== id) })),
  }),
);

// ── Encounters Store ──────────────────────────────────────────────────────────
interface EncounterStore {
  encounters: Encounter[];
  addEncounter: (encounter: Encounter) => void;
  updateEncounter: (id: string, updates: Partial<Encounter>) => void;
  deleteEncounter: (id: string) => void;
}

export const useEncounterStore = create<EncounterStore>(
  (set) => ({
    encounters: [...mockEncounters],
    addEncounter: (encounter) =>
      set((s) => ({ encounters: [encounter, ...s.encounters] })),
    updateEncounter: (id, updates) =>
      set((s) => ({
        encounters: s.encounters.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      })),
    deleteEncounter: (id) =>
      set((s) => ({ encounters: s.encounters.filter((e) => e.id !== id) })),
  }),
);

// ── Prescriptions Store ───────────────────────────────────────────────────────
interface PrescriptionStore {
  prescriptions: Prescription[];
  refillRequests: RefillRequest[];
  addPrescription: (prescription: Prescription) => void;
  updatePrescription: (id: string, updates: Partial<Prescription>) => void;
  deletePrescription: (id: string) => void;
  addRefillRequest: (request: RefillRequest) => void;
  updateRefillRequest: (id: string, updates: Partial<RefillRequest>) => void;
}

export const usePrescriptionStore = create<PrescriptionStore>(
  (set) => ({
    prescriptions: [...mockPrescriptions],
    refillRequests: [...mockRefillRequests],
    addPrescription: (prescription) =>
      set((s) => ({ prescriptions: [prescription, ...s.prescriptions] })),
    updatePrescription: (id, updates) =>
      set((s) => ({
        prescriptions: s.prescriptions.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),
    deletePrescription: (id) =>
      set((s) => ({ prescriptions: s.prescriptions.filter((p) => p.id !== id) })),
    addRefillRequest: (request) =>
      set((s) => ({ refillRequests: [request, ...s.refillRequests] })),
    updateRefillRequest: (id, updates) =>
      set((s) => ({
        refillRequests: s.refillRequests.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      })),
  }),
);

// ── Lab Orders Store ──────────────────────────────────────────────────────────
interface LabStore {
  labOrders: LabOrder[];
  imagingOrders: ImagingOrder[];
  addLabOrder: (order: LabOrder) => void;
  updateLabOrder: (id: string, updates: Partial<LabOrder>) => void;
  deleteLabOrder: (id: string) => void;
  addImagingOrder: (order: ImagingOrder) => void;
  updateImagingOrder: (id: string, updates: Partial<ImagingOrder>) => void;
}

export const useLabStore = create<LabStore>(
  (set) => ({
    labOrders: [...mockLabOrders],
    imagingOrders: [...mockImagingOrders],
    addLabOrder: (order) =>
      set((s) => ({ labOrders: [order, ...s.labOrders] })),
    updateLabOrder: (id, updates) =>
      set((s) => ({
        labOrders: s.labOrders.map((o) =>
          o.id === id ? { ...o, ...updates } : o
        ),
      })),
    deleteLabOrder: (id) =>
      set((s) => ({ labOrders: s.labOrders.filter((o) => o.id !== id) })),
    addImagingOrder: (order) =>
      set((s) => ({ imagingOrders: [order, ...s.imagingOrders] })),
    updateImagingOrder: (id, updates) =>
      set((s) => ({
        imagingOrders: s.imagingOrders.map((o) =>
          o.id === id ? { ...o, ...updates } : o
        ),
      })),
  }),
);

// ── Billing Store ─────────────────────────────────────────────────────────────
interface BillingStore {
  claims: Claim[];
  payments: Payment[];
  addClaim: (claim: Claim) => void;
  updateClaim: (id: string, updates: Partial<Claim>) => void;
  deleteClaim: (id: string) => void;
  addPayment: (payment: Payment) => void;
}

export const useBillingStore = create<BillingStore>(
  (set) => ({
    claims: [...mockClaims],
    payments: [...mockPayments],
    addClaim: (claim) =>
      set((s) => ({ claims: [claim, ...s.claims] })),
    updateClaim: (id, updates) =>
      set((s) => ({
        claims: s.claims.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),
    deleteClaim: (id) =>
      set((s) => ({ claims: s.claims.filter((c) => c.id !== id) })),
    addPayment: (payment) =>
      set((s) => ({ payments: [payment, ...s.payments] })),
  }),
);

// ── Messages Store ────────────────────────────────────────────────────────────
interface MessageStore {
  messages: Message[];
  addMessage: (message: Message) => void;
  markAsRead: (id: string) => void;
  deleteMessage: (id: string) => void;
}

export const useMessageStore = create<MessageStore>(
  (set) => ({
    messages: [...mockMessages],
    addMessage: (msg) =>
      set((s) => ({ messages: [msg, ...s.messages] })),
    markAsRead: (id) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, isRead: true } : m
        ),
      })),
    deleteMessage: (id) =>
      set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
  }),
);

// ── Provider Store (read-only reference data) ─────────────────────────────────
interface ProviderStore {
  providers: User[];
}

export const useProviderStore = create<ProviderStore>(
  () => ({
    providers: [...mockProviders],
  }),
);

// ── Eligibility Store ─────────────────────────────────────────────────────────
interface EligibilityStore {
  checks: EligibilityCheck[];
  addCheck: (check: EligibilityCheck) => void;
  updateCheck: (id: string, updates: Partial<EligibilityCheck>) => void;
  deleteCheck: (id: string) => void;
}

export const useEligibilityStore = create<EligibilityStore>(
  (set) => ({
    checks: [...mockEligibilityChecks],
    addCheck: (check) =>
      set((s) => ({ checks: [check, ...s.checks] })),
    updateCheck: (id, updates) =>
      set((s) => ({
        checks: s.checks.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),
    deleteCheck: (id) =>
      set((s) => ({ checks: s.checks.filter((c) => c.id !== id) })),
  }),
);

// ── Superbill Store ───────────────────────────────────────────────────────────
interface SuperbillStore {
  superbills: Superbill[];
  addSuperbill: (superbill: Superbill) => void;
  updateSuperbill: (id: string, updates: Partial<Superbill>) => void;
  deleteSuperbill: (id: string) => void;
}

export const useSuperbillStore = create<SuperbillStore>(
  (set) => ({
    superbills: [...mockSuperbills],
    addSuperbill: (superbill) =>
      set((s) => ({ superbills: [superbill, ...s.superbills] })),
    updateSuperbill: (id, updates) =>
      set((s) => ({
        superbills: s.superbills.map((sb) =>
          sb.id === id ? { ...sb, ...updates } : sb
        ),
      })),
    deleteSuperbill: (id) =>
      set((s) => ({ superbills: s.superbills.filter((sb) => sb.id !== id) })),
  }),
);

// ── Provider Availability Store ───────────────────────────────────────────────
interface ProviderAvailabilityStore {
  schedules: ProviderSchedule[];
  overrides: ProviderAvailabilityOverride[];
  addSchedule: (schedule: ProviderSchedule) => void;
  updateSchedule: (id: string, updates: Partial<ProviderSchedule>) => void;
  deleteSchedule: (id: string) => void;
  addOverride: (override: ProviderAvailabilityOverride) => void;
  updateOverride: (id: string, updates: Partial<ProviderAvailabilityOverride>) => void;
  deleteOverride: (id: string) => void;
}

export const useProviderAvailabilityStore = create<ProviderAvailabilityStore>(
  (set) => ({
    schedules: [...mockProviderSchedules],
    overrides: [...mockAvailabilityOverrides],
    addSchedule: (schedule) =>
      set((s) => ({ schedules: [...s.schedules, schedule] })),
    updateSchedule: (id, updates) =>
      set((s) => ({
        schedules: s.schedules.map((sc) =>
          sc.id === id ? { ...sc, ...updates } : sc
        ),
      })),
    deleteSchedule: (id) =>
      set((s) => ({ schedules: s.schedules.filter((sc) => sc.id !== id) })),
    addOverride: (override) =>
      set((s) => ({ overrides: [override, ...s.overrides] })),
    updateOverride: (id, updates) =>
      set((s) => ({
        overrides: s.overrides.map((o) =>
          o.id === id ? { ...o, ...updates } : o
        ),
      })),
    deleteOverride: (id) =>
      set((s) => ({ overrides: s.overrides.filter((o) => o.id !== id) })),
  }),
);
