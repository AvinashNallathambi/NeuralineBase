import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'dev-jwt-secret-change-in-production-min-32-chars';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  'dev-jwt-refresh-secret-change-in-prod';

const DEV_USER = {
  id: 'dev-user-001',
  email: 'dr.sarah.chen@neuraline.health',
  // bcrypt hash of "Neuraline@2025" (12 rounds)
  password: '$2a$12$P0JlIH9yIH6m65GH40zDfezHwA1L8ld4vpIvrb8sCm2NWV9HTzWki',
  firstName: 'Sarah',
  lastName: 'Chen',
  role: 'doctor',
  tenantId: 'dev-tenant-001',
  mfaEnabled: false,
  isActive: true,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (email !== DEV_USER.email) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, DEV_USER.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const payload = {
    sub: DEV_USER.id,
    email: DEV_USER.email,
    tenantId: DEV_USER.tenantId,
    role: DEV_USER.role,
  };

  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  );

  const { password: _, ...sanitizedUser } = DEV_USER;

  return res.status(200).json({
    accessToken,
    refreshToken,
    user: sanitizedUser,
    mfaRequired: false,
  });
}
