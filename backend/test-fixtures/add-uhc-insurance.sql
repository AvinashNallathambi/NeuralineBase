INSERT INTO patient_insurances (tenant_id, patient_id, insurance_payer_id, priority, policy_number, subscriber_name, "subscriberRelation", status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000',
  '3a7688e5-d574-415c-b499-3336e85bcf80',
  ip.id, 'secondary', 'UHC202649', 'John Doe', 'self', 'active', NOW(), NOW()
FROM insurance_payers ip WHERE ip.payer_id = '87726'
  AND NOT EXISTS (SELECT 1 FROM patient_insurances WHERE policy_number = 'UHC202649');

SELECT pi.id, pi.policy_number, pi.subscriber_name, ip.payer_id, ip.name as payer_name,
       p.first_name || ' ' || p.last_name as patient_name
FROM patient_insurances pi
JOIN insurance_payers ip ON pi.insurance_payer_id = ip.id
JOIN patients p ON pi.patient_id = p.id;
