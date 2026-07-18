import { create } from 'zustand';
// HIPAA: Removed `persist` middleware – PHI must NOT be written to
// localStorage / IndexedDB.  All clinical data is kept in-memory only
// and seeded from mock data (or fetched from the API) on each session.
import type {
  Appointment, AppointmentStatus, AppointmentType,
  Patient,
  Encounter,
  Prescription,
  LabOrder,
  Claim,
  Message,
  EligibilityVerification,
  CoverageSummary,
  CreateEligibilityVerificationDto,
  EligibilityQuery,
  Superbill,
  WorkflowTemplate,
  WorkflowInstance,
  CreateWorkflowTemplateDto,
  TransitionWorkflowDto,
} from '../types';
import type { Payment, RefillRequest, ImagingOrder } from '../data/mockData';
import {
  mockProviders,
  mockEncounters,
  mockPrescriptions,
  mockLabOrders,
  mockClaims,
  mockMessages,
  mockPayments,
  mockRefillRequests,
  mockImagingOrders,
  mockEligibilityChecks,
  mockSuperbills,
} from '../data/mockData';
import type { User } from '../types';
import { appointmentService } from '../services/appointmentService';
import { workflowService } from '../services/workflowService';
import { patientService } from '../services/patientService';

// Helper to map a backend-format appointment to the frontend Appointment type
// (backend uses appointmentType, reasonForVisit, remindersEnabled, etc.)
const mapBackendAppointment = (raw: any): Appointment => {
  return {
    id: raw.id,
    patientId: raw.patientId,
    patientName: raw.patientName || '',
    providerId: raw.providerId,
    providerName: raw.providerName || '',
    type: (raw.appointmentType || 'follow_up') as AppointmentType,
    status: (raw.status || 'scheduled') as AppointmentStatus,
    startTime: typeof raw.startTime === 'string' ? raw.startTime : raw.startTime?.toISOString?.() || new Date().toISOString(),
    endTime: typeof raw.endTime === 'string' ? raw.endTime : raw.endTime?.toISOString?.() || new Date().toISOString(),
    reason: raw.reasonForVisit || '',
    notes: raw.notes || undefined,
    isTelehealth: raw.isTelehealth ?? false,
    meetingLink: raw.location?.meetingLink || undefined,
    reminders: raw.remindersEnabled ?? true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt?.toISOString?.() || new Date().toISOString(),
    // Group appointment fields — map through so the Appointment Details drawer
    // can render the assigned provider and group participants for group sessions.
    isGroup: raw.isGroup ?? false,
    groupId: raw.groupId ?? null,
    maxParticipants: raw.maxParticipants ?? null,
    groupParticipants: Array.isArray(raw.groupParticipants) ? raw.groupParticipants : null,
  };
};

