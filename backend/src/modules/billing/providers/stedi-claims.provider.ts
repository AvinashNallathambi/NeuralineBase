import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClaimsProvider,
  ClaimSubmissionRequest,
  ClaimSubmissionResponse,
  ClaimStatusResponse,
  ClaimSubmissionStatus,
  ClaimLineItemSubmission,
} from './claims-provider.interface';

/**
 * Stedi Clearinghouse integration for X12 837 claim submission.
 *
 * Stedi exposes a JSON claims API that accepts a structured claim and
 * translates it to an X12 837 transaction on the provider's behalf.
 *
 * Setup:
 * 1. Use the same STEDI_API_KEY as eligibility (free tier: 1000 tx/month).
 * 2. Set STEDI_CLAIMS_API_URL if you need to override the default endpoint.
 * 3. Ensure each InsurancePayer has metadata.tradingPartnerId set so the
 *    claim is routed to the correct payer.
 *
 * API Reference: https://www.stedi.com/docs/healthcare/claims
 */
@Injectable()
export class StediClaimsProvider implements ClaimsProvider {
  readonly name = 'StediClaimsProvider';
  private readonly logger = new Logger(StediClaimsProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('STEDI_API_KEY', '');
    // Stedi's claims endpoint lives under the same healthcare base as eligibility.
    this.baseUrl = this.configService.get<string>(
      'STEDI_API_URL',
      'https://healthcare.us.stedi.com/2024-04-01',
    );

    if (!this.apiKey) {
      this.logger.warn('STEDI_API_KEY not configured. Stedi claims provider will fail on submit.');
    }
  }

