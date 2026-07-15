import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────

export interface StaffUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string | null;
  department: string | null;
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  key: string;
  label: string;
  description: string;
  color: string;
  permissions: string[];
}

export interface PermissionModule {
  key: string;
  label: string;
  icon: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  phone?: string;
  department?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  department?: string;
}

// ─── Service ────────────────────────────────────────────────────────

class UserService {
  private baseUrl = '/users';

  async getAll(): Promise<StaffUser[]> {
    const res = await api.get(this.baseUrl);
    return res.data;
  }

  async getById(id: string): Promise<StaffUser> {
    const res = await api.get(`${this.baseUrl}/${id}`);
    return res.data;
  }

  async create(data: CreateUserDto): Promise<StaffUser> {
    const res = await api.post(this.baseUrl, data);
    return res.data;
  }

  async update(id: string, data: UpdateUserDto): Promise<StaffUser> {
    const res = await api.patch(`${this.baseUrl}/${id}`, data);
    return res.data;
  }

  async changeRole(id: string, role: string): Promise<StaffUser> {
    const res = await api.patch(`${this.baseUrl}/${id}/role`, { role });
    return res.data;
  }

  async toggleActive(id: string): Promise<StaffUser> {
    const res = await api.patch(`${this.baseUrl}/${id}/toggle-active`);
    return res.data;
  }

  async remove(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async getRoleDefinitions(): Promise<RolePermission[]> {
    const res = await api.get(`${this.baseUrl}/roles/definitions`);
    return res.data;
  }

  async getPermissionModules(): Promise<PermissionModule[]> {
    const res = await api.get(`${this.baseUrl}/roles/modules`);
    return res.data;
  }
}

export const userService = new UserService();
export default userService;
