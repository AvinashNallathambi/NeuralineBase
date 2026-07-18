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
  { key: 'trials', label: 'Trial Management', icon: 'RocketOutlined' },
] as const;

// ─── Role definitions with permission sets ──────────────────────────
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'super_admin',
    label: 'Super Administrator',
    description:
      'NeuralineBase staff. Full system access across all tenants including trial management and platform administration',
    color: 'magenta',
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
      'trials:manage',
    ],
  },
  {
    key: 'tenant_admin',
    label: 'Tenant Administrator',
    description:
      'Administrator scoped to a single tenant. Full access within their organization but cannot manage trials or platform-wide settings',
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
    key: 'admin',
    label: 'Administrator (legacy)',
    description:
      'Legacy administrator role. Prefer tenant_admin for new per-tenant admins and super_admin for NeuralineBase staff',
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

/**
 * Roles that a given role is allowed to act as (inheritance).
 * `super_admin` can do anything `tenant_admin` or `admin` can do.
 * `tenant_admin` can do anything `admin` can do.
 */
const ROLE_INHERITANCE: Record<string, string[]> = {
  super_admin: ['super_admin', 'tenant_admin', 'admin'],
  tenant_admin: ['tenant_admin', 'admin'],
  admin: ['admin'],
};

export function getEffectiveRoles(role: string): string[] {
  return ROLE_INHERITANCE[role] ?? [role];
}

export function hasPermission(userRole: string, permission: string): boolean {
  const role = getRoleDefinition(userRole);
  if (!role) return false;
  return role.permissions.includes(permission);
}

export function getPermissionsForRole(role: string): string[] {
  return getRoleDefinition(role)?.permissions ?? [];
}
