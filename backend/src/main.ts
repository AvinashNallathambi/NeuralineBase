import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { TenantInterceptor } from "./common/interceptors/tenant.interceptor";
import { DatabaseRetryInterceptor } from "./common/interceptors/db-retry.interceptor";
import { configureBodyParserWithRawBody } from "./common/middleware/webhook-body-parser.config";

// HIPAA: Rate limiting is now handled globally by @nestjs/throttler with
// Redis-backed storage (see AppModule). The previous in-memory rateLimiter
// was per-instance only and did not share counters across replicas.

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // ── Sentry initialization (optional — only activates if DSN is set) ──────
  const SENTRY_DSN = process.env.SENTRY_DSN;
  if (SENTRY_DSN) {
    try {
      const Sentry = await import("@sentry/node");
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0.1,
        // HIPAA: Strip PHI from request bodies before sending to Sentry
        beforeSend(event: any) {
          if (event.request?.data) delete event.request.data;
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.filter(
              (b: any) => b.category !== "http.body" && b.category !== "query.body",
            );
          }
          return event;
        },
      });
      logger.log("Sentry error tracking initialized");
    } catch {
      logger.warn("SENTRY_DSN set but @sentry/node not installed — skipping");
    }
  }

  // HIPAA: Reduce log verbosity in production to avoid PHI leakage
  const isProd = process.env.NODE_ENV === "production";

  // ── Safety guard: block synchronize=true in production ───────────────────
  // synchronize=true alters the schema on every startup without recording
  // migrations, causing schema drift and data loss. This guard prevents
  // accidental enablement in production environments.
  if (isProd && process.env.DB_SYNCHRONIZE === "true") {
    logger.error("FATAL: DB_SYNCHRONIZE=true is not allowed in production.");
    logger.error("Use migrations instead: npx typeorm migration:generate");
    logger.error("Refusing to start — set DB_SYNCHRONIZE=false and restart.");
    process.exit(1);
  }

  // Use Pino logger from LoggerModule (configured in app.module.ts).
  // Pino provides structured JSON logging with PHI redaction.
  const { Logger: PinoLogger } = await import("nestjs-pino");
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    // Pino handles logging — disable NestJS default logger
    logger: false,
  });
  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService);

  // ── HIPAA: Validate critical env variables in production ──────
  if (isProd) {
    const encryptionKey = configService.get<string>("ENCRYPTION_KEY", "");
    if (!encryptionKey || encryptionKey.length !== 64) {
      logger.error(
        "FATAL: ENCRYPTION_KEY must be a 64-char hex string in production",
      );
      process.exit(1);
    }
    const jwtSecret = configService.get<string>("JWT_SECRET", "");
    if (!jwtSecret || jwtSecret.length < 32) {
      logger.error(
        "FATAL: JWT_SECRET must be at least 32 characters in production",
      );
      process.exit(1);
    }
  }

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // CORS
  const corsOrigins = configService.get<string>("CORS_ORIGINS", "*");
  app.enableCors({
    origin: corsOrigins.split(","),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"],
  });

  // Custom body parser with raw body capture (required for Stripe webhooks)
  configureBodyParserWithRawBody(app);

  // Security
  app.use(helmet());
  app.use(compression());

  // HIPAA: Rate limiting is now handled by the global ThrottlerGuard
  // (registered in AppModule via APP_GUARD) with Redis-backed storage.

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors — order matters:
  //   1. AuditInterceptor   — logs request start
  //   2. TenantInterceptor  — sets req.tenantId from JWT
  //   3. DatabaseRetryInterceptor — retries on stale DB connections (after Postgres restart)
  app.useGlobalInterceptors(
    new AuditInterceptor(),
    new TenantInterceptor(),
    new DatabaseRetryInterceptor(),
  );

  // Swagger documentation – HIPAA: only in non-production environments
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(configService.get<string>("SWAGGER_TITLE", "Neuraline EMR API"))
      .setDescription(
        configService.get<string>(
          "SWAGGER_DESCRIPTION",
          "Neuraline Electronic Medical Records Platform API - HIPAA Compliant",
        ),
      )
      .setVersion(configService.get<string>("SWAGGER_VERSION", "1.0"))
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          name: "Authorization",
          description: "Enter JWT token",
          in: "header",
        },
        "JWT-auth",
      )
      .addTag("Authentication", "User authentication and authorization")
      .addTag("Patients", "Patient management")
      .addTag("Appointments", "Appointment scheduling")
      .addTag("Clinical", "Clinical encounters and records")
      .addTag("Prescriptions", "Prescription management")
      .addTag("Laboratory", "Lab orders and results")
      .addTag("Billing", "Billing and claims")
      .addTag("FHIR", "FHIR R4 interoperability endpoints")
      .addTag("AI", "AI-powered clinical features")
      .addTag("Notifications", "Notification management")
      .addTag("Telemedicine", "Telemedicine sessions")
      .addTag("Workflow Templates", "Dynamic workflow definition management")
      .addTag(
        "Workflow Instances",
        "Workflow instance tracking and transitions",
      )
      .addTag("Reports", "Reports and analytics")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    });
    logger.log("Swagger docs available at /api/docs (disabled in production)");
  }

  // Start server
  const port = configService.get<number>("PORT", 4000);
  await app.listen(port);

  logger.log(`Neuraline EMR Backend is running on: http://localhost:${port}`);
  logger.log(`API prefix: /api/v1`);
  logger.log(
    `Environment: ${configService.get<string>("NODE_ENV", "development")}`,
  );
}

bootstrap();
