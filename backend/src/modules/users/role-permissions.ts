/**
 * Role-based Access Control (RBAC) definitions for Neuraline EMR.
 *
 * Each role has a set of module-level permissions. Permissions follow the
 * format: <module>:<action> e.g. "patients:read", "billing:write".
 *
 * Actions: read, write, delete, manage (full CRUD + admin)
 */

export type PermissionAction = 'read' | 'write' | 'delete' | 'manage';

export interface RoleDefinition {
  key: string;
  label: string;
  description: string;
  color: string;
  permissions: string[];
}

// ─── Module categories ──────────────────────────────────────────────
export const PERMISSION_MODULES = [
  { key: 'patients', label: 'Patients', icon: 'UserOutlined' },
  { key: 'appointments', label: 'Appointments', icon: 'CalendarOutlined' },
  { key: 'clinical', label: 'Clinical', icon: 'MedicineBoxOutlined' },
  { key: 'prescriptions', label: 'Prescriptions', icon: 'FileTextOutlined' },
  { key: 'laboratory', label: 'Laboratory', icon: 'ExperimentOutlined' },
  { key: 'billing', label: 'Billing & Claims', icon: 'DollarOutlined' },
  { key: 'remittance', label: 'Remittance & EOBs', icon: 'BankOutlined' },
  { key: 'denials', label: 'Denials & Appeals', icon: 'WarningOutlined' },
  { key: 'messaging', label: 'Secure Messaging', icon: 'MailOutlined' },
  { key: 'providers', label: 'Providers', icon: 'TeamOutlined' },
  { key: 'reports', label: 'Reports', icon: 'BarChartOutlined' },
  { key: 'settings', label: 'Settings & Admin', icon: 'SettingOutlined' },
  { key: 'audit', label: 'Audit Log', icon: 'AuditOutlined' },
  { key: 'ai', label: 'AI Tools', icon: 'RobotOutlined' },
] as const;

// ─── Role definitions with permission sets ──────────────────────────
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'admin',
    label: 'Administrator',
    description: 'Full system access including user management and configuration',
    color: 'red',
    permissions: [
      'patients:manage',
      'appointments:manage',
      'clinical:manage',
      'prescriptions:manage',
      'laboratory:manage',
      'billing:manage',
      'remittance:manage',
      'denials:manage',
      'messaging:manage',
      'providers:manage',
      'reports:manage',
      'settings:manage',
      'audit:manage',
      'ai:manage',
    ],
  },
  {
    key: 'doctor',
    label: 'Doctor / Provider',
    description: 'Clinical access to patients, encounters, orders, and prescriptions',
    color: 'blue',
    permissions: [
      'patients:manage',
      'appointments:manage',
      'clinical:manage',
      'prescriptions:manage',
      'laboratory:manage',
      'billing:read',
      'remittance:read',
      'messaging:manage',
      'providers:read',
      'reports:read',
      'ai:manage',
    ],
  },
  {
    key: 'nurse',
    label: 'Nurse',
    description: 'Clinical support access to patients, vitals, and orders',
    color: 'green',
    permissions: [
      'patients:read',
      'patients:write',
      'appointments:read',
      'appointments:write',
      'clinical:read',
      'clinical:write',
      'prescriptions:read',
      'laboratory:read',
      'laboratory:write',
      'messaging:read',
      'messaging:write',
      'providers:read',
      'ai:read',
    ],
  },
  {
    key: 'receptionist',
    label: 'Receptionist',
    description: 'Front desk access to scheduling and patient registration',
    color: 'purple',
    permissions: [
      'patients:read',
      'patients:write',
      'appointments:manage',
      'messaging:read',
      'messaging:write',
      'providers:read',
    ],
  },
  {
    key: 'billing_staff',
    label: 'Billing Staff',
    description: 'Revenue cycle management access to claims, billing, and denials',
    color: 'orange',
    permissions: [
      'patients:read',
      'billing:manage',
      'remittance:manage',
      'denials:manage',
      'reports:read',
      'messaging:read',
      'messaging:write',
    ],
  },
];

export function getRoleDefinition(role: string): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find((r) => r.key === role);
}

export function hasPermission(userRole: string, permission: string): boolean {
  const role = getRoleDefinition(userRole);
  if (!role) return false;
  return role.permissions.includes(permission);
}

export function getPermissionsForRole(role: string): string[] {
  return getRoleDefinition(role)?.permissions ?? [];
}
