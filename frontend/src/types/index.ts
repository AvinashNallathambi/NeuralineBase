// Neuraline EMR - Type Definitions

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'billing_staff' | 'patient';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  specialization?: string;
  department?: string;
  tenantId: string;
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  subscription: 'basic' | 'professional' | 'enterprise';
  isActive: boolean;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  email: string;
  phone: string;
  address: Address;
  emergencyContact: EmergencyContact;
  insurance: Insurance[];
  allergies: Allergy[];
  medicalHistory: MedicalHistory[];
  status: 'active' | 'inactive' | 'deceased';
  avatar?: string;
  bloodType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Insurance {
  id: string;
  provider: string;
  policyNumber: string;
  groupNumber: string;
  subscriberName: string;
  subscriberRelation: string;
  effectiveDate: string;
  expirationDate: string;
  isPrimary: boolean;
}

export interface Allergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  status: 'active' | 'inactive' | 'resolved';
  onsetDate?: string;
}

export interface MedicalHistory {
  id: string;
  condition: string;
  icdCode: string;
  status: 'active' | 'resolved' | 'chronic';
  diagnosedDate: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  reason: string;
  notes?: string;
  isTelehealth: boolean;
  meetingLink?: string;
  reminders: boolean;
  createdAt: string;
}

export type AppointmentType = 'new_patient' | 'follow_up' | 'annual_physical' | 'urgent_care' | 'telehealth' | 'procedure' | 'consultation';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Encounter {
  id: string;
  patientId: string;
  providerId: string;
  appointmentId?: string;
  type: 'office_visit' | 'telehealth' | 'emergency' | 'inpatient' | 'procedure';
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  soapNote?: SOAPNote;
  diagnoses: Diagnosis[];
  vitals?: Vitals;
  treatmentPlan?: TreatmentPlan;
  startTime: string;
  endTime?: string;
  createdAt: string;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface Diagnosis {
  id: string;
  icdCode: string;
  description: string;
  type: 'primary' | 'secondary';
  status: 'active' | 'resolved';
}

export interface Vitals {
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  weight: number;
  height: number;
  bmi: number;
  recordedAt: string;
}

export interface TreatmentPlan {
  id: string;
  description: string;
  goals: string[];
  interventions: string[];
  followUpDate?: string;
  status: 'active' | 'completed' | 'discontinued';
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  encounterId?: string;
  medications: PrescriptionItem[];
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';
  prescribedDate: string;
  pharmacy?: string;
  notes?: string;
}

export interface PrescriptionItem {
  id: string;
  medication: string;
  rxNormCode?: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions?: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  tests: LabTest[];
  status: 'ordered' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'routine' | 'urgent' | 'stat';
  orderedDate: string;
  completedDate?: string;
  notes?: string;
}

export interface LabTest {
  id: string;
  name: string;
  code: string;
  category: string;
  result?: string;
  referenceRange?: string;
  unit?: string;
  status: 'pending' | 'completed' | 'abnormal';
  abnormalFlag?: 'high' | 'low' | 'critical';
}

export interface Claim {
  id: string;
  patientId: string;
  patientName: string;
  encounterId: string;
  providerId: string;
  providerName: string;
  insuranceId: string;
  insuranceProvider: string;
  claimNumber: string;
  status: 'draft' | 'submitted' | 'pending' | 'approved' | 'denied' | 'paid' | 'appealed';
  totalAmount: number;
  approvedAmount?: number;
  paidAmount?: number;
  patientResponsibility?: number;
  serviceDate: string;
  submittedDate?: string;
  items: ClaimItem[];
  diagnosisCodes: string[];
  createdAt: string;
}

export interface ClaimItem {
  id: string;
  cptCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  subject: string;
  body: string;
  isRead: boolean;
  priority: 'normal' | 'urgent';
  attachments?: Attachment[];
  createdAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
}

export interface Notification {
  id: string;
  type: 'appointment' | 'lab_result' | 'prescription' | 'message' | 'billing' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  pendingLabResults: number;
  pendingClaims: number;
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  appointmentsByStatus: Record<string, number>;
  recentActivities: Activity[];
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  user: string;
  timestamp: string;
}

export interface ProviderSchedule {
  id: string;
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isAvailable: boolean;
}

export interface Report {
  id: string;
  name: string;
  type: 'revenue' | 'appointment' | 'clinical' | 'provider_performance';
  dateRange: { start: string; end: string };
  data: Record<string, unknown>;
  generatedAt: string;
}

export interface Superbill {
  id: string;
  patientId: string;
  patientName: string;
  patientDOB: string;
  patientAddress: Address;
  patientPhone: string;
  providerId: string;
  providerName: string;
  providerNPI: string;
  providerAddress: Address;
  encounterId?: string;
  serviceDate: string;
  submissionDate?: string;
  status: 'draft' | 'submitted' | 'processed' | 'paid' | 'rejected';
  insurance: SuperbillInsurance;
  diagnoses: SuperbillDiagnosis[];
  procedures: SuperbillProcedure[];
  charges: SuperbillCharge[];
  totalAmount: number;
  patientResponsibility: number;
  insurancePayment?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuperbillInsurance {
  provider: string;
  policyNumber: string;
  groupNumber: string;
  subscriberName: string;
  subscriberRelation: string;
  payerId: string;
  authorizationNumber?: string;
}

export interface SuperbillDiagnosis {
  id: string;
  icdCode: string;
  description: string;
  type: 'primary' | 'secondary' | 'admitting' | 'working';
}

export interface SuperbillProcedure {
  id: string;
  cptCode: string;
  description: string;
  modifiers?: string[];
  units: number;
  charge: number;
  serviceDate: string;
  diagnosisPointer: string[]; // ICD codes this procedure links to
}

export interface SuperbillCharge {
  id: string;
  description: string;
  amount: number;
  type: 'service' | 'supply' | 'equipment' | 'other';
  taxable: boolean;
}

// ── AI Superbill Types ───────────────────────────────────────────────────────

export interface SuperbillScrubFinding {
  severity: 'critical' | 'warning' | 'info';
  category: 'documentation' | 'coding' | 'compliance' | 'billing';
  message: string;
  suggestion: string;
  field?: string;
}

export interface SuperbillScrubResult {
  qualityScore: number;
  findings: SuperbillScrubFinding[];
  isClean: boolean;
  summary: string;
}

export interface SuperbillDenialRisk {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  topReasons: string[];
  recommendedActions: string[];
  estimatedReimbursement: number;
}

export interface GfeItem {
  service: string;
  cptCode: string;
  charge: number;
  insuranceEstimate: number;
  patientEstimate: number;
}

export interface GoodFaithEstimate {
  totalCharge: number;
  insuranceEstimate: number;
  patientEstimate: number;
  items: GfeItem[];
  disclaimers: string[];
  complianceNotes: string[];
}

export interface SmartCodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  rationale: string;
  suggestedModifiers?: string[];
}

export interface SmartCodeResult {
  suggestedDiagnoses: SmartCodeSuggestion[];
  suggestedProcedures: SmartCodeSuggestion[];
  missingDocumentation: string[];
  codingTips: string[];
}

// ── Workflow Types ────────────────────────────────────────────────────────────

export interface WorkflowStepConfig {
  name: string;
  label: string;
  order: number;
  color: string;
  icon: string;
  allowedTransitions: string[];
  requiredFields?: string[];
  assignableRoles?: string[];
}

export interface WorkflowTransition {
  fromStep: string;
  toStep: string;
  label: string;
  requireConfirmation?: boolean;
  requireNote?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  entityType: string;
  steps: WorkflowStepConfig[];
  transitions?: WorkflowTransition[];
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTransitionLog {
  fromStep: string;
  toStep: string;
  timestamp: string;
  userId: string;
  userName: string;
  note?: string;
}

export interface WorkflowInstance {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  currentStep: string;
  history: WorkflowTransitionLog[];
  metadata: Record<string, unknown>;
  status: string;
  templateId: string;
  template?: WorkflowTemplate;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowTemplateDto {
  name: string;
  description?: string;
  entityType: string;
  steps: Omit<WorkflowStepConfig, 'order'> & { order: number }[];
  transitions?: WorkflowTransition[];
  isActive?: boolean;
}

export interface TransitionWorkflowDto {
  toStep: string;
  note?: string;
  metadata?: Record<string, unknown>;
}
