import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('VehicleStatusController (e2e) — US-02', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/public/vehicle-status returns 400 when query params are missing', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/public/vehicle-status')
      .expect(400);

    expect(response.body.message).toBeDefined();
  });

  it('GET /api/v1/public/vehicle-status returns 404 for an unknown work order without leaking data', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/public/vehicle-status?plate=ZZZ999&identification=0000000')
      .expect(404);

    expect(response.body.message).toBe('No valid work order found for the provided data');
  });
});
