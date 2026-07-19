import { INestApplication, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { Request, Response } from 'express';

/**
 * Configures Express body parsing with raw body capture for Stripe webhooks.
 *
 * Stripe webhook signature verification requires the exact raw request bytes.
 * The standard JSON body parser transforms the body, so this function must be
 * called immediately after `NestFactory.create()` with `{ bodyParser: false }`.
 * It re-applies a JSON parser with a `verify` hook that stores the original
 * buffer in `req.rawBody` before JSON parsing.
 */
export function configureBodyParserWithRawBody(app: INestApplication): void {
  const logger = new Logger('BodyParserConfig');
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(
    json({
      limit: '1mb',
      verify: (req: Request, _res: Response, buf: Buffer) => {
        if (buf && buf.length > 0) {
          (req as any).rawBody = buf.toString('utf8');
        }
      },
    }),
  );
  expressApp.use(urlencoded({ extended: true, limit: '1mb' }));

  logger.log('JSON body parser configured with raw body capture');
}
