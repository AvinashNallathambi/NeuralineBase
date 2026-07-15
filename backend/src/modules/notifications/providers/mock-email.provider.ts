import { Injectable, Logger } from '@nestjs/common';
import {
  EmailProvider,
  SendEmailRequest,
  SendEmailResponse,
} from './email-provider.interface';

/**
 * Mock email provider for development.
 * Logs emails to the console instead of sending them.
 */
@Injectable()
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockEmailProvider.name);

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.logger.log(`\n━━━ EMAIL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`To: ${request.toName ? `${request.toName} <${request.to}>` : request.to}`);
    this.logger.log(`Subject: ${request.subject}`);
    this.logger.log(`Body: ${request.textBody ?? '(HTML email — see HTML body)'}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return { messageId: `mock_${Date.now()}`, status: 'sent' };
  }
}
