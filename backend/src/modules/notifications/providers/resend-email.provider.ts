import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailProvider,
  SendEmailRequest,
  SendEmailResponse,
} from './email-provider.interface';

/**
 * Resend email provider (https://resend.com).
 *
 * Uses the Resend REST API directly via `fetch` (no SDK dependency).
 * Activate by setting RESEND_API_KEY in .env.
 *
 * Resend is chosen because:
 * - Simple REST API (single endpoint)
 * -Generous free tier (3,000 emails/month)
 * - HIPAA-compliant with BAA available
 * - Better developer experience than SendGrid for small teams
 *
 * Setup:
 * 1. Create a Resend account at https://resend.com
 * 2. Set RESEND_API_KEY in .env (re_xxx...)
 * 3. Set MAIL_FROM_EMAIL (e.g., notifications@neuraline.health)
 * 4. Verify your sending domain in Resend dashboard
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly baseUrl = 'https://api.resend.com';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.fromEmail = this.configService.get<string>(
      'MAIL_FROM_EMAIL',
      'notifications@neuraline.health',
    );
    this.fromName = this.configService.get<string>('MAIL_FROM_NAME', 'Neuraline Health');
  }

  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    const from = `${request.fromName ?? this.fromName} <${this.fromEmail}>`;

    const body = {
      from,
      to: [request.to],
      subject: request.subject,
      html: request.htmlBody,
      text: request.textBody,
    };

    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as Record<string, any>;

      if (!response.ok) {
        this.logger.error(`Resend send failed: ${JSON.stringify(json)}`);
        return {
          messageId: '',
          status: 'failed',
          error: json.message ?? json.error?.message ?? response.statusText,
        };
      }

      return { messageId: json.id, status: 'sent' };
    } catch (err) {
      this.logger.error(`Resend send error: ${(err as Error).message}`);
      return {
        messageId: '',
        status: 'failed',
        error: (err as Error).message,
      };
    }
  }
}
