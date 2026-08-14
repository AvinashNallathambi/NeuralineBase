import { request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const TEST_USER = {
  email: 'dr.sarah.chen@neuraline.health',
  password: 'Neuraline@2025',
};

export interface E2EState {
  token: string;
  user: { id: string; tenantId: string; [key: string]: unknown };
  providerId: string;
  patientId: string;
}

const STATE_FILE = path.join(process.cwd(), 'e2e', '.auth', 'state.json');

async function ensureAuthDir() {
  await fs.promises.mkdir(path.dirname(STATE_FILE), { recursive: true });
}

export function readAuthState(): E2EState {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

async function login(context: Awaited<ReturnType<typeof request.newContext>>): Promise<{ token: string; user: any }> {
  const response = await context.post('/api/v1/auth/login', {
    data: {
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login failed (${response.status()}): ${body}`);
  }

  const data = await response.json();
  return { token: data.accessToken as string, user: data.user };
}

async function findProvider(
  context: Awaited<ReturnType<typeof request.newContext>>,
  token: string,
): Promise<{ id: string }> {
  const response = await context.get('/api/v1/users', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Could not fetch providers (${response.status()}): ${body}`);
  }

  const users = await response.json();
  const provider =
    users.find((u: any) => u.role === 'doctor' || u.role === 'super_admin') ||
    users[0];

  if (!provider) {
    throw new Error('No provider/staff user found in the seeded dev tenant');
  }

  return { id: provider.id };
}

async function createPatient(
  context: Awaited<ReturnType<typeof request.newContext>>,
  token: string,
): Promise<{ id: string }> {
  const unique = Date.now();
  const response = await context.post('/api/v1/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      firstName: 'E2E',
      lastName: `Patient ${unique}`,
      dateOfBirth: '1990-01-01',
      gender: 'male',
      email: `e2e.patient.${unique}@example.com`,
      phone: '(555) 123-4567',
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Create patient failed (${response.status()}): ${body}`);
  }

  return response.json();
}

export default async function globalSetup() {
  const context = await request.newContext({ baseURL: 'http://localhost:4000', timeout: 120000 });

  try {
    const { token, user } = await login(context);
    const provider = await findProvider(context, token);
    const patient = await createPatient(context, token);

    const state: E2EState = {
      token,
      user,
      providerId: provider.id,
      patientId: patient.id,
    };

    await ensureAuthDir();
    await fs.promises.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } finally {
    await context.dispose();
  }
}