// Helper to map a backend-format patient to the frontend Patient type
const mapBackendPatient = (raw: any): Patient => {
  return {
    id: raw.id,
    mrn: raw.mrn || '',
    firstName: raw.firstName,
    lastName: raw.lastName,
    dateOfBirth: typeof raw.dateOfBirth === 'string' ? raw.dateOfBirth : raw.dateOfBirth?.toISOString?.() || new Date().toISOString(),
    gender: raw.gender,
    email: raw.email || '',
    phone: raw.phone || '',
    address: raw.address || {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
    emergencyContact: raw.emergencyContact || {
      name: '',
      relationship: '',
      phone: '',
    },
    insurance: (raw.insurances || []).map((ins: any) => ({
      id: ins.id,
      provider: ins.payer?.name || ins.provider || 'Unknown',
      policyNumber: ins.policyNumber || '',
      groupNumber: ins.groupNumber || '',
      subscriberName: ins.subscriberName || '',
      subscriberRelation: ins.subscriberRelation || '',
      effectiveDate: ins.effectiveDate || '',
      expirationDate: ins.expirationDate || '',
      isPrimary: ins.priority === 'primary',
      payerId: ins.payer?.payerId,
    })),
    allergies: raw.allergies || [],
    medicalHistory: raw.medicalHistory || [],
    status: raw.status || 'active',
    avatar: raw.avatar,
    bloodType: raw.bloodType,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : raw.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
};

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
    appointments: [],
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
        const mappedAppointments = result.data.map(mapBackendAppointment);
        set({ appointments: mappedAppointments, loading: false });
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
          patientId: appointment.patientId || undefined,
          providerId: appointment.providerId,
          appointmentType: appointment.type,
          startTime: new Date(appointment.startTime),
          endTime: new Date(appointment.endTime),
          reasonForVisit: appointment.reason,
          notes: appointment.notes,
          isTelehealth: appointment.isTelehealth,
          durationMinutes: appointment.durationMinutes,
          remindersEnabled: appointment.remindersEnabled,
        });
        const mappedCreated = mapBackendAppointment(created);
        set((s) => ({
          appointments: [mappedCreated, ...s.appointments],
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
        const dto: any = {};
        if (updates.type !== undefined) dto.appointmentType = updates.type;
        if (updates.reason !== undefined) dto.reasonForVisit = updates.reason;
        if (updates.status !== undefined) dto.status = updates.status;
        if (updates.startTime !== undefined) dto.startTime = new Date(updates.startTime);
        if (updates.endTime !== undefined) dto.endTime = new Date(updates.endTime);
        if (updates.notes !== undefined) dto.notes = updates.notes;
        if (updates.isTelehealth !== undefined) dto.isTelehealth = updates.isTelehealth;
        if (updates.location !== undefined) dto.location = updates.location;
        if (updates.durationMinutes !== undefined) dto.durationMinutes = updates.durationMinutes;
        if (updates.remindersEnabled !== undefined) dto.remindersEnabled = updates.remindersEnabled;
        if (updates.patientId !== undefined) dto.patientId = updates.patientId || undefined;
        if (updates.providerId !== undefined) dto.providerId = updates.providerId;

        const updated = await appointmentService.update(id, dto);
        const mappedUpdated = mapBackendAppointment(updated);
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? mappedUpdated : a
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
        const mappedUpdated = mapBackendAppointment(updated);
        set((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? mappedUpdated : a
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
  loading: boolean;
  error: string | null;
  fetchPatients: (options?: { page?: number; limit?: number; search?: string; status?: string; gender?: string }) => Promise<void>;
  addPatient: (patient: Patient) => Promise<void>;
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
}

export const usePatientStore = create<PatientStore>(
  (set) => ({
    patients: [],
    loading: false,
    error: null,
    fetchPatients: async (options = {}) => {
      set({ loading: true, error: null });
      try {
        const result = await patientService.findAll({
          page: options.page || 1,
          limit: options.limit || 100,
          search: options.search,
          status: options.status,
          gender: options.gender,
        });
        const mappedPatients = result.data.map(mapBackendPatient);
        set({ patients: mappedPatients, loading: false });
      } catch (error) {
        console.error('Failed to fetch patients:', error);
        set({
          error: 'Failed to fetch patients',
          loading: false,
        });
        // Keep existing patients on error
      }
    },
    addPatient: async (patient) => {
      set({ loading: true, error: null });
      try {
        const backendDto = {
          mrn: patient.mrn,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          email: patient.email,
          phone: patient.phone,
          address: patient.address && patient.address.street ? {
            street1: patient.address.street,
            street2: patient.address.street2,
            city: patient.address.city,
            state: patient.address.state,
            zipCode: patient.address.zipCode,
            country: patient.address.country,
          } : undefined,
          emergencyContact: patient.emergencyContact?.name ? {
            name: patient.emergencyContact.name,
            relationship: patient.emergencyContact.relationship,
            phone: patient.emergencyContact.phone,
            email: patient.emergencyContact.email,
          } : undefined,
          bloodType: patient.bloodType,
          status: patient.status,
        };
        const created = await patientService.create(backendDto);
        const mappedCreated = mapBackendPatient(created);
        set((s) => ({
          patients: [mappedCreated, ...s.patients],
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to create patient:', error);
        set({
          error: 'Failed to create patient',
          loading: false,
        });
        // Fallback to local state update
        set((s) => ({ patients: [patient, ...s.patients] }));
      }
    },
    updatePatient: async (id, updates) => {
      set({ loading: true, error: null });
      try {
        const backendDto: any = {};
        if (updates.firstName) backendDto.firstName = updates.firstName;
        if (updates.lastName) backendDto.lastName = updates.lastName;
        if (updates.dateOfBirth) backendDto.dateOfBirth = updates.dateOfBirth;
        if (updates.gender) backendDto.gender = updates.gender;
        if (updates.email !== undefined) backendDto.email = updates.email;
        if (updates.phone !== undefined) backendDto.phone = updates.phone;
        if (updates.address) {
          backendDto.address = {
            street1: updates.address.street,
            street2: updates.address.street2,
            city: updates.address.city,
            state: updates.address.state,
            zipCode: updates.address.zipCode,
            country: updates.address.country,
          };
        }
        if (updates.emergencyContact) {
          backendDto.emergencyContact = {
            name: updates.emergencyContact.name,
            relationship: updates.emergencyContact.relationship,
            phone: updates.emergencyContact.phone,
            email: updates.emergencyContact.email,
          };
        }
        if (updates.bloodType !== undefined) backendDto.bloodType = updates.bloodType;
        if (updates.status) backendDto.status = updates.status;

        const updated = await patientService.update(id, backendDto);
        const mappedUpdated = mapBackendPatient(updated);
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === id ? mappedUpdated : p
          ),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to update patient:', error);
        set({
          error: 'Failed to update patient',
          loading: false,
        });
        // Fallback to local state update
        set((s) => ({
          patients: s.patients.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      }
    },
    deletePatient: async (id) => {
      set({ loading: true, error: null });
      try {
        await patientService.delete(id);
        set((s) => ({
          patients: s.patients.filter((p) => p.id !== id),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to delete patient:', error);
        set({
          error: 'Failed to delete patient',
          loading: false,
        });
        // Fallback to local state update
        set((s) => ({ patients: s.patients.filter((p) => p.id !== id) }));
      }
    },
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
import { eligibilityService, type EligibilityCounts } from '../services/eligibilityService';

interface EligibilityStore {
  verifications: EligibilityVerification[];
  total: number;
  counts: EligibilityCounts;
  coverageSummary: CoverageSummary | null;
  loading: boolean;
  error: string | null;
  fetchVerifications: (query?: EligibilityQuery) => Promise<void>;
  fetchCounts: () => Promise<void>;
  fetchCoverageSummary: (patientId: string) => Promise<void>;
  createVerification: (dto: CreateEligibilityVerificationDto) => Promise<EligibilityVerification | null>;
  rerunVerification: (id: string) => Promise<EligibilityVerification | null>;
  updateVerification: (id: string, updates: Partial<CreateEligibilityVerificationDto>) => Promise<EligibilityVerification | null>;
  deleteVerification: (id: string) => Promise<void>;
  batchVerify: (patientIds: string[]) => Promise<EligibilityVerification[]>;
}

export const useEligibilityStore = create<EligibilityStore>(
  (set) => ({
    verifications: [...mockEligibilityChecks],
    total: 0,
    counts: { total: 0, active: 0, pending: 0, inactive: 0, failed: 0, error: 0 },
    coverageSummary: null,
    loading: false,
    error: null,

    fetchVerifications: async (query = {}) => {
      set({ loading: true, error: null });
      try {
        const result = await eligibilityService.findAll(query);
        set({ verifications: result.data, total: result.total, loading: false });
      } catch (error) {
        console.error('Failed to fetch eligibility verifications:', error);
        set({ error: 'Failed to fetch eligibility verifications', loading: false });
      }
    },

    fetchCounts: async () => {
      try {
        const counts = await eligibilityService.getCounts();
        set({ counts });
      } catch (error) {
        console.error('Failed to fetch eligibility counts:', error);
      }
    },

    fetchCoverageSummary: async (patientId) => {
      set({ loading: true, error: null });
      try {
        const summary = await eligibilityService.coverageSummary(patientId);
        set({ coverageSummary: summary, loading: false });
      } catch (error) {
        console.error('Failed to fetch coverage summary:', error);
        set({ error: 'Failed to fetch coverage summary', loading: false, coverageSummary: null });
      }
    },

    createVerification: async (dto) => {
      set({ loading: true, error: null });
      try {
        const created = await eligibilityService.create(dto);
        set((s) => ({ verifications: [created, ...s.verifications], loading: false }));
        return created;
      } catch (error) {
        console.error('Failed to create eligibility verification:', error);
        set({ error: 'Failed to create eligibility verification', loading: false });
        return null;
      }
    },

    rerunVerification: async (id) => {
      set({ loading: true, error: null });
      try {
        const updated = await eligibilityService.rerun(id);
        set((s) => ({
          verifications: s.verifications.map((v) => (v.id === id ? updated : v)),
          loading: false,
        }));
        return updated;
      } catch (error) {
        console.error('Failed to rerun verification:', error);
        set({ error: 'Failed to rerun verification', loading: false });
        return null;
      }
    },

    updateVerification: async (id, updates) => {
      set({ loading: true, error: null });
      try {
        const updated = await eligibilityService.update(id, updates);
        set((s) => ({
          verifications: s.verifications.map((v) => (v.id === id ? updated : v)),
          loading: false,
        }));
        return updated;
      } catch (error) {
        console.error('Failed to update verification:', error);
        set({ error: 'Failed to update verification', loading: false });
        return null;
      }
    },

    deleteVerification: async (id) => {
      set({ loading: true, error: null });
      try {
        await eligibilityService.delete(id);
        set((s) => ({
          verifications: s.verifications.filter((v) => v.id !== id),
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to delete verification:', error);
        set({ error: 'Failed to delete verification', loading: false });
      }
    },

    batchVerify: async (patientIds) => {
      set({ loading: true, error: null });
      try {
        const results = await eligibilityService.batchVerify(patientIds);
        set((s) => ({ verifications: [...results, ...s.verifications], loading: false }));
        return results;
      } catch (error) {
        console.error('Failed to run batch verification:', error);
        set({ error: 'Failed to run batch verification', loading: false });
        return [];
      }
    },
  }),
);

// ── Superbill Store ───────────────────────────────────────────────────────────
interface SuperbillStore {
  superbills: Superbill[];
  loading: boolean;
  error: string | null;
  fetchSuperbills: (options?: { patientId?: string; providerId?: string; status?: string }) => Promise<void>;
  addSuperbill: (superbill: Partial<Superbill>) => Promise<Superbill | null>;
  updateSuperbill: (id: string, updates: Partial<Superbill>) => Promise<Superbill | null>;
  deleteSuperbill: (id: string) => Promise<void>;
  submitSuperbill: (id: string) => Promise<Superbill | null>;
  resubmitSuperbill: (id: string) => Promise<Superbill | null>;
  voidSuperbill: (id: string) => Promise<Superbill | null>;
  correctedClaimSuperbill: (id: string) => Promise<Superbill | null>;
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
        return created;
      } catch (error) {
        console.error('Failed to create superbill:', error);
        set({ error: 'Failed to create superbill', loading: false });
        // Fallback for UI if backend is not available
        const fallback = { ...superbill, id: Math.random().toString() } as Superbill;
        set((s) => ({ superbills: [fallback, ...s.superbills] }));
        return fallback;
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
        return updated;
      } catch (error) {
        console.error('Failed to update superbill:', error);
        set({ error: 'Failed to update superbill', loading: false });
        const fallback = { ...updates, id } as Superbill;
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? fallback : sb)),
        }));
        return fallback;
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
        return submitted;
      } catch (error) {
        console.error('Failed to submit superbill:', error);
        set({ error: 'Failed to submit superbill', loading: false });
        const fallback = { status: 'submitted', submissionDate: new Date().toISOString() } as Partial<Superbill>;
        set((s) => ({
          superbills: s.superbills.map((sb) =>
            sb.id === id
              ? { ...sb, ...fallback }
              : sb
          ),
        }));
        return null;
      }
    },

    resubmitSuperbill: async (id) => {
      set({ loading: true, error: null });
      try {
        const resubmitted = await superbillService.resubmit(id);
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? resubmitted : sb)),
          loading: false,
        }));
        return resubmitted;
      } catch (error) {
        console.error('Failed to resubmit superbill:', error);
        set({ error: 'Failed to resubmit superbill', loading: false });
        const fallback = { status: 'resubmitted', submissionDate: new Date().toISOString() } as Partial<Superbill>;
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? { ...sb, ...fallback } : sb)),
        }));
        return null;
      }
    },

    voidSuperbill: async (id) => {
      set({ loading: true, error: null });
      try {
        const voided = await superbillService.markVoid(id);
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? voided : sb)),
          loading: false,
        }));
        return voided;
      } catch (error) {
        console.error('Failed to void superbill:', error);
        set({ error: 'Failed to void superbill', loading: false });
        const fallback = { status: 'voided' } as Partial<Superbill>;
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? { ...sb, ...fallback } : sb)),
        }));
        return null;
      }
    },

    correctedClaimSuperbill: async (id) => {
      set({ loading: true, error: null });
      try {
        const corrected = await superbillService.correctedClaim(id);
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? corrected : sb)),
          loading: false,
        }));
        return corrected;
      } catch (error) {
        console.error('Failed to correct superbill:', error);
        set({ error: 'Failed to correct superbill', loading: false });
        const fallback = { status: 'corrected' } as Partial<Superbill>;
        set((s) => ({
          superbills: s.superbills.map((sb) => (sb.id === id ? { ...sb, ...fallback } : sb)),
        }));
        return null;
      }
    },
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
