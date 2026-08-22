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
  street2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
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
  payerId?: string;
  authorizationNumber?: string;
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
  patientId: string | null;
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
  location?: any;
  reminders: boolean;
  remindersEnabled?: boolean;
  durationMinutes?: number;
  createdAt: string;
  // Group appointment fields
  isGroup?: boolean;
  groupId?: string | null;
  maxParticipants?: number | null;
  groupParticipants?: {
    patientId: string;
    patientName: string;
    attended: boolean;
    notes?: string;
  }[] | null;
}

export type AppointmentType = 'new_patient' | 'follow_up' | 'annual_physical' | 'urgent_care' | 'telehealth' | 'procedure' | 'consultation' | 'group_therapy' | 'group_session';
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

export interface ProviderAvailability {
  id: string;
  tenantId: string;
  providerId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isAvailable: boolean;
  slotDuration: number;
  appointmentTypes?: string[];
  locationId?: string | null;
  maxAppointments?: number | null;
  bufferMinutes: number;
  notes?: string | null;
  isRecurring: boolean;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OverrideType = 'time_off' | 'modified_hours' | 'on_call' | 'holiday' | 'break' | 'out_of_office';

export interface ProviderAvailabilityOverride {
  id: string;
  providerId: string;
  overrideDate: string;
  overrideType: OverrideType;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  isRecurring: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  submissionDate?: string | null;
  status: 'draft' | 'submitted' | 'processed' | 'paid' | 'rejected' | 'resubmitted' | 'voided' | 'corrected';
  insurance: SuperbillInsurance;
  diagnoses: SuperbillDiagnosis[];
  procedures: SuperbillProcedure[];
  charges: SuperbillCharge[];
  totalAmount: number;
  patientResponsibility: number;
  insurancePayment?: number | null;
  notes?: string | null;
  posCode?: string;
  facilityName?: string;
  facilityNPI?: string;
  providerTaxId?: string;
  feeSchedule?: string;
  referralNumber?: string;
  claimFrequency?: string;
  admissionDate?: string;
  dischargeDate?: string;
  isEmploymentRelated?: boolean;
  isAutoAccident?: boolean;
  isOtherAccident?: boolean;
  balance?: number;
  payments?: SuperbillPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface SuperbillPayment {
  id: string;
  type: 'copay' | 'insurance_payment' | 'write_off' | 'adjustment';
  amount: number;
  date?: string;
  note?: string;
  source?: string;
  createdAt: string;
}

export interface SuperbillInsurance {
  provider: string;
  policyNumber: string;
  groupNumber: string;
  subscriberName: string;
  subscriberRelation: string;
  payerId: string;
  authorizationNumber?: string | null;
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
  diagnosisPointer: number[]; // Numeric pointer values (1-N) to corresponding diagnoses
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

export type GfeType = 'insured_oon' | 'self_pay' | 'uninsured';
export type GfeStatus = 'draft' | 'delivered' | 'acknowledged' | 'disputed' | 'expired' | 'superseded';
export type DeliveryMethod = 'portal' | 'email' | 'mail' | 'in_person' | 'verbal_witness';
export type VarianceStatus = 'none' | 'under_threshold' | 'over_threshold' | 'disputed' | 'resolved';

export interface AiAccuracyFlags {
  highRisk: boolean;
  riskFactors: string[];
  recommendedActions: string[];
}

export interface ReconciliationData {
  reconciledAt: string;
  finalBilledAmount: number;
  finalPaidAmount: number;
  perItemVariance: Array<{
    cptCode: string;
    estimated: number;
    actual: number;
    variance: number;
  }>;
  accuracyScore: number;
}

export interface GoodFaithEstimate {
  id?: string;
  tenantId?: string;
  patientId?: string;
  patientName?: string;
  superbillId?: string | null;
  encounterId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  gfeType?: GfeType;
  status?: GfeStatus;
  version?: number;
  serviceDate?: string;
  scheduledDate?: string | null;
  totalCharge: number;
  insuranceEstimate: number;
  patientEstimate: number;
  items: GfeItem[];
  disclaimers: string[];
  complianceNotes: string[];
  deliveryMethod?: DeliveryMethod | null;
  deliveredAt?: string | null;
  deliveredBy?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  deliveryDeadline?: string | null;
  isCompliant?: boolean;
  varianceAmount?: number;
  varianceStatus?: VarianceStatus;
  aiAccuracyScore?: number | null;
  aiAccuracyFlags?: AiAccuracyFlags | null;
  patientFriendlyExplanation?: string | null;
  predictedDiagnosisCodes?: Array<{ code: string; description: string; confidence: number }> | null;
  reconciliationData?: ReconciliationData | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NsaVarianceRecord {
  id: string;
  gfeId: string;
  patientId: string;
  claimId?: string | null;
  remittanceClaimId?: string | null;
  gfeAmount: number;
  finalBilledAmount: number;
  varianceAmount: number;
  exceedsThreshold: boolean;
  status: 'detected' | 'notified' | 'disputed' | 'resolved' | 'dismissed';
  notifiedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  perItemVariance: Array<{ cptCode: string; estimated: number; actual: number; variance: number }>;
  createdAt: string;
}

export interface NsaIdrCase {
  id: string;
  patientId: string;
  patientName?: string | null;
  claimId?: string | null;
  gfeId?: string | null;
  varianceRecordId?: string | null;
  jurisdiction: 'federal' | 'state_ca' | 'state_ny' | 'state_tx' | 'state_nj' | 'state_other';
  status: 'open_negotiation' | 'idr_initiated' | 'idr_submitted' | 'won' | 'lost' | 'withdrawn' | 'expired' | 'settled';
  payerName?: string | null;
  qpaAmount?: number | null;
  billedAmount?: number | null;
  initialOffer?: number | null;
  finalOffer?: number | null;
  determinedAmount?: number | null;
  openNegotiationDate?: string | null;
  idrInitiationDeadline?: string | null;
  idrSubmissionDeadline?: string | null;
  eligibilityScore?: number | null;
  eligibilityFactors?: Array<{ factor: string; weight: number; detail: string }> | null;
  expectedRecovery?: number | null;
  winProbability?: number | null;
  winProbabilityFactors?: Array<{ factor: string; impact: string; detail: string }> | null;
  recommendedOffer?: number | null;
  offerRationale?: string | null;
  patientAcuityLetter?: string | null;
  supportDocuments?: Array<{ name: string; type: string; content: string }>;
  encounterNotes?: string | null;
  cptCodes?: string[];
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
}

export interface NsaIdrDeadline {
  id: string;
  idrCaseId: string;
  deadlineType: 'open_negotiation' | 'idr_initiation' | 'idr_submission' | 'cooling_off' | 'payer_response';
  dueDate: string;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'met' | 'missed';
  isMet: boolean;
  metAt?: string | null;
  notificationSent: boolean;
  notes?: string | null;
}

export interface NsaComplianceDashboard {
  totalGfes: number;
  delivered: number;
  acknowledged: number;
  disputed: number;
  onTimeDeliveryRate: number;
  pendingDelivery: number;
  overdueDelivery: number;
  varianceDetected: number;
  varianceOverThreshold: number;
  idrCasesOpen: number;
}

// ── Prior Authorization ─────────────────────────────────────────────

export type PriorAuthStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'approved'
  | 'denied'
  | 'p2p_scheduled'
  | 'appealed'
  | 'expired'
  | 'cancelled'
  | 'superseded';

export type PriorAuthBenefitType = 'medical' | 'pharmacy';
export type PriorAuthSubmissionMethod = 'electronic' | 'portal' | 'fax' | 'phone' | 'mail';
export type PriorAuthUrgency = 'standard' | 'expedited';

export interface PriorAuthCode {
  code: string;
  description: string;
  quantity?: number;
}

export interface PriorAuthDiagnosis {
  code: string;
  description: string;
  isPrimary: boolean;
}

export interface PriorAuthClinicalEvidence {
  summary: string;
  items: Array<{
    type: 'lab' | 'imaging' | 'medication' | 'procedure' | 'encounter' | 'vital' | 'history';
    description: string;
    date: string;
    value?: string;
    source?: string;
  }>;
}

export interface AiRequirementPrediction {
  probability: number;
  isRequired: boolean;
  confidence: number;
  factors: Array<{ factor: string; weight: number; detail: string }>;
  rationale: string;
}

export interface AiApprovalPrediction {
  approvalProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }>;
  recommendations: Array<{ action: string; priority: 'urgent' | 'high' | 'medium' | 'low'; detail: string }>;
  missingDocumentation: string[];
}

export interface AiExpirationPrediction {
  predictedExpiration: string;
  daysUntilExpiration: number;
  expirationRisk: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface PriorAuthRequest {
  id?: string;
  tenantId?: string;
  patientId: string;
  patientName?: string | null;
  encounterId?: string | null;
  superbillId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  benefitType?: PriorAuthBenefitType;
  status?: PriorAuthStatus;
  urgency?: PriorAuthUrgency;
  payerName?: string | null;
  payerId?: string | null;
  planName?: string | null;
  policyNumber?: string | null;
  groupNumber?: string | null;
  eligibilityVerificationId?: string | null;
  procedureCodes: PriorAuthCode[];
  diagnosisCodes?: PriorAuthDiagnosis[];
  clinicalEvidence?: PriorAuthClinicalEvidence | null;
  clinicalNotes?: string | null;
  authLetter?: string | null;
  submissionMethod?: PriorAuthSubmissionMethod | null;
  submittedAt?: string | null;
  submittedBy?: string | null;
  authNumber?: string | null;
  payerResponseAt?: string | null;
  payerDecisionNotes?: string | null;
  denialReason?: string | null;
  denialCode?: string | null;
  serviceDate?: string | null;
  approvedStartDate?: string | null;
  approvedEndDate?: string | null;
  expirationDate?: string | null;
  visitCountApproved?: number | null;
  visitsUsed?: number;
  p2pScheduledAt?: string | null;
  p2pNotes?: string | null;
  assignedTo?: string | null;
  priority?: number;
  dueDate?: string | null;
  estimatedCost?: number | null;
  version?: number;
  supersededById?: string | null;
  aiRequirementPrediction?: AiRequirementPrediction | null;
  aiApprovalPrediction?: AiApprovalPrediction | null;
  aiExpirationPrediction?: AiExpirationPrediction | null;
  autoTriggered?: boolean;
  autoTriggerSource?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PriorAuthAttachment {
  id: string;
  priorAuthRequestId: string;
  patientId: string;
  attachmentType: string;
  title: string;
  description?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  evidenceDate?: string | null;
  isAiGenerated: boolean;
  aiRelevanceScore?: number | null;
  satisfiesCriterion?: string | null;
  createdAt: string;
}

export interface PriorAuthRequirement {
  id: string;
  payerName?: string | null;
  procedureCode: string;
  procedureDescription?: string | null;
  requirementType: 'always' | 'conditional' | 'never';
  conditions: Array<{ field: string; operator: string; value: string; description: string }>;
  requiredCriteria: Array<{ criterion: string; description: string; documentationRequired: boolean }>;
  typicalTurnaroundHours?: number | null;
  typicalValidityDays?: number | null;
  submissionMethods: string[];
  isAiGenerated: boolean;
  isActive: boolean;
  source?: string | null;
}

export interface PriorAuthDashboard {
  total: number;
  byStatus: Record<string, number>;
  byPayer: Array<{ payer: string; count: number; approvalRate: number }>;
  pendingCount: number;
  approvedCount: number;
  deniedCount: number;
  expiringSoon: number;
  expired: number;
  avgTurnaroundHours: number;
  autoTriggeredCount: number;
  topDeniedReasons: Array<{ reason: string; count: number }>;
}

export interface RequirementCheckResult {
  procedureCode: string;
  requirementType: 'always' | 'conditional' | 'never' | 'unknown';
  isRequired: boolean;
  rule: PriorAuthRequirement | null;
  aiPrediction: AiRequirementPrediction | null;
}

export interface AutoTriggerPaResult {
  triggered: boolean;
  reason: string;
  requirements: RequirementCheckResult[];
  draftRequest: Partial<PriorAuthRequest> | null;
  authLetter: string | null;
  createdRequestId?: string;
}

// ── Episode Management ──────────────────────────────────────────────

export type EpisodeStatus = 'active' | 'onhold' | 'cancelled' | 'entered_in_error' | 'finished' | 'planned' | 'waitlist';
export type EpisodeType = 'acute' | 'chronic' | 'episodic' | 'perinatal' | 'surgical' | 'behavioral' | 'preventive';

export interface EpisodeCondition {
  code: string;
  codeSystem: string;
  description: string;
  isPrimary: boolean;
}

export interface EpisodeCareTeamMember {
  providerId: string;
  name: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
}

export interface EpisodeCostSummary {
  totalEncounterCost: number;
  totalLabCost: number;
  totalImagingCost: number;
  totalMedicationCost: number;
  totalCost: number;
  estimatedCost: number | null;
  costVariance: number | null;
  lastCalculatedAt: string;
}

export interface EpisodeOutcome {
  clinicalOutcome: 'improved' | 'stable' | 'deteriorated' | 'resolved' | 'unknown';
  patientSatisfaction: number | null;
  qualityMeasureCompliance: number | null;
  notes: string;
  assessedAt: string;
  assessedBy: string;
}

export interface EpisodeAiInsight {
  autoDetected: boolean;
  detectionConfidence: number;
  predictedTotalCost: number | null;
  pathwayDeviations: string[];
  recommendedActions: string[];
  riskScore: number | null;
  generatedAt: string;
}

export interface EpisodeTimelineEvent {
  date: string;
  type: 'encounter' | 'lab' | 'imaging' | 'medication' | 'care_plan' | 'referral' | 'note';
  title: string;
  description: string;
  encounterId?: string;
}

export interface Episode {
  id: string;
  tenantId?: string;
  patientId: string;
  patientName: string;
  title: string;
  description?: string | null;
  episodeType: EpisodeType;
  status: EpisodeStatus;
  conditions: EpisodeCondition[];
  careTeam: EpisodeCareTeamMember[];
  managingProviderId?: string | null;
  managingProviderName?: string | null;
  startDate: string;
  endDate?: string | null;
  encounterIds: string[];
  carePlanIds: string[];
  costSummary?: EpisodeCostSummary | null;
  outcome?: EpisodeOutcome | null;
  aiInsights?: EpisodeAiInsight | null;
  timeline: EpisodeTimelineEvent[];
  tags: string[];
  notes?: string | null;
  fhirEpisodeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeDashboard {
  totalEpisodes: number;
  activeEpisodes: number;
  finishedEpisodes: number;
  byType: Record<string, number>;
  averageDurationDays: number;
  averageCost: number;
  highRiskEpisodes: number;
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
  availableTransitions?: WorkflowStepConfig[];
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

export type ClinicalTemplateStatus = 'active' | 'inactive' | 'archived' | 'draft';

export interface ClinicalTemplateSoap {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface ClinicalTemplateVitals {
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  temperatureRoute?: string;
  weight?: string;
  weightUnit?: string;
  height?: string;
  heightUnit?: string;
  bmi?: string;
  oxygenSaturation?: string;
  respiratoryRate?: string;
  painScore?: number;
  painLocation?: string;
  bloodGlucose?: string;
  bloodGlucoseContext?: string;
}

export interface ClinicalTemplateDiagnosis {
  code: string;
  description: string;
  isPrimary: boolean;
  type?: 'chronic' | 'acute' | 'rule_out';
  status?: 'active' | 'resolved' | 'ruled_out';
  notes?: string;
}

export interface ClinicalTemplateMedication {
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration?: string;
  refills?: number;
  instructions?: string;
}

export interface ClinicalTemplateProcedure {
  name: string;
  cptCode?: string;
  description: string;
}

export interface ClinicalTemplateOrderLab {
  name: string;
  loincCode?: string;
  priority?: 'routine' | 'stat' | 'asap';
  notes?: string;
}

export interface ClinicalTemplateOrderImaging {
  name: string;
  modality?: string;
  bodyPart?: string;
  priority?: 'routine' | 'stat' | 'asap';
}

export interface ClinicalTemplateOrderReferral {
  specialty: string;
  provider?: string;
  reason: string;
  urgency?: 'routine' | 'urgent' | 'emergent';
}

export interface ClinicalTemplateOrders {
  labs?: ClinicalTemplateOrderLab[];
  imaging?: ClinicalTemplateOrderImaging[];
  referrals?: ClinicalTemplateOrderReferral[];
  procedures?: ClinicalTemplateProcedure[];
}

export interface ClinicalTemplateTreatmentPlan {
  medications?: ClinicalTemplateMedication[];
  procedures?: ClinicalTemplateProcedure[];
  followUp?: string;
  followUpDate?: string;
  followUpProviderName?: string;
  referrals?: Array<{ specialty: string; provider?: string; reason: string; urgency?: string }>;
  goals?: string[];
  interventions?: string[];
  homeInstructions?: string;
  patientEducation?: string[];
  restrictions?: string;
  recallReminder?: string;
}

export interface ClinicalTemplateBillingCode {
  codeType: 'CPT' | 'ICD10' | 'HCPCS' | 'SNOMED';
  code: string;
  description: string;
  isPrimary?: boolean;
}

export interface ClinicalTemplate {
  id: string;
  tenantId: string;
  name: string;
  specialty: string;
  visitType: string;
  description?: string | null;
  icon: string;
  isDefault: boolean;
  isFavorite: boolean;
  usageCount: number;
  status: ClinicalTemplateStatus;
  encounterType?: string | null;
  department?: string | null;
  tags?: string[];
  visitReason?: string;
  chiefComplaint?: string;
  soapTemplate: ClinicalTemplateSoap;
  vitalsTemplate: ClinicalTemplateVitals;
  diagnosisTemplate: ClinicalTemplateDiagnosis[];
  medicationTemplate: ClinicalTemplateMedication[];
  ordersTemplate: ClinicalTemplateOrders;
  treatmentPlanTemplate: ClinicalTemplateTreatmentPlan;
  patientInstructions?: string;
  billingCodes: ClinicalTemplateBillingCode[];
  providerNotes?: string;
  createdBy?: string | null;
  createdByName?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClinicalTemplateDto {
  name: string;
  specialty: string;
  visitType: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
  isFavorite?: boolean;
  status?: ClinicalTemplateStatus;
  encounterType?: string;
  department?: string;
  tags?: string[];
  visitReason?: string;
  chiefComplaint?: string;
  soapTemplate?: ClinicalTemplateSoap;
  vitalsTemplate?: ClinicalTemplateVitals;
  diagnosisTemplate?: ClinicalTemplateDiagnosis[];
  medicationTemplate?: ClinicalTemplateMedication[];
  ordersTemplate?: ClinicalTemplateOrders;
  treatmentPlanTemplate?: ClinicalTemplateTreatmentPlan;
  patientInstructions?: string;
  billingCodes?: ClinicalTemplateBillingCode[];
  providerNotes?: string;
}

export type UpdateClinicalTemplateDto = Partial<CreateClinicalTemplateDto>;

export type EligibilityVerificationStatus = 'pending' | 'active' | 'inactive' | 'failed' | 'error';
export type EligibilityVerificationType = 'real-time' | 'batch' | 'scheduled' | 'manual';
export type EligibilityCoverageStatus = 'active' | 'inactive' | 'terminated' | 'unknown';

export interface CoverageBenefit {
  category: string;
  copay?: number | null;
  coinsurance?: number | null;
  network?: string | null;
  priorAuth?: boolean;
  visitLimit?: number | null;
}

export interface EligibilityVerification {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  patientInsuranceId?: string | null;
  insurancePayerId?: string | null;
  status: EligibilityVerificationStatus;
  verificationType: EligibilityVerificationType;
  coverageStatus: EligibilityCoverageStatus;
  serviceType?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  deductibleIndividual?: number | null;
  deductibleFamily?: number | null;
  deductibleRemaining?: number | null;
  outOfPocketIndividual?: number | null;
  outOfPocketFamily?: number | null;
  outOfPocketRemaining?: number | null;
  copayAmount?: number | null;
  coinsurancePercentage?: number | null;
  authorizationRequired: boolean;
  referralRequired: boolean;
  benefitLimitations?: Record<string, unknown> | null;
  benefits?: CoverageBenefit[] | null;
  planName?: string | null;
  planType?: string | null;
  network?: string | null;
  subscriberName?: string | null;
  subscriberRelation?: string | null;
  patientName?: string | null;
  payerName?: string | null;
  providerName?: string | null;
  policyNumber?: string | null;
  groupNumber?: string | null;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  notes?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageSummary {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  status: EligibilityVerificationStatus;
  coverageStatus: EligibilityCoverageStatus;
  payerName?: string | null;
  providerName?: string | null;
  policyNumber?: string | null;
  groupNumber?: string | null;
  planName?: string | null;
  planType?: string | null;
  network?: string | null;
  subscriberName?: string | null;
  subscriberRelation?: string | null;
  patientName?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  deductibleIndividual?: number | null;
  deductibleFamily?: number | null;
  deductibleRemaining?: number | null;
  outOfPocketIndividual?: number | null;
  outOfPocketFamily?: number | null;
  outOfPocketRemaining?: number | null;
  copayAmount?: number | null;
  coinsurancePercentage?: number | null;
  authorizationRequired: boolean;
  referralRequired: boolean;
  benefitLimitations?: Record<string, unknown> | null;
  benefits?: CoverageBenefit[] | null;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface CreateEligibilityVerificationDto {
  patientId: string;
  appointmentId?: string;
  patientInsuranceId?: string;
  insurancePayerId?: string;
  verificationType?: EligibilityVerificationType;
  serviceType?: string;
  policyNumber?: string;
  groupNumber?: string;
  serviceDate?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface EligibilityQuery {
  page?: number;
  limit?: number;
  patientId?: string;
  appointmentId?: string;
  status?: EligibilityVerificationStatus;
  serviceType?: string;
  verifiedFrom?: string;
  verifiedTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// ── Screening / Outcome Templates ───────────────────────────────────

export type InstrumentCategory = 'depression' | 'anxiety' | 'substance_use' | 'suicide_risk' | 'sdoh' | 'bipolar' | 'adhd' | 'cognitive' | 'trauma' | 'sleep' | 'pain' | 'pediatric' | 'perinatal' | 'custom';
export type QuestionType = 'choice' | 'multi_select' | 'text' | 'number' | 'likert' | 'display';

export interface InstrumentQuestionOption {
  value: string;
  label: string;
  score: number;
  loincAnswerCode?: string;
}

export interface InstrumentQuestion {
  id: string;
  text: string;
  type: QuestionType;
  loincCode?: string;
  helpText?: string;
  options?: InstrumentQuestionOption[];
  required: boolean;
}

export interface ScoringRange {
  min: number;
  max: number;
  label: string;
  severity: 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';
  color: string;
  recommendation?: string;
}

export interface ScoringCategory {
  label: string;
  condition: string;
  severity: 'low' | 'moderate' | 'high';
  recommendation: string;
}

export interface ScoringRule {
  type: 'sum' | 'categorical' | 'custom';
  ranges?: ScoringRange[];
  categories?: ScoringCategory[];
}

export interface AdministrationRule {
  mode: 'patient_self' | 'staff_administered' | 'either';
  frequency: 'annual' | 'per_visit' | 'every_n_days' | 'on_trigger' | 'one_time';
  minAge?: number;
  maxAge?: number;
  sex?: 'M' | 'F' | 'any';
  triggers?: string[];
  alertThresholds?: Array<{ condition: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
}

export interface ScreeningInstrument {
  id: string;
  tenantId?: string;
  code: string;
  title: string;
  description?: string | null;
  category: InstrumentCategory;
  isPredefined: boolean;
  isLocked: boolean;
  loincCode?: string | null;
  version: string;
  questions: InstrumentQuestion[];
  scoringRules?: ScoringRule | null;
  administrationRules?: AdministrationRule | null;
  estimatedMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ScreeningResultStatus = 'in_progress' | 'completed' | 'discontinued';

export interface QuestionAnswer {
  questionId: string;
  questionText: string;
  answerValue: string;
  answerLabel?: string;
  score?: number;
  loincCode?: string;
  loincAnswerCode?: string;
}

export interface ScoreResult {
  totalScore: number | null;
  category?: string;
  severity?: 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe' | 'low' | 'moderate' | 'high';
  interpretation?: string;
  recommendation?: string;
  color?: string;
}

export interface ScreeningAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
}

export interface ScreeningResult {
  id: string;
  tenantId?: string;
  instrumentId: string;
  instrumentCode: string;
  instrumentTitle: string;
  patientId: string;
  patientName: string;
  encounterId?: string | null;
  status: ScreeningResultStatus;
  answers: QuestionAnswer[];
  score?: ScoreResult | null;
  alerts: ScreeningAlert[];
  administeredBy: 'patient_self' | 'staff_administered';
  administeredByUserId?: string | null;
  administeredByName?: string | null;
  administrationContext?: string | null;
  startedAt: string;
  completedAt?: string | null;
  durationSeconds?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningDashboard {
  totalScreenings: number;
  completedScreenings: number;
  inProgressScreenings: number;
  byInstrument: Array<{ code: string; title: string; count: number; positiveRate: number }>;
  criticalAlerts: number;
  recentResults: ScreeningResult[];
}

