import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WorkOrdersController (e2e) — US-01 / RN-20', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let receptionistAuthorization: string;
  let workshopLeadAuthorization: string;
  let mechanicAuthorization: string;
  let vehicleId: string;

  const plate = `H${String(Date.now()).slice(-7)}`;
  const identification = `RN20-${Date.now()}`;
  const receptionistId = '00000000-0000-0000-0000-000000000010';
  const workshopLeadId = '00000000-0000-0000-0000-000000000030';
  const mechanicId = '00000000-0000-0000-0000-000000000021';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    receptionistAuthorization = `Bearer ${jwtService.sign({ sub: receptionistId, role: UserRole.RECEPTIONIST }, { secret: process.env.JWT_SECRET })}`;
    workshopLeadAuthorization = `Bearer ${jwtService.sign({ sub: workshopLeadId, role: UserRole.WORKSHOP_LEAD }, { secret: process.env.JWT_SECRET })}`;
    mechanicAuthorization = `Bearer ${jwtService.sign({ sub: mechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;

    const customer = await prisma.customer.create({ data: { identification, name: 'Cliente RN-20' } });
    const vehicle = await prisma.vehicle.create({
      data: { customerId: customer.id, plate, brand: 'Toyota', model: 'Corolla', year: 2020 },
    });
    vehicleId = vehicle.id;
    await prisma.technicalHistory.create({
      data: { vehicleId, description: 'Ingreso por recepción (RN-20)' },
    });
  });

  afterAll(async () => {
    await prisma.technicalHistory.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.customer.deleteMany({ where: { identification } });
    await app.close();
  });

  it('GET /api/v1/vehicles/:plate/history returns 401 without authentication', async () => {
    await request(app.getHttpServer()).get(`/api/v1/vehicles/${plate}/history`).expect(401);
  });

  it('returns the vehicle history for a RECEPTIONIST', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${plate}/history`)
      .set('Authorization', receptionistAuthorization)
      .expect(200);

    expect(response.body.plate).toBe(plate);
    expect(response.body.technicalHistory).toBeDefined();
  });

  it('returns the vehicle history for a WORKSHOP_LEAD (RN-20)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${plate}/history`)
      .set('Authorization', workshopLeadAuthorization)
      .expect(200);

    expect(response.body.plate).toBe(plate);
    expect(response.body.technicalHistory).toBeDefined();
  });

  it('rejects a MECHANIC requesting the vehicle history (403)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${plate}/history`)
      .set('Authorization', mechanicAuthorization)
      .expect(403);
  });

  it('returns 404 for an unknown plate without leaking data', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicles/ZZZ999/history')
      .set('Authorization', workshopLeadAuthorization)
      .expect(404);
  });
});