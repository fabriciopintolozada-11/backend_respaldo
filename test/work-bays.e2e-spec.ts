import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WorkBaysController (e2e) — US-18', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let leadAuthorization: string;
  let mechanicAuthorization: string;
  let receptionistAuthorization: string;
  let bay3Id: string;
  let bay4Id: string;
  let activeOrderId: string;
  let secondOrderId: string;
  let pendingOrderId: string;
  let terminalOrderId: string;
  let customerId: string;
  let vehicleId: string;

  const testIdentification = `E2E-BAY-${Date.now()}`;
  const testPlate = `B${String(Date.now()).slice(-7)}`;
  const leadId = '00000000-0000-4000-8000-000000000040';
  const mechanicId = '11111111-1111-4111-8111-111111111111';
  const receptionistId = '00000000-0000-4000-8000-000000000010';
  const defaultReceptionistId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    leadAuthorization = `Bearer ${jwtService.sign({ sub: leadId, role: UserRole.WORKSHOP_LEAD }, { secret: process.env.JWT_SECRET })}`;
    mechanicAuthorization = `Bearer ${jwtService.sign({ sub: mechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;
    receptionistAuthorization = `Bearer ${jwtService.sign({ sub: receptionistId, role: UserRole.RECEPTIONIST }, { secret: process.env.JWT_SECRET })}`;

    const bays = await prisma.workBay.findMany({ orderBy: { bayNumber: 'asc' } });
    expect(bays).toHaveLength(4);
    bay3Id = bays[2].id;
    bay4Id = bays[3].id;

    const customer = await prisma.customer.create({ data: { identification: testIdentification, name: 'Cliente e2e bahías' } });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: { customerId, plate: testPlate, brand: 'Toyota', model: 'Corolla', year: 2021 },
    });
    vehicleId = vehicle.id;

    const activeOrder = await prisma.workOrder.create({
      data: { vehicleId, customerId, receptionistId: defaultReceptionistId, initialComplaint: 'Bahía e2e activa', status: 'APPROVED', createdAt: new Date() },
    });
    const secondOrder = await prisma.workOrder.create({
      data: { vehicleId, customerId, receptionistId: defaultReceptionistId, initialComplaint: 'Bahía e2e segunda', status: 'IN_REPAIR', createdAt: new Date() },
    });
    const pendingOrder = await prisma.workOrder.create({
      data: { vehicleId, customerId, receptionistId: defaultReceptionistId, initialComplaint: 'Bahía e2e espera repuesto', status: 'WAITING_FOR_PART', createdAt: new Date() },
    });
    const terminalOrder = await prisma.workOrder.create({
      data: { vehicleId, customerId, receptionistId: defaultReceptionistId, initialComplaint: 'Bahía e2e entregada', status: 'DELIVERED', createdAt: new Date() },
    });
    activeOrderId = activeOrder.id;
    secondOrderId = secondOrder.id;
    pendingOrderId = pendingOrder.id;
    terminalOrderId = terminalOrder.id;
  });

  afterAll(async () => {
    await prisma.workBay.updateMany({
      where: { bayNumber: { in: [3, 4] } },
      data: { isOccupied: false, currentWorkOrderId: null },
    });
    if (vehicleId) {
      await prisma.workOrder.deleteMany({ where: { vehicleId } });
    }
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } });
    if (customerId) await prisma.customer.delete({ where: { id: customerId } });
    await app.close();
  });

  it('denies monitoring to mechanics and receptionists (RN-14)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/work-bays/monitoring')
      .set('Authorization', mechanicAuthorization)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/work-bays/monitoring')
      .set('Authorization', receptionistAuthorization)
      .expect(403);
  });

  it('returns the 4 bays ordered with derived status and work order summary (US-18)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/work-bays/monitoring')
      .set('Authorization', leadAuthorization)
      .expect(200);

    expect(response.body).toHaveLength(4);
    expect(response.body.map((b: { bayNumber: number }) => b.bayNumber)).toEqual([1, 2, 3, 4]);
    expect(response.body[0].status).toBe('OCCUPIED');
    expect(response.body[0].currentWorkOrder).toBeDefined();
    expect(response.body[0].currentWorkOrder.status).toBe('APPROVED');
    expect(typeof response.body[0].currentWorkOrder.elapsedHours).toBe('number');
    expect(response.body[2]).toMatchObject({ bayNumber: 3, isOccupied: false, status: 'FREE', currentWorkOrderId: null });
    expect(response.body[3]).toMatchObject({ bayNumber: 4, isOccupied: false, status: 'FREE' });
  });

  it('assigns an active work order to a free bay (US-18)', async () => {
    const assigned = await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay3Id}/assign`)
      .set('Authorization', leadAuthorization)
      .send({ workOrderId: activeOrderId })
      .expect(200);

    expect(assigned.body).toMatchObject({ bayNumber: 3, isOccupied: true, currentWorkOrderId: activeOrderId });

    const monitoring = await request(app.getHttpServer())
      .get('/api/v1/work-bays/monitoring')
      .set('Authorization', leadAuthorization)
      .expect(200);
    expect(monitoring.body[2].status).toBe('OCCUPIED');
  });

  it('frees the previous bay when the work order is moved to another bay (US-18)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay4Id}/assign`)
      .set('Authorization', leadAuthorization)
      .send({ workOrderId: activeOrderId })
      .expect(200);

    const bay3 = await prisma.workBay.findUnique({ where: { id: bay3Id } });
    const bay4 = await prisma.workBay.findUnique({ where: { id: bay4Id } });
    expect(bay3?.currentWorkOrderId).toBeNull();
    expect(bay4).toMatchObject({ isOccupied: true, currentWorkOrderId: activeOrderId });
  });

  it('rejects assignment to an already occupied bay with 409 capacity complete', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay4Id}/assign`)
      .set('Authorization', leadAuthorization)
      .send({ workOrderId: secondOrderId })
      .expect(409);
  });

  it('derives WAITING_FOR_PART status and rejects closed work orders with 422', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay3Id}/assign`)
      .set('Authorization', leadAuthorization)
      .send({ workOrderId: pendingOrderId })
      .expect(200);

    const monitoring = await request(app.getHttpServer())
      .get('/api/v1/work-bays/monitoring')
      .set('Authorization', leadAuthorization)
      .expect(200);
    expect(monitoring.body[2].status).toBe('WAITING_FOR_PART');

    await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay4Id}/assign`)
      .set('Authorization', leadAuthorization)
      .send({ workOrderId: terminalOrderId })
      .expect(422);
  });

  it('returns 404 for an unknown bay and 400 for a malformed payload', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/work-bays/00000000-0000-4000-8000-000000000999/assign')
      .set('Authorization', leadAuthorization)
      .send({ workOrderId: activeOrderId })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay3Id}/assign`)
      .set('Authorization', leadAuthorization)
      .send({})
      .expect(400);
  });

  it('frees a bay and rejects occupying a bay without a work order via status (US-18)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay3Id}/status`)
      .set('Authorization', leadAuthorization)
      .send({ isOccupied: false })
      .expect(200);

    const bay3 = await prisma.workBay.findUnique({ where: { id: bay3Id } });
    expect(bay3).toMatchObject({ isOccupied: false, currentWorkOrderId: null });

    await request(app.getHttpServer())
      .patch(`/api/v1/work-bays/${bay3Id}/status`)
      .set('Authorization', leadAuthorization)
      .send({ isOccupied: true })
      .expect(422);
  });
});