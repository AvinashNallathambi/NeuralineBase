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
  WorkflowTemplate,
  WorkflowInstance,
  CreateWorkflowTemplateDto,
  TransitionWorkflowDto,
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
import { appointmentService } from '../services/appointmentService';
import { workflowService } from '../services/workflowService';

// ── Appointments Store ────────────────────────────────────────────────────────
interface AppointmentStore {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  fetchAppointments: (options?: { page?: number; limit?: number; startDate?: Date; endDate?: Date }) => Promise<void>;
  addAppointment: (appointment: Appointment) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  changeStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
}

export const useAppointmentStore = create<AppointmentStore>(
  (set) => ({
    appointments: [...mockAppointments],
    loading: false,
    error: null,
    
    fetchAppointments: async (options = {}) => {
      set({ loading: true, error: null });
      try {
        const result = await appointmentService.findAll({
          page: options.page || 1,
          limit: options.limit || 100,
          startDate: options.startDate,
          endDate: options.endDate,
        });
        set({ appointments: result.data, loading: false });
      } catch (error) {
        console.error('Failed to fetch appointments:', error);
        set({ 
          error: 'Failed to fetch appointments', 
          loading: false,
        });
        // Keep existing appointments (don't overwrite with mock data)
      }
    },
    
    addAppointment: async (appointment) => {
      set({ loading: true, error: null });
      try {
        const created = await appointmentService.create({
          patientId: appointment.patientId,
          providerId: appointment.providerId,
          type: appointment.type,
          startTime: new Date(appointment.startTime),
          endTime: new Date(appointment.endTime),
          reason: appointment.reason,
          notes: appointment.notes,
          isTelehealth: appointment.isTelehealth,
          location: appointment.location,
          durationMinutes: appointment.durationMinutes,
          remindersEnabled: appointment.remindersEnabled,
        });
        set((s) => ({ 
          appointments: [created, ...s.appointments], 
          loading: false 
        }));
      } catch (error) {
        console.error('Failed to create appointment:', error);
        set({ 
          error: 'Failed to create appointment', 
          loading: false 
        });
        // Fallback to local state update
        set((s) => ({ appointments: [appointment, ...s.appointments] }));
      }
    },
    
    updateAppointment: async (id, updates) => {
      set({ loading: true, error: null });
      try {
        const updated = await appointmentService.update(id, updates);
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? updated : a
          ),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to update appointment:', error);
        set({ 
          error: 'Failed to update appointment', 
          loading: false 
        });
        // Fallback to local state update
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      }
    },
    
    changeStatus: async (id, status) => {
      set({ loading: true, error: null });
      try {
        const updated = await appointmentService.update(id, { status });
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? updated : a
          ),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to change appointment status:', error);
        set({ 
          error: 'Failed to change appointment status', 
          loading: false 
        });
        // Fallback to local state update
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? { ...a, status } : a
          ),
        }));
      }
    },
    
    deleteAppointment: async (id) => {
      set({ loading: true, error: null });
      try {
        await appointmentService.delete(id);
        set((s) => ({
          appointments: s.appointments.filter((a) => a.id !== id),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to delete appointment:', error);
        set({ 
          error: 'Failed to delete appointment', 
          loading: false 
        });
        // Fallback to local state update
        set((s) => ({
          appointments: s.appointments.filter((a) => a.id !== id),
        }));
      }
    },
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
  loading: boolean;
  error: string | null;
  fetchSuperbills: (options?: { patientId?: string; providerId?: string; status?: string }) => Promise<void>;
  addSuperbill: (superbill: Partial<Superbill>) => Promise<void>;
  updateSuperbill: (id: string, updates: Partial<Superbill>) => Promise<void>;
  deleteSuperbill: (id: string) => Promise<void>;
  submitSuperbill: (id: string) => Promise<void>;
}

import { superbillService } from '../services/superbillService';

export const useSuperbillStore = create<SuperbillStore>(
  (set) => ({
    superbills: [...mockSuperbills],
    loading: false,
    error: null,
    
    fetchSuperbills: async (options) => {
      set({ loading: true, error: null });
      try {
        const data = await superbillService.findAll(options);
        set({ superbills: data, loading: false });
      } catch (error) {
        console.error('Failed to fetch superbills:', error);
        set({ error: 'Failed to fetch superbills', loading: false });
      }
    },

    addSuperbill: async (superbill) => {
      set({ loading: true, error: null });
      try {
        const created = await superbillService.create(superbill);
        set((s) => ({ superbills: [created, ...s.superbills], loading: false }));
      } catch (error) {
        console.error('Failed to create superbill:', error);
        set({ error: 'Failed to create superbill', loading: false });
        // Fallback for UI if backend is not available
        const fallback = { ...superbill, id: Math.random().toString() } as Superbill;
        set((s) => ({ superbills: [fallback, ...s.superbills] }));
      }
    },

    updateSuperbill: async (id, updates) => {
      set({ loading: true, error: null });
      try {
        const updated = await superbillService.update(id, updates);
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? updated : sb)),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to update superbill:', error);
        set({ error: 'Failed to update superbill', loading: false });
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? { ...sb, ...updates } : sb)),
        }));
      }
    },

    deleteSuperbill: async (id) => {
      set({ loading: true, error: null });
      try {
        await superbillService.delete(id);
        set((s) => ({
          superbills: s.superbills.filter((sb) => sb.id !== id),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to delete superbill:', error);
        set({ error: 'Failed to delete superbill', loading: false });
        set((s) => ({ superbills: s.superbills.filter((sb) => sb.id !== id) }));
      }
    },

    submitSuperbill: async (id) => {
      set({ loading: true, error: null });
      try {
        const submitted = await superbillService.submitForProcessing(id);
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? submitted : sb)),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to submit superbill:', error);
        set({ error: 'Failed to submit superbill', loading: false });
        set((s) => ({
          superbills: s.superbills.map((sb) =>
            sb.id === id
              ? { ...sb, status: 'submitted', submissionDate: new Date().toISOString() }
              : sb
          ),
        }));
      }
    },
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

// ── User Store ────────────────────────────────────────────────────────────────
interface UserStore {
  users: User[];
}

export const useUserStore = create<UserStore>(
  () => ({
    users: [...mockProviders],
  }),
);

// ── Workflow Store ────────────────────────────────────────────────────────────
interface WorkflowStore {
  templates: WorkflowTemplate[];
  instances: WorkflowInstance[];
  loading: boolean;
  error: string | null;
  fetchTemplates: (options?: { entityType?: string; search?: string }) => Promise<void>;
  fetchInstances: (options?: { entityType?: string; status?: string }) => Promise<void>;
  createTemplate: (dto: CreateWorkflowTemplateDto) => Promise<void>;
  updateTemplate: (id: string, dto: Partial<CreateWorkflowTemplateDto>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  transitionInstance: (entityType: string, entityId: string, dto: TransitionWorkflowDto) => Promise<WorkflowInstance | null>;
}

export const useWorkflowStore = create<WorkflowStore>(
  (set) => ({
    templates: [],
    instances: [],
    loading: false,
    error: null,

    fetchTemplates: async (options) => {
      set({ loading: true, error: null });
      try {
        const result = await workflowService.findAllTemplates({
          page: 1,
          limit: 50,
          ...options,
        });
        set({ templates: result.data, loading: false });
      } catch (error) {
        console.error('Failed to fetch workflow templates:', error);
        set({ error: 'Failed to fetch workflow templates', loading: false });
      }
    },

    fetchInstances: async (options) => {
      set({ loading: true, error: null });
      try {
        const result = await workflowService.findAllInstances({
          page: 1,
          limit: 50,
          ...options,
        });
        set({ instances: result.data, loading: false });
      } catch (error) {
        console.error('Failed to fetch workflow instances:', error);
        set({ error: 'Failed to fetch workflow instances', loading: false });
      }
    },

    createTemplate: async (dto) => {
      set({ loading: true, error: null });
      try {
        const created = await workflowService.createTemplate(dto);
        set((s) => ({ templates: [created, ...s.templates], loading: false }));
      } catch (error) {
        console.error('Failed to create workflow template:', error);
        set({ error: 'Failed to create workflow template', loading: false });
      }
    },

    updateTemplate: async (id, dto) => {
      set({ loading: true, error: null });
      try {
        const updated = await workflowService.updateTemplate(id, dto);
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? updated : t)),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to update workflow template:', error);
        set({ error: 'Failed to update workflow template', loading: false });
      }
    },

    deleteTemplate: async (id) => {
      set({ loading: true, error: null });
      try {
        await workflowService.deleteTemplate(id);
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to delete workflow template:', error);
        set({ error: 'Failed to delete workflow template', loading: false });
      }
    },

    transitionInstance: async (entityType, entityId, dto) => {
      set({ loading: true, error: null });
      try {
        const updated = await workflowService.transition(entityType, entityId, dto);
        set((s) => ({
          instances: s.instances.map((inst) =>
            inst.entityId === entityId && inst.entityType === entityType ? updated : inst
          ),
          loading: false,
        }));
        return updated;
      } catch (error) {
        console.error('Failed to transition workflow:', error);
        set({ error: 'Failed to transition workflow', loading: false });
        return null;
      }
    },
  }),
);
