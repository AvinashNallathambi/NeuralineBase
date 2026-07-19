import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import getRawBody from 'raw-body';

/**
 * Captures the raw request body for Stripe webhooks.
 *
 * Stripe webhook signature verification requires the exact raw bytes that
 * Stripe sent. The global JSON body parser mutates the body, so this
 * middleware intercepts webhook routes, captures the raw body into
 * `req.rawBody`, and then also sets `req.body` to the parsed JSON for
 * compatibility with the rest of the pipeline.
 */
@Injectable()
export class WebhookRawBodyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WebhookRawBodyMiddleware.name);

  async use(req: Request, res: Response, next: NextFunction) {
    // Capture raw body bytes
    try {
      const raw = await getRawBody(req, {
        length: req.headers['content-length'],
        limit: '1mb',
      });

      (req as any).rawBody = raw.toString('utf8');

      // Parse JSON manually so downstream code can still use req.body
      if (req.headers['content-type']?.includes('application/json')) {
        try {
          (req as any).body = JSON.parse(raw.toString('utf8'));
        } catch (parseErr) {
          this.logger.warn('Webhook raw body is not valid JSON');
          (req as any).body = {};
        }
      }

      next();
    } catch (err) {
      this.logger.error(`Failed to read webhook raw body: ${(err as Error).message}`);
      res.status(400).json({ message: 'Invalid webhook body' });
    }
  }
}
