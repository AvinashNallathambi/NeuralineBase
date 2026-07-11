import { Injectable } from '@nestjs/common';
import {
  EligibilityProvider,
  EligibilityRequest,
  EligibilityResponse,
} from './eligibility-provider.interface';

@Injectable()
export class MockEligibilityProvider implements EligibilityProvider {
  readonly name = 'MockEligibilityProvider';

  async verify(request: EligibilityRequest): Promise<EligibilityResponse> {
    const x12TransactionId = `270-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const planCatalog: Record<string, Partial<EligibilityResponse>> = {
      'BCBS-GA': {
        planName: 'Blue Cross Blue Shield PPO',
        planType: 'PPO',
        network: 'In-Network',
        payerName: 'Blue Cross Blue Shield of Georgia',
        deductibleIndividual: 1500,
        deductibleFamily: 3000,
        deductibleRemaining: 847.5,
        outOfPocketIndividual: 5000,
        outOfPocketFamily: 10000,
        outOfPocketRemaining: 4152.3,
        copayAmount: 25,
        coinsurancePercentage: 20,
        authorizationRequired: false,
        referralRequired: true,
        benefits: [
          { category: 'Office Visit', copay: 25, coinsurance: 20, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Specialist Visit', copay: 40, coinsurance: 20, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Emergency Room', copay: 150, coinsurance: 20, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Preventive Care', copay: 0, coinsurance: 0, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Mental Health', copay: 25, coinsurance: 20, network: 'In-Network', priorAuth: false, visitLimit: 30 },
          { category: 'Physical Therapy', copay: 35, coinsurance: 20, network: 'In-Network', priorAuth: true, visitLimit: 20 },
        ],
      },
      AETNA: {
        planName: 'Aetna Open Access',
        planType: 'HMO',
        network: 'In-Network',
        payerName: 'Aetna Better Health',
        deductibleIndividual: 1000,
        deductibleFamily: 2000,
        deductibleRemaining: 0,
        outOfPocketIndividual: 3500,
        outOfPocketFamily: 7000,
        outOfPocketRemaining: 0,
        copayAmount: 15,
        coinsurancePercentage: 10,
        authorizationRequired: true,
        referralRequired: false,
        benefits: [
          { category: 'Office Visit', copay: 15, coinsurance: 10, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Specialist Visit', copay: 30, coinsurance: 10, network: 'In-Network', priorAuth: true, visitLimit: null },
          { category: 'Emergency Room', copay: 100, coinsurance: 10, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Preventive Care', copay: 0, coinsurance: 0, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Mental Health', copay: 20, coinsurance: 10, network: 'In-Network', priorAuth: true, visitLimit: 12 },
        ],
      },
      MEDICARE: {
        planName: 'Medicare Part B',
        planType: 'Medicare',
        network: 'Participating',
        payerName: 'Centers for Medicare & Medicaid Services',
        deductibleIndividual: 240,
        deductibleFamily: null,
        deductibleRemaining: 0,
        outOfPocketIndividual: null,
        outOfPocketFamily: null,
        outOfPocketRemaining: null,
        copayAmount: 0,
        coinsurancePercentage: 20,
        authorizationRequired: false,
        referralRequired: false,
        benefits: [
          { category: 'Office Visit', copay: 0, coinsurance: 20, network: 'Participating', priorAuth: false, visitLimit: null },
          { category: 'Preventive Care', copay: 0, coinsurance: 0, network: 'Participating', priorAuth: false, visitLimit: null },
          { category: 'Durable Medical Equipment', copay: 0, coinsurance: 20, network: 'Participating', priorAuth: true, visitLimit: null },
        ],
      },
      UHC: {
        planName: 'UnitedHealthcare Choice Plus',
        planType: 'POS',
        network: 'In-Network',
        payerName: 'UnitedHealthcare',
        deductibleIndividual: 2000,
        deductibleFamily: 4000,
        deductibleRemaining: 1234.56,
        outOfPocketIndividual: 7000,
        outOfPocketFamily: 14000,
        outOfPocketRemaining: 6789.12,
        copayAmount: 30,
        coinsurancePercentage: 25,
        authorizationRequired: true,
        referralRequired: true,
        benefits: [
          { category: 'Office Visit', copay: 30, coinsurance: 25, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Specialist Visit', copay: 50, coinsurance: 25, network: 'In-Network', priorAuth: true, visitLimit: null },
          { category: 'Emergency Room', copay: 200, coinsurance: 25, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Preventive Care', copay: 0, coinsurance: 0, network: 'In-Network', priorAuth: false, visitLimit: null },
          { category: 'Mental Health', copay: 30, coinsurance: 25, network: 'In-Network', priorAuth: true, visitLimit: 30 },
          { category: 'Physical Therapy', copay: 40, coinsurance: 25, network: 'In-Network', priorAuth: true, visitLimit: 20 },
          { category: 'Imaging/Radiology', copay: 75, coinsurance: 25, network: 'In-Network', priorAuth: true, visitLimit: null },
        ],
      },
    };

    let active = true;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    const policy = request.policyNumber || '';
    const group = request.groupNumber || '';

    if (policy.startsWith('ERR') || group.startsWith('ERR')) {
      active = false;
      errorCode = '271-INVALID-MEMBER-ID';
      errorMessage = 'Member identifier could not be matched to a covered individual.';
    } else if (policy.endsWith('TERM')) {
      active = false;
      errorCode = '271-COVERAGE-TERMINATED';
      errorMessage = 'Coverage terminated as of the submitted date of service.';
    } else if (policy.startsWith('INACTIVE')) {
      active = false;
      errorCode = '271-COVERAGE-INACTIVE';
      errorMessage = 'Policy is currently inactive.';
    }

    const planKey = Object.keys(planCatalog).find(
      (k) => policy.includes(k) || group.includes(k) || (request.patientId || '').includes(k),
    ) || 'BCBS-GA';

    const plan = planCatalog[planKey];
    const effective = active ? '2025-01-01' : null;
    const expiration = active ? '2025-12-31' : null;

    return {
      eligible: active,
      coverageStatus: active ? 'active' : 'inactive',
      effectiveDate: effective,
      expirationDate: expiration,
      planName: plan.planName ?? 'Commercial Plan',
      planType: plan.planType ?? 'PPO',
      network: plan.network ?? 'In-Network',
      subscriberName: request.subscriberName || null,
      subscriberRelation: request.subscriberRelation || null,
      payerName: plan.payerName ?? 'Unknown Payer',
      deductibleIndividual: plan.deductibleIndividual ?? null,
      deductibleFamily: plan.deductibleFamily ?? null,
      deductibleRemaining: plan.deductibleRemaining ?? null,
      outOfPocketIndividual: plan.outOfPocketIndividual ?? null,
      outOfPocketFamily: plan.outOfPocketFamily ?? null,
      outOfPocketRemaining: plan.outOfPocketRemaining ?? null,
      copayAmount: plan.copayAmount ?? null,
      coinsurancePercentage: plan.coinsurancePercentage ?? null,
      authorizationRequired: plan.authorizationRequired ?? false,
      referralRequired: plan.referralRequired ?? false,
      benefitLimitations: {
        inNetworkOnly: planKey === 'UHC',
        maxVisitsPerYear: planKey === 'AETNA' ? 12 : null,
        serviceType: request.serviceType || '30',
      },
      benefits: plan.benefits ?? null,
      rawResponse: {
        transactionId: x12TransactionId,
        loop2110: {
          EB01: active ? '1' : '6',
          EB03: request.serviceType || '30',
          EB07: plan.coinsurancePercentage ?? 0,
        },
        generatedBy: this.name,
        timestamp: new Date().toISOString(),
      },
      errorCode,
      errorMessage,
    };
  }
}
