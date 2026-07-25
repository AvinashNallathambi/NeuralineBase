import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, timer } from 'rxjs';
import { concatMap, retryWhen } from 'rxjs/operators';

/**
 * Retries requests that fail due to stale/dead database connections.
 *
 * When Postgres restarts (e.g. docker compose restart postgres), existing
 * connections in the TypeORM pool become stale. The first query on a stale
 * connection throws a connection error. This interceptor catches those
 * errors and retries the request — the retry gets a fresh connection from
 * the pool (or TypeORM opens a new one), so it succeeds.
 *
 * This is the permanent fix for the "500 Internal Server Error on every
 * request after Postgres restarts" issue.
 */
@Injectable()
export class DatabaseRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DatabaseRetryInterceptor.name);
  private readonly maxRetries = 2;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      retryWhen((errors) =>
        errors.pipe(
          concatMap((error, attempt) => {
            if (attempt >= this.maxRetries || !this.isConnectionError(error)) {
              return throwError(() => error);
            }
            this.logger.warn(
              `Database connection error (attempt ${attempt + 1}/${this.maxRetries}), retrying in 500ms: ${error?.message || error}`,
            );
            return timer(500);
          }),
        ),
      ),
    );
  }

  /**
   * Detects errors caused by stale/dead database connections.
   * Covers both node-postgres error codes and TypeORM connection errors.
   */
  private isConnectionError(error: any): boolean {
    if (!error) return false;

    const code = error.code || '';
    const message = error.message || '';
    const name = error.name || '';

    // node-postgres connection error codes
    const pgConnectionCodes = [
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08003', // connection_does_not_exist
      '57P03', // cannot_connect_now
      '57P02', // crash_shutdown
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EPIPE',
    ];

    if (pgConnectionCodes.includes(code)) return true;

    // TypeORM / generic connection error messages
    const connectionMessages = [
      'Connection terminated',
      'Connection refused',
      'ConnectionNotFoundError',
      'Database connection lost',
      'DB connection not established',
      'socket hang up',
      'write ECONNRESET',
      'read ECONNRESET',
    ];

    if (connectionMessages.some((m) => message.includes(m))) return true;

    // TypeORM error names
    if (name === 'ConnectionNotFoundError' || name === 'CannotConnectAlreadyConnectedError') {
      return true;
    }

    return false;
  }
}
