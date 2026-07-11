-- ============================================
-- Stedi Test Data Seed Script
-- ============================================
-- Run this after starting your backend with DB_SYNCHRONIZE=true
-- to insert test insurance payers and patient insurance records
-- that match Stedi's mock eligibility check requests.
--
-- Prerequisites:
-- 1. Sign up at https://www.stedi.com/create-sandbox
-- 2. Create a test API key in the portal
-- 3. Set STEDI_API_KEY in backend/.env
-- 4. Set PROVIDER_NPI=1999999984 (valid dummy NPI for Stedi tests)
-- 5. Restart backend
-- 6. Run this SQL script against your database
-- 7. Use the UI to verify eligibility for the test patients
--
-- Usage:
--   psql -h localhost -U neuraline -d neuraline -f stedi-test-seed.sql
--   (or run via pgAdmin / DBeaver)
-- ============================================

-- Insert Stedi test payers (if they don't exist)
-- These payerId values match Stedi's mock request tradingPartnerServiceId values
INSERT INTO insurance_payers (tenant_id, payer_id, name, payer_type, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000001', 'ABDCE', 'Stedi Test Payer (Aetna)', 'commercial', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM insurance_payers WHERE payer_id = 'ABDCE');

INSERT INTO insurance_payers (tenant_id, payer_id, name, payer_type, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000001', 'CIGNA', 'Cigna (Stedi Test)', 'commercial', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM insurance_payers WHERE payer_id = 'CIGNA');

INSERT INTO insurance_payers (tenant_id, payer_id, name, payer_type, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000001', 'UHC', 'UnitedHealthcare (Stedi Test)', 'commercial', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM insurance_payers WHERE payer_id = 'UHC');

INSERT INTO insurance_payers (tenant_id, payer_id, name, payer_type, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000001', 'CMS', 'CMS Medicare (Stedi Test)', 'medicare', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM insurance_payers WHERE payer_id = 'CMS');

-- ============================================
-- NOTE: You need at least one patient in the patients table.
-- The script below uses the first patient found.
-- If you have no patients, create one first via the UI or API.
-- ============================================

-- Insert test patient insurance records matching Stedi mock data
-- Stedi Aetna mock: subscriber Jane Doe, DOB 1900-01-01, memberId 1234567890
INSERT INTO patient_insurances (tenant_id, patient_id, insurance_payer_id, priority, policy_number, group_number, subscriber_name, subscriber_relation, subscriber_dob, status, created_at, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  ip.id,
  'primary',
  '1234567890',
  NULL,
  'Jane Doe',
  'self',
  '1900-01-01',
  'active',
  NOW(), NOW()
FROM patients p
CROSS JOIN insurance_payers ip
WHERE ip.payer_id = 'ABDCE'
  AND p.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM patient_insurances pi
    WHERE pi.policy_number = '1234567890' AND pi.tenant_id = '00000000-0000-0000-0000-000000000001'
  )
LIMIT 1;

-- Stedi Cigna mock: subscriber Jane Doe, DOB 1900-01-01, memberId 1234567890
-- (Different payer, same subscriber data - Stedi has specific Cigna mock data)
INSERT INTO patient_insurances (tenant_id, patient_id, insurance_payer_id, priority, policy_number, group_number, subscriber_name, subscriber_relation, subscriber_dob, status, created_at, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  ip.id,
  'primary',
  'CIGNA123456',
  NULL,
  'Jane Doe',
  'self',
  '1900-01-01',
  'active',
  NOW(), NOW()
FROM patients p
CROSS JOIN insurance_payers ip
WHERE ip.payer_id = 'CIGNA'
  AND p.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM patient_insurances pi
    WHERE pi.policy_number = 'CIGNA123456' AND pi.tenant_id = '00000000-0000-0000-0000-000000000001'
  )
LIMIT 1;

-- ============================================
-- Verification: Check what was inserted
-- ============================================
SELECT 'Insurance Payers' as section, payer_id, name FROM insurance_payers WHERE payer_id IN ('ABDCE', 'CIGNA', 'UHC', 'CMS');
SELECT 'Patient Insurances' as section, policy_number, subscriber_name, subscriber_dob FROM patient_insurances WHERE policy_number IN ('1234567890', 'CIGNA123456');
