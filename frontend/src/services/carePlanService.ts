import { api } from './api';

export type CarePlanStatus = 'active' | 'completed' | 'suspended' | 'cancelled';
export type CarePlanIntent = 'plan' | 'order' | 'proposal';
export type GoalStatus = 'active' | 'achieved' | 'not_achieved' | 'suspended' | 'cancelled';
export type GoalPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue' | 'no_response';
export type TaskType =
  | 'monitoring' | 'lab_order' | 'imaging_order' | 'medication_adherence'
  | 'patient_education' | 'questionnaire' | 'appointment' | 'care_team_action'
  | 'lifestyle' | 'follow_up' | 'referral' | 'custom';
export type TaskFrequency = 'one_time' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'as_needed';
export type TaskAssignedTo = 'patient' | 'care_team' | 'system';

export interface CareTeamMemberData {
  id: string;
  providerId?: string;
  name: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
}

export interface HealthConcernData {
  id: string;
  condition?: string;
  code?: string;
  codeSystem?: string;
  /** @deprecated Use `code` instead. */
  icd10Code?: string;
  description: string;
  severity?: 'low' | 'moderate' | 'high' | 'critical';
}

export interface CarePlan {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  title: string;
  description?: string | null;
  status: CarePlanStatus;
  intent: CarePlanIntent;
  category: string;
  addresses: HealthConcernData[];
  careTeam: CareTeamMemberData[];
  encounterId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isAiGenerated: boolean;
  isApproved: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  patientEducation: Array<{ title: string; content: string; url?: string }>;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanGoal {
  id: string;
  tenantId: string;
  carePlanId: string;
  patientId: string;
  description: string;
  targetValue?: string | null;
  targetUnit?: string | null;
  currentValue?: string | null;
  lastMeasuredAt?: string | null;
  metricName?: string | null;
  targetDirection?: 'decrease' | 'increase' | 'maintain' | null;
  status: GoalStatus;
  priority: GoalPriority;
  targetDate?: string | null;
  startDate?: string | null;
  achievedDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanTask {
  id: string;
  tenantId: string;
  carePlanId: string;
  patientId: string;
  title: string;
  description?: string | null;
  taskType: TaskType;
  status: TaskStatus;
  assignedTo: TaskAssignedTo;
  assignedProviderId?: string | null;
  assignedProviderName?: string | null;
  frequency: TaskFrequency;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  metricName?: string | null;
  targetValue?: string | null;
  targetUnit?: string | null;
  reportedValue?: string | null;
  reportedAt?: string | null;
  patientNotes?: string | null;
  priority: 'high' | 'medium' | 'low';
  isAiSuggested: boolean;
  goalId?: string | null;
  encounterId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FullCarePlan {
  plan: CarePlan;
  goals: CarePlanGoal[];
  tasks: CarePlanTask[];
}

export interface CreateCarePlanDto {
  patientId: string;
  patientName: string;
  title: string;
  description?: string;
  status?: CarePlanStatus;
  intent?: CarePlanIntent;
  category?: string;
  addresses?: HealthConcernData[];
  careTeam?: CareTeamMemberData[];
  encounterId?: string;
  providerId?: string;
  providerName?: string;
  startDate?: string;
  endDate?: string;
  isAiGenerated?: boolean;
  patientEducation?: Array<{ title: string; content: string; url?: string }>;
  notes?: string;
}

export interface CreateGoalDto {
  carePlanId: string;
  patientId: string;
  description: string;
  targetValue?: string;
  targetUnit?: string;
  currentValue?: string;
  metricName?: string;
  targetDirection?: 'decrease' | 'increase' | 'maintain';
  status?: GoalStatus;
  priority?: GoalPriority;
  targetDate?: string;
  startDate?: string;
  notes?: string;
}

export interface CreateTaskDto {
  carePlanId: string;
  patientId: string;
  title: string;
  description?: string;
  taskType?: TaskType;
  status?: TaskStatus;
  assignedTo?: TaskAssignedTo;
  assignedProviderId?: string;
  assignedProviderName?: string;
  frequency?: TaskFrequency;
  startDate?: string;
  dueDate?: string;
  metricName?: string;
  targetValue?: string;
  targetUnit?: string;
  priority?: 'high' | 'medium' | 'low';
  isAiSuggested?: boolean;
  goalId?: string;
  encounterId?: string;
  notes?: string;
}

class CarePlanService {
  private baseUrl = '/care-plans';

  async findByPatient(patientId: string): Promise<CarePlan[]> {
    const response = await api.get(`${this.baseUrl}/patient/${patientId}`);
    return response.data;
  }

  async findOne(id: string): Promise<FullCarePlan> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(dto: CreateCarePlanDto): Promise<CarePlan> {
    const response = await api.post(this.baseUrl, dto);
    return response.data;
  }

  async update(id: string, dto: Partial<CreateCarePlanDto>): Promise<CarePlan> {
    const response = await api.patch(`${this.baseUrl}/${id}`, dto);
    return response.data;
  }

  async approve(id: string): Promise<CarePlan> {
    const response = await api.patch(`${this.baseUrl}/${id}/approve`);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // Goals
  async findGoals(planId: string): Promise<CarePlanGoal[]> {
    const response = await api.get(`${this.baseUrl}/${planId}/goals`);
    return response.data;
  }

  async createGoal(dto: CreateGoalDto): Promise<CarePlanGoal> {
    const response = await api.post(`${this.baseUrl}/goals`, dto);
    return response.data;
  }

  async updateGoal(goalId: string, dto: Partial<CreateGoalDto>): Promise<CarePlanGoal> {
    const response = await api.patch(`${this.baseUrl}/goals/${goalId}`, dto);
    return response.data;
  }

  async updateGoalProgress(goalId: string, currentValue: string): Promise<CarePlanGoal> {
    const response = await api.patch(`${this.baseUrl}/goals/${goalId}/progress`, { currentValue });
    return response.data;
  }

  async deleteGoal(goalId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/goals/${goalId}`);
  }

  // Tasks
  async findTasks(planId: string): Promise<CarePlanTask[]> {
    const response = await api.get(`${this.baseUrl}/${planId}/tasks`);
    return response.data;
  }

  async findTasksByPatient(patientId: string, status?: string): Promise<CarePlanTask[]> {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`${this.baseUrl}/tasks/patient/${patientId}${params}`);
    return response.data;
  }

  async createTask(dto: CreateTaskDto): Promise<CarePlanTask> {
    const response = await api.post(`${this.baseUrl}/tasks`, dto);
    return response.data;
  }

  async updateTask(taskId: string, dto: Partial<CreateTaskDto>): Promise<CarePlanTask> {
    const response = await api.patch(`${this.baseUrl}/tasks/${taskId}`, dto);
    return response.data;
  }

  async completeTask(
    taskId: string,
    data: { completedBy?: string; reportedValue?: string; patientNotes?: string },
  ): Promise<CarePlanTask> {
    const response = await api.patch(`${this.baseUrl}/tasks/${taskId}/complete`, data);
    return response.data;
  }

  async reportTaskValue(taskId: string, reportedValue: string, patientNotes?: string): Promise<CarePlanTask> {
    const response = await api.patch(`${this.baseUrl}/tasks/${taskId}/report`, {
      reportedValue,
      patientNotes,
    });
    return response.data;
  }

  async deleteTask(taskId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/tasks/${taskId}`);
  }
}

export const carePlanService = new CarePlanService();
