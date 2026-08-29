import 'dotenv/config';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e) — US-00', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = randomUUID();
  const username = `recep-${Date.now()}`;
  const password = 'Fratelli2026!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({ where: { username } });

    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        id: userId,
        username,
        passwordHash,
        fullName: 'Recepcionista E2E',
        role: 'RECEPTIONIST',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('POST /api/v1/auth/login returns a token pair with the user role (US-00)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body.role).toBe('RECEPTIONIST');
    expect(response.body.username).toBe(username);
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('POST /api/v1/auth/login returns 401 for invalid credentials (US-00)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password: 'wrong-password' })
      .expect(401);
  });

  it('POST /api/v1/auth/refresh returns a new token pair (US-00)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    expect(refresh.body).toHaveProperty('accessToken');
    expect(refresh.body).toHaveProperty('refreshToken');
    expect(refresh.body.id).toBe(userId);
  });

  it('POST /api/v1/auth/refresh returns 401 for an invalid refresh token (US-00)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-valid-token' })
      .expect(401);
  });

  it('GET /api/v1/auth/profile returns 401 without authentication (US-00)', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/profile').expect(401);
  });

  it('GET /api/v1/auth/profile returns the authenticated user profile (US-00)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);

    const profile = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(profile.body.id).toBe(userId);
    expect(profile.body.username).toBe(username);
    expect(profile.body.role).toBe('RECEPTIONIST');
    expect(profile.body).not.toHaveProperty('passwordHash');
  });
});
