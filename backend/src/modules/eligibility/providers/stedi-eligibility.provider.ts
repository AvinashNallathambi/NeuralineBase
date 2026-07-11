import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EligibilityProvider,
  EligibilityRequest,
  EligibilityResponse,
} from './eligibility-provider.interface';

/**
 * Stedi Clearinghouse integration for real 270/271 eligibility checks.
 *
 * Setup:
 * 1. Sign up at https://www.stedi.com (free tier: 1000 transactions/month)
 * 2. Create an API key in the Stedi portal
 * 3. Set STEDI_API_KEY in your .env
 * 4. For test mode, use a test API key (returns mock payer responses)
 *
 * API Reference: https://www.stedi.com/docs/healthcare/api-reference/post-healthcare-eligibility
 */
@Injectable()
export class StediEligibilityProvider implements EligibilityProvider {
  readonly name = 'StediEligibilityProvider';
  private readonly logger = new Logger(StediEligibilityProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('STEDI_API_KEY', '');
    this.baseUrl = this.configService.get<string>(
      'STEDI_API_URL',
      'https://healthcare.us.stedi.com/2024-04-01',
    );

    if (!this.apiKey) {
      this.logger.warn('STEDI_API_KEY not configured. Stedi provider will fail on verify calls.');
    }
  }

  async verify(request: EligibilityRequest): Promise<EligibilityResponse> {
    const stediRequest = this.buildStediRequest(request);

    this.logger.log(`Sending eligibility check for patient ${request.patientId}`);

    try {
      const response = await fetch(
        `${this.baseUrl}/change/medicalnetwork/eligibility/v3`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(stediRequest),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Stedi API error ${response.status}: ${errorBody}`);
        return {
          eligible: false,
          coverageStatus: 'unknown',
          errorCode: `STEDI-HTTP-${response.status}`,
          errorMessage: `Stedi API returned ${response.status}: ${errorBody.substring(0, 200)}`,
          rawResponse: { httpStatus: response.status, body: errorBody },
        };
      }

      const stediResponse = await response.json();
      return this.parseStediResponse(stediResponse);
    } catch (error) {
      this.logger.error(`Stedi API call failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Build a Stedi-compatible JSON request from our internal request format.
   * Reference: https://www.stedi.com/docs/healthcare/api-reference/post-healthcare-eligibility
   */
  private buildStediRequest(request: EligibilityRequest): Record<string, unknown> {
    const subscriber: Record<string, unknown> = {};

    // Member ID (policy number)
    if (request.policyNumber) {
      subscriber.memberId = request.policyNumber;
    }

    // Subscriber name
    if (request.subscriberName) {
      const parts = request.subscriberName.split(' ');
      subscriber.firstName = parts[0] || '';
      subscriber.lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    }

    // Date of birth (Stedi expects YYYYMMDD format)
    if (request.subscriberDob) {
      subscriber.dateOfBirth = request.subscriberDob.replace(/-/g, '');
    }

    // Group number
    if (request.groupNumber) {
      subscriber.groupNumber = request.groupNumber;
    }

    // Build the information receiver (provider) - use placeholder if not configured
    const informationReceiver: Record<string, unknown> = {};

    const body: Record<string, unknown> = {
      subscriber,
      encounter: {
        serviceTypeCodes: [request.serviceType || '30'], // 30 = Health Benefit Plan Coverage
      },
    };

    // Add payer if known (tradingPartnerId is the Stedi payer ID like "ABDCE")
    if (request.tradingPartnerId) {
      body.tradingPartnerServiceId = request.tradingPartnerId;
    }

    // Add provider info placeholder
    const providerNpi = this.configService.get<string>('PROVIDER_NPI', '');
    const providerOrgName = this.configService.get<string>('PROVIDER_ORG_NAME', '');
    if (providerNpi) {
      body.provider = {
        npi: providerNpi,
        ...(providerOrgName ? { organizationName: providerOrgName } : {}),
      };
    }

    return body;
  }

  /**
   * Parse Stedi's JSON response into our internal EligibilityResponse format.
   * Stedi returns a rich response with planStatus, benefitsInformation[], planDateInformation, etc.
   */
  private parseStediResponse(response: Record<string, any>): EligibilityResponse {
    const planStatuses = response.planStatus || [];
    const benefitsInfo = response.benefitsInformation || [];
    const planDates = response.planDateInformation || [];

    // Determine coverage status from planStatus
    let eligible = false;
    let coverageStatus: 'active' | 'inactive' | 'terminated' | 'unknown' = 'unknown';

    for (const status of planStatuses) {
      const statusCode = status.statusCode || status.status;
      if (statusCode === '1' || statusCode === 'Active Coverage') {
        eligible = true;
        coverageStatus = 'active';
        break;
      } else if (statusCode === '6' || statusCode === 'Inactive') {
        coverageStatus = 'inactive';
      } else if (statusCode === '33' || statusCode === 'Terminated') {
        coverageStatus = 'terminated';
      }
    }

    // Extract plan name and type
    let planName: string | null = null;
    let planType: string | null = null;
    let network: string | null = null;

    for (const benefit of benefitsInfo) {
      if (benefit.planCoverageDescription) {
        planName = benefit.planCoverageDescription;
      }
      if (benefit.insuranceTypeCode) {
        planType = this.mapInsuranceType(benefit.insuranceTypeCode);
      }
      if (benefit.inPlanNetworkIndicatorCode === 'Y') {
        network = 'In-Network';
      } else if (benefit.inPlanNetworkIndicatorCode === 'N') {
        network = 'Out-of-Network';
      }
    }

    // Extract financial details from benefitsInformation
    let deductibleIndividual: number | null = null;
    let deductibleFamily: number | null = null;
    let deductibleRemaining: number | null = null;
    let outOfPocketIndividual: number | null = null;
    let outOfPocketFamily: number | null = null;
    let outOfPocketRemaining: number | null = null;
    let copayAmount: number | null = null;
    let coinsurancePercentage: number | null = null;
    let authorizationRequired = false;
    let referralRequired = false;

    const benefits: Record<string, unknown>[] = [];

    for (const b of benefitsInfo) {
      const code = b.code || b.benefitInformationCode;
      const amount = b.benefitAmount != null ? parseFloat(b.benefitAmount) : null;
      const pct = b.benefitPercent != null ? parseFloat(b.benefitPercent) * 100 : null;
      const coverageLevel = b.coverageLevelCode || '';
      const isInNetwork = b.inPlanNetworkIndicatorCode === 'Y';
      const serviceType = b.serviceTypeCodes?.[0] || '';

      // Deductible (code C)
      if (code === 'C' && isInNetwork) {
        if (coverageLevel === 'IND') {
          deductibleIndividual = amount;
        } else if (coverageLevel === 'FAM') {
          deductibleFamily = amount;
        }
      }

      // Deductible remaining (code C with time period qualifier remaining)
      if (code === 'C' && b.timePeriodQualifier === '29' && isInNetwork) {
        if (coverageLevel === 'IND') {
          deductibleRemaining = amount;
        }
      }

      // Out-of-pocket maximum (code G)
      if (code === 'G' && isInNetwork) {
        if (coverageLevel === 'IND') {
          outOfPocketIndividual = amount;
        } else if (coverageLevel === 'FAM') {
          outOfPocketFamily = amount;
        }
      }

      // OOP remaining (code G with remaining qualifier)
      if (code === 'G' && b.timePeriodQualifier === '29' && isInNetwork) {
        if (coverageLevel === 'IND') {
          outOfPocketRemaining = amount;
        }
      }

      // Copay (code B)
      if (code === 'B' && isInNetwork && amount != null) {
        copayAmount = amount;
      }

      // Coinsurance (code A)
      if (code === 'A' && isInNetwork && pct != null) {
        coinsurancePercentage = pct;
      }

      // Authorization required (code CB or specific indicator)
      if (code === 'CB' || b.authorizationOrCertificationIndicator === 'Y') {
        authorizationRequired = true;
      }

      // Referral required
      if (code === '3' || b.referralIndicator === 'Y') {
        referralRequired = true;
      }

      // Build structured benefits for display
      if (b.serviceTypes && b.serviceTypes.length > 0) {
        for (const st of b.serviceTypes) {
          const existing = benefits.find(
            (existing: any) => existing.category === st,
          );
          if (!existing) {
            benefits.push({
              category: st,
              copay: code === 'B' ? amount : null,
              coinsurance: code === 'A' ? pct : null,
              network: isInNetwork ? 'In-Network' : 'Out-of-Network',
              priorAuth: code === 'CB',
              visitLimit: null,
            });
          }
        }
      }
    }

    // Extract dates
    let effectiveDate: string | null = null;
    let expirationDate: string | null = null;

    for (const d of planDates) {
      if (d.dateQualifier === '346' || d.dateQualifierCode === '346') {
        effectiveDate = d.date || null;
      }
      if (d.dateQualifier === '347' || d.dateQualifierCode === '347') {
        expirationDate = d.date || null;
      }
    }

    // Subscriber info from response
    const subscriberInfo = response.subscriber || {};
    const subscriberName = subscriberInfo.firstName && subscriberInfo.lastName
      ? `${subscriberInfo.firstName} ${subscriberInfo.lastName}`
      : null;

    // Payer info
    const payerName = response.payer?.name || response.payerName || null;

    // Error handling
    const errors = response.errors || response.aaa || [];
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    if (errors.length > 0) {
      const firstError = errors[0];
      errorCode = firstError.rejectReasonCode || firstError.code || 'PAYER-ERROR';
      errorMessage = firstError.message || firstError.followUpActionCode || 'Payer returned an error';
      if (!eligible && coverageStatus === 'unknown') {
        coverageStatus = 'unknown';
      }
    }

    return {
      eligible,
      coverageStatus,
      effectiveDate,
      expirationDate,
      planName,
      planType,
      network,
      subscriberName,
      subscriberRelation: null, // Not reliably returned by payers
      payerName,
      deductibleIndividual,
      deductibleFamily,
      deductibleRemaining,
      outOfPocketIndividual,
      outOfPocketFamily,
      outOfPocketRemaining,
      copayAmount,
      coinsurancePercentage,
      authorizationRequired,
      referralRequired,
      benefitLimitations: null,
      benefits: benefits.length > 0 ? benefits : null,
      rawResponse: response,
      errorCode,
      errorMessage,
    };
  }

  private mapInsuranceType(code: string): string {
    const map: Record<string, string> = {
      '12': 'PPO',
      '13': 'POS',
      '14': 'EPO',
      '15': 'Indemnity',
      'HM': 'HMO',
      'HN': 'HMO (Medicare Risk)',
      'MC': 'Medicaid',
      'MA': 'Medicare Part A',
      'MB': 'Medicare Part B',
      'PR': 'PPO',
      'PS': 'POS',
      'QM': 'QMCSO',
    };
    return map[code] || code;
  }
}
