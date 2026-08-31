import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AssignedOrdersController (e2e) — HU-03', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mechanicAuthorization: string;
  let otherMechanicAuthorization: string;
  let receptionistAuthorization: string;
  let customerId: string;
  let vehicleId: string;
  let ownWorkOrderId: string;

  const mechanicId = '00000000-0000-0000-0000-000000000021';
  const otherMechanicId = '00000000-0000-0000-0000-000000000022';
  const receptionistId = '00000000-0000-0000-0000-000000000010';
  const plate = `W${String(Date.now()).slice(-7)}`;
  const identification = `HU03-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    mechanicAuthorization = `Bearer ${jwtService.sign({ sub: mechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;
    otherMechanicAuthorization = `Bearer ${jwtService.sign({ sub: otherMechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;
    receptionistAuthorization = `Bearer ${jwtService.sign({ sub: receptionistId, role: UserRole.RECEPTIONIST }, { secret: process.env.JWT_SECRET })}`;

    await prisma.mechanic.createMany({
      data: [
        { id: mechanicId, isActive: true },
        { id: otherMechanicId, isActive: true },
      ],
    });
    const customer = await prisma.customer.create({ data: { identification, name: 'Cliente HU-03' } });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: { customerId, plate, brand: 'Toyota', model: 'Corolla', year: 2020 },
    });
    vehicleId = vehicle.id;
    const ownWorkOrder = await prisma.workOrder.create({
      data: {
        vehicleId,
        customerId,
        receptionistId,
        initialComplaint: 'Falla asignada al mecánico propio',
        status: 'EN_REPARACION',
        mechanicId,
        assignedAt: new Date(),
      },
    });
    ownWorkOrderId = ownWorkOrder.id;
    await prisma.workOrder.create({
      data: {
        vehicleId,
        customerId,
        receptionistId,
        initialComplaint: 'Falla asignada al otro mecánico',
        status: 'ASIGNADA',
        mechanicId: otherMechanicId,
        assignedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.workOrder.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.mechanic.deleteMany({ where: { id: { in: [mechanicId, otherMechanicId] } } });
    await app.close();
  });

  it('GET /api/v1/work-orders/assigned returns 401 without authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/work-orders/assigned').expect(401);
  });

  it('GET /api/v1/work-orders/assigned returns 403 for a non-mechanic role', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/work-orders/assigned')
      .set('Authorization', receptionistAuthorization)
      .expect(403);
  });

  it('returns only the work orders explicitly assigned to the authenticated mechanic (RN-04)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/work-orders/assigned?page=1&pageSize=20')
      .set('Authorization', mechanicAuthorization)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page');
    expect(response.body).toHaveProperty('pageSize');
    expect(response.body.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(ownWorkOrderId);
    expect(JSON.stringify(response.body)).not.toMatch(/price|cost|amount|rate/i);

    const otherMechanicResponse = await request(app.getHttpServer())
      .get('/api/v1/work-orders/assigned?page=1&pageSize=20')
      .set('Authorization', otherMechanicAuthorization)
      .expect(200);
    expect(otherMechanicResponse.body.total).toBe(1);
    expect(otherMechanicResponse.body.data[0].id).not.toBe(ownWorkOrderId);
  });

  it('returns the technical detail of an assigned work order without any monetary value (RN-16)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/assigned/${ownWorkOrderId}`)
      .set('Authorization', mechanicAuthorization)
      .expect(200);

    expect(response.body.id).toBe(ownWorkOrderId);
    expect(response.body.vehicle.plate).toBe(plate);
    expect(response.body.vehicle.brand).toBe('Toyota');
    expect(response.body.vehicle.model).toBe('Corolla');
    expect(JSON.stringify(response.body)).not.toMatch(/price|cost|amount|rate/i);
  });

  it('returns 404 when the work order is assigned to another mechanic (RN-04)', async () => {
    const foreignOrder = await prisma.workOrder.findFirstOrThrow({ where: { mechanicId: otherMechanicId } });

    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/assigned/${foreignOrder.id}`)
      .set('Authorization', mechanicAuthorization)
      .expect(404);
  });

  it('GET /api/v1/work-orders/assigned/:id returns 400 for an invalid identifier', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/work-orders/assigned/not-a-uuid')
      .set('Authorization', mechanicAuthorization)
      .expect(400);
  });
});
