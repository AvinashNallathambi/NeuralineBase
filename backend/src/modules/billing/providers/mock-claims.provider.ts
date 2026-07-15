import { Injectable, Logger } from '@nestjs/common';
import {
  ClaimsProvider,
  ClaimSubmissionRequest,
  ClaimSubmissionResponse,
  ClaimStatusResponse,
  ClaimSubmissionStatus,
} from './claims-provider.interface';

/**
 * Mock claims provider for development without a clearinghouse.
 *
 * Simulates an accepted submission with a deterministic tracking ID and
 * reports `in_process` on subsequent status polls. No network calls.
 */
@Injectable()
export class MockClaimsProvider implements ClaimsProvider {
  readonly name = 'MockClaimsProvider';
  private readonly logger = new Logger(MockClaimsProvider.name);

  async submit(request: ClaimSubmissionRequest): Promise<ClaimSubmissionResponse> {
    this.logger.log(
      `Mock submit for claim ${request.claimNumber} (${request.lineItems.length} lines, $${request.totalBilled})`,
    );

    const trackingId = `MOCK-${request.claimNumber}-${Date.now().toString(36).toUpperCase()}`;

    // Simulate async clearinghouse ack
    await new Promise((resolve) => setTimeout(resolve, 150));

    return {
      accepted: true,
      clearinghouseTrackingId: trackingId,
      payerClaimId: request.claimNumber,
      status: 'accepted',
      rawResponse: {
        mock: true,
        claimNumber: request.claimNumber,
        totalBilled: request.totalBilled,
        lineItemCount: request.lineItems.length,
      },
    };
  }

  async getStatus(clearinghouseTrackingId: string): Promise<ClaimStatusResponse> {
    this.logger.log(`Mock status poll for ${clearinghouseTrackingId}`);
    const status: ClaimSubmissionStatus = 'in_process';
    return {
      clearinghouseTrackingId,
      status,
      payerClaimId: clearinghouseTrackingId.split('-')[1] ?? null,
      rawResponse: { mock: true, status },
    };
  }
}
