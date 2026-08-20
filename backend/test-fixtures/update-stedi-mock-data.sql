-- Update test data to match current Stedi mock request requirements
-- Stedi changed their mock payer IDs and subscriber data.

-- Update Aetna payer ID from ABDCE to 60054
UPDATE insurance_payers SET payer_id = '60054' WHERE payer_id = 'ABDCE';

-- Update patient insurance to use Stedi's mock member ID for Aetna
UPDATE patient_insurances SET policy_number = 'AETNA9wcSu', subscriber_name = 'John Doe' WHERE policy_number = '1234567890';

-- Add UHC test payer
INSERT INTO insurance_payers (tenant_id, payer_id, name, payer_type, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', '87726', 'UnitedHealthcare (Stedi Test)', 'commercial', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM insurance_payers WHERE payer_id = '87726');

-- Add UHC patient insurance for Test Patient
INSERT INTO patient_insurances (tenant_id, patient_id, insurance_payer_id, priority, policy_number, subscriber_name, "subscriberFrequency", status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000',
  '3a7688e5-d574-415c-b499-3336e85bcf80',
  ip.id, 'secondary', 'UHC202649', 'John Doe', 'self', 'active', NOW(), NOW()
FROM insurance_payers ip WHERE ip.payer_id = '87726'
  AND NOT EXISTS (SELECT 1 FROM patient_insurances WHERE policy_number = 'UHC202649');

-- Verify
SELECT pi.id, pi.policy_number, pi.subscriber_name, ip.payer_id, ip.name as payer_name,
       p.first_name || ' ' || p.last_name as patient_name
FROM patient_insurances pi
JOIN insurance_payers ip ON pi.insurance_payer_id = ip.id
JOIN patients p ON pi.patient_id = p.id;
