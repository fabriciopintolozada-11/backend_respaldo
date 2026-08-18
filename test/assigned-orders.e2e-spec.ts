import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AssignedOrdersController (e2e) — US-03', () => {
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

  it('GET /api/v1/work-orders/assigned returns 401 without authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/work-orders/assigned').expect(401);
  });

  it('GET /api/v1/work-orders/assigned returns 403 for a non-mechanic role', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/work-orders/assigned')
      .set('x-user-id', 'user-1')
      .set('x-user-role', 'RECEPTIONIST')
      .expect(403);
  });

  it('GET /api/v1/work-orders/assigned returns a paginated envelope for a mechanic', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/work-orders/assigned?page=1&pageSize=20')
      .set('x-user-id', 'mechanic-1')
      .set('x-user-role', 'MECHANIC')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page');
    expect(response.body).toHaveProperty('pageSize');
  });
});