  async submit(request: ClaimSubmissionRequest): Promise<ClaimSubmissionResponse> {
    const payload = this.buildStediClaim(request);

    this.logger.log(
      `Submitting claim ${request.claimNumber} to Stedi (payer: ${request.tradingPartnerId ?? 'unknown'})`,
    );

    try {
      const response = await fetch(`${this.baseUrl}/change/medicalnetwork/claims/v2`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.text();

      if (!response.ok) {
        this.logger.error(`Stedi claims API error ${response.status}: ${body}`);
        return {
          accepted: false,
          clearinghouseTrackingId: '',
          status: 'rejected',
          errorCode: `STEDI-HTTP-${response.status}`,
          errorMessage: `Stedi API returned ${response.status}: ${body.substring(0, 300)}`,
          rawResponse: { httpStatus: response.status, body },
        };
      }

      const json = JSON.parse(body) as Record<string, any>;
      return this.parseSubmissionResponse(json, request.claimNumber);
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Stedi claims submit failed: ${message}`);
      return {
        accepted: false,
        clearinghouseTrackingId: '',
        status: 'rejected',
        errorCode: 'STEDI-NETWORK',
        errorMessage: message,
      };
    }
  }

  async getStatus(clearinghouseTrackingId: string): Promise<ClaimStatusResponse> {
    this.logger.log(`Polling Stedi claim status for ${clearinghouseTrackingId}`);

    try {
      const response = await fetch(
        `${this.baseUrl}/change/medicalnetwork/claims/v2/${encodeURIComponent(clearinghouseTrackingId)}/status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const body = await response.text();

      if (!response.ok) {
        this.logger.error(`Stedi status API error ${response.status}: ${body}`);
        return {
          clearinghouseTrackingId,
          status: 'unknown',
          errorCode: `STEDI-HTTP-${response.status}`,
          errorMessage: `Stedi API returned ${response.status}: ${body.substring(0, 300)}`,
          rawResponse: { httpStatus: response.status, body },
        };
      }

      const json = JSON.parse(body) as Record<string, any>;
      return this.parseStatusResponse(json, clearinghouseTrackingId);
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Stedi status poll failed: ${message}`);
      return {
        clearinghouseTrackingId,
        status: 'unknown',
        errorCode: 'STEDI-NETWORK',
        errorMessage: message,
      };
    }
  }

  /**
   * Build a Stedi-compatible JSON claim payload from our internal request.
   * Stedi's claims API mirrors the X12 837 structure in JSON form.
   * Reference: https://www.stedi.com/docs/healthcare/claims
   */
  private buildStediClaim(request: ClaimSubmissionRequest): Record<string, unknown> {
    const providerNpi = request.providerNpi || this.configService.get<string>('PROVIDER_NPI', '');
    const providerOrgName =
      this.configService.get<string>('PROVIDER_ORG_NAME', '') || request.providerName;

    // Subscriber / insured
    const subscriber: Record<string, unknown> = {
      memberId: request.policyNumber,
      ...(request.groupNumber ? { groupNumber: request.groupNumber } : {}),
      ...(request.subscriberName ? this.splitName(request.subscriberName) : {}),
      ...(request.subscriberDob ? { dateOfBirth: request.subscriberDob.replace(/-/g, '') } : {}),
    };

    // Patient (often same as subscriber for "self" relationship)
    const patient: Record<string, unknown> = {
      ...this.splitName(request.patientName),
      ...(request.patientDob ? { dateOfBirth: request.patientDob.replace(/-/g, '') } : {}),
    };

    // Trading partner (payer) — required for Stedi to route the claim.
    const tradingPartnerServiceId = request.tradingPartnerId;

    // Service lines (2300/2400 loops)
    const serviceLines = request.lineItems.map((line) => this.buildServiceLine(line));

    const claim: Record<string, unknown> = {
      claimNumber: request.claimNumber,
      totalClaimChargeAmount: request.totalBilled.toFixed(2),
      serviceLines,
    };

    const payload: Record<string, unknown> = {
      tradingPartnerServiceId,
      submitter: {
        organizationName: providerOrgName,
        ...(providerNpi ? { npi: providerNpi } : {}),
      },
      subscriber,
      payer: {
        organizationName: request.insurancePayerName ?? undefined,
      },
      claim,
      provider: {
        npi: providerNpi,
        organizationName: providerOrgName,
      },
      patient,
      // 2000B / 2310B rendering provider is captured above; placeOfServiceCode
      // defaults to office (11) — callers can override via line-level metadata.
      placeOfServiceCode: '11',
    };

    // Drop undefined values to keep the payload clean.
    return JSON.parse(JSON.stringify(payload));
  }

  private buildServiceLine(line: ClaimLineItemSubmission): Record<string, unknown> {
    const serviceLine: Record<string, unknown> = {
      serviceIdQualifier: line.codeType === 'CPT' ? 'HC' : 'HC',
      serviceId: line.code,
      serviceDescription: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toFixed(2),
      totalChargeAmount: line.totalCharge.toFixed(2),
    };

    if (line.modifiers && line.modifiers.length > 0) {
      serviceLine.modifiers = line.modifiers.slice(0, 4);
    }

    if (line.serviceDate) {
      const d = line.serviceDate instanceof Date ? line.serviceDate : new Date(line.serviceDate);
      serviceLine.serviceDate = d.toISOString().slice(0, 10).replace(/-/g, '');
    }

    return serviceLine;
  }

  private splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    return {
      firstName: parts[0] || '',
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
    };
  }

  private parseSubmissionResponse(
    json: Record<string, any>,
    claimNumber: string,
  ): ClaimSubmissionResponse {
    // Stedi returns a transaction id / control number on acceptance.
    const trackingId =
      json.transactionId ||
      json.controlNumber ||
      json.trackingId ||
      json.id ||
      `STEDI-${claimNumber}-${Date.now().toString(36).toUpperCase()}`;

    const errors = json.errors || json.aaa || [];
    const accepted = errors.length === 0 && !json.rejected;

    let status: ClaimSubmissionStatus = 'accepted';
    if (!accepted) {
      status = 'rejected';
    } else if (json.status === 'in_process' || json.status === 'processing') {
      status = 'in_process';
    }

    return {
      accepted,
      clearinghouseTrackingId: trackingId,
      payerClaimId: json.payerClaimId ?? claimNumber,
      status,
      errorCode: errors[0]?.code ?? null,
      errorMessage: errors[0]?.message ?? null,
      rawResponse: json,
    };
  }

  private parseStatusResponse(
    json: Record<string, any>,
    trackingId: string,
  ): ClaimStatusResponse {
    const rawStatus = (json.status || json.claimStatus || '').toString().toLowerCase();
    let status: ClaimSubmissionStatus = 'unknown';

    if (['accepted', 'received', 'in_process', 'processing', 'pending'].includes(rawStatus)) {
      status = 'in_process';
    } else if (['paid', 'processed', 'adjudicated'].includes(rawStatus)) {
      status = 'paid';
    } else if (['denied', 'rejected'].includes(rawStatus)) {
      status = 'denied';
    }

    return {
      clearinghouseTrackingId: json.transactionId || trackingId,
      status,
      payerClaimId: json.payerClaimId ?? null,
      errorCode: json.errors?.[0]?.code ?? null,
      errorMessage: json.errors?.[0]?.message ?? null,
      rawResponse: json,
    };
  }
}
