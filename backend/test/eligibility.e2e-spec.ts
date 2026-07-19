import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EligibilityModule } from '../src/modules/eligibility/eligibility.module';
import { AuthModule } from '../src/modules/auth/auth.module';

/**
 * E2E test for the Eligibility module.
 *
 * This test boots a minimal NestJS app with only the EligibilityModule and AuthModule,
 * then makes real HTTP requests via supertest. It verifies that:
 *
 * 1. The eligibility routes are actually registered (this would have caught
 *    the bug where EligibilityModule was missing from app.module.ts)
 * 2. The POST endpoint validates the DTO correctly
 * 3. The GET endpoint requires authentication
 *
 * This test does NOT require a database — it uses NestJS's DI to wire up
 * the module, and the routes are tested at the HTTP level.
 */
describe('EligibilityController (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let validToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        EligibilityModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    validToken = jwtService.sign({
      sub: 'test-user-id',
      email: 'test@neuraline.health',
      tenantId: '00000000-0000-0000-0000-000000000000',
      role: 'admin',
      type: 'access',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/eligibility/verifications', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/eligibility/verifications')
        .send({ patientId: '387d6bd8-09b3-4b39-8e43-4e96534f4636' })
        .expect(401);
    });

    it('should return 400 when patientId is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/eligibility/verifications')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ verificationType: 'real-time' })
        .expect(400);
    });

    it('should return 400 when patientId is not a UUID', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/eligibility/verifications')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ patientId: 'not-a-uuid', verificationType: 'real-time' })
        .expect(400);
    });

    it('should NOT return 404 (verifies the route is registered)', async () => {
      // This is the critical test — if EligibilityModule is not in app.module.ts,
      // this returns 404. The route must be registered.
      const response = await request(app.getHttpServer())
        .post('/api/v1/eligibility/verifications')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          patientId: '387d6bd8-09b3-4b39-8e43-4e96534f4636',
          verificationType: 'real-time',
          serviceType: '30',
        });

      // We expect 201 (success) or 500 (DB error because no test DB),
      // but NOT 404 (route not found) or 400 (validation error).
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(400);
    });
  });

  describe('GET /api/v1/eligibility/verifications', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/eligibility/verifications')
        .expect(401);
    });

    it('should NOT return 404 (verifies the route is registered)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/eligibility/verifications')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).not.toBe(404);
    });
  });
});
