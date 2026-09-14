import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WorkOrdersController (e2e) — US-19 complete / release bay', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mechanicAuthorization: string;
  let otherMechanicAuthorization: string;
  let leadAuthorization: string;
  let receptionistAuthorization: string;

  let repairOrderId: string;
  let foreignOrderId: string;
  let waitingOrderId: string;
  let notRepairOrderId: string;
  let customerId: string;
  let vehicleId: string;

  const testIdentification = `E2E-COMPLETE-${Date.now()}`;
  const testPlate = `C${String(Date.now()).slice(-7)}`;
  const mechanicId = '11111111-1111-4111-8111-111111111111';
  const otherMechanicId = '22222222-2222-4222-8222-222222222222';
  const leadId = '00000000-0000-4000-8000-000000000040';
  const receptionistId = '00000000-0000-4000-8000-000000000010';

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
    mechanicAuthorization = `Bearer ${jwtService.sign({ sub: mechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;
    otherMechanicAuthorization = `Bearer ${jwtService.sign({ sub: otherMechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;
    leadAuthorization = `Bearer ${jwtService.sign({ sub: leadId, role: UserRole.WORKSHOP_LEAD }, { secret: process.env.JWT_SECRET })}`;
    receptionistAuthorization = `Bearer ${jwtService.sign({ sub: receptionistId, role: UserRole.RECEPTIONIST }, { secret: process.env.JWT_SECRET })}`;

    await prisma.mechanic.createMany({
      data: [
        { id: mechanicId, isActive: true },
        { id: otherMechanicId, isActive: true },
      ],
      skipDuplicates: true,
    });

    // The dataset has exactly 4 bays: 1 and 2 hold seeded demo orders and the
    // US-18 e2e owns bays 3 and 4. To keep this spec race-free in parallel
    // runs, no bay is bound here; the bay-release branch (RN-14) is covered
    // by the repository unit tests.
    const customer = await prisma.customer.create({ data: { identification: testIdentification, name: 'Cliente e2e complete' } });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: { customerId, plate: testPlate, brand: 'Toyota', model: 'Corolla', year: 2021 },
    });
    vehicleId = vehicle.id;

    const base = { vehicleId, customerId, receptionistId, createdAt: new Date() };
    const repairOrder = await prisma.workOrder.create({
      data: { ...base, initialComplaint: 'Complete e2e reparación', status: 'EN_REPARACION', mechanicId, assignedAt: new Date() },
    });
    const foreignOrder = await prisma.workOrder.create({
      data: { ...base, initialComplaint: 'Complete e2e ajena', status: 'EN_REPARACION', mechanicId, assignedAt: new Date() },
    });
    const waitingOrder = await prisma.workOrder.create({
      data: { ...base, initialComplaint: 'Complete e2e espera repuesto', status: 'EN_ESPERA_DE_REPUESTO', mechanicId },
    });
    const notRepairOrder = await prisma.workOrder.create({
      data: { ...base, initialComplaint: 'Complete e2e no en reparación', status: 'RECIBIDO', mechanicId },
    });
    repairOrderId = repairOrder.id;
    foreignOrderId = foreignOrder.id;
    waitingOrderId = waitingOrder.id;
    notRepairOrderId = notRepairOrder.id;
  });

  afterAll(async () => {
    // Nothing to restore: this spec never mutates bays or seeded data
    // (mechanic ids 1111.../2222... are seeded demo data and are NOT deleted).
    await prisma.notification.deleteMany({
      where: { workOrderId: { in: [repairOrderId, foreignOrderId, waitingOrderId, notRepairOrderId] } },
    });
    await prisma.workOrder.deleteMany({ where: { vehicleId } });
    if (vehicleId) await prisma.technicalHistory.deleteMany({ where: { vehicleId } });
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } });
    if (customerId) await prisma.customer.delete({ where: { id: customerId } });
    await app.close();
  });

  it('completes a repair, sets LISTO_ENTREGA and frees the bay (US-19, RN-05, RN-14)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${repairOrderId}/complete`)
      .set('Authorization', mechanicAuthorization)
      .send({ finalMileage: 125400, closingNotes: 'Radiador reemplazado y probado en ruta' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: repairOrderId,
      status: 'LISTO_ENTREGA',
      bayNumber: null,
      finalMileage: 125400,
      closingNotes: 'Radiador reemplazado y probado en ruta',
    });
    expect(typeof response.body.completedAt).toBe('string');

    const order = await prisma.workOrder.findUniqueOrThrow({ where: { id: repairOrderId } });
    expect(order.status).toBe('LISTO_ENTREGA');

    const history = await prisma.technicalHistory.findFirst({ where: { vehicleId } });
    expect(history?.description).toContain('final mileage: 125400 km');

    const notification = await prisma.notification.findFirst({
      where: { workOrderId: repairOrderId, type: 'WORK_ORDER_READY' },
    });
    expect(notification).toBeDefined();
    expect(notification?.recipientId).toBe(receptionistId);
  });

  it('rejects a mechanic who does not own the work order with 422 (RN-04, BE-E12)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${foreignOrderId}/complete`)
      .set('Authorization', otherMechanicAuthorization)
      .send({})
      .expect(422);
  });

  it('allows the workshop lead to conclude regardless of the assigned mechanic (RN-04)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${foreignOrderId}/complete`)
      .set('Authorization', leadAuthorization)
      .send({})
      .expect(200);

    expect(response.body.status).toBe('LISTO_ENTREGA');

    const order = await prisma.workOrder.findUniqueOrThrow({ where: { id: foreignOrderId } });
    expect(order.status).toBe('LISTO_ENTREGA');
  });

  it('rejects concluding an awaiting-spare-parts order with 422 (RN-05)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${waitingOrderId}/complete`)
      .set('Authorization', mechanicAuthorization)
      .send({})
      .expect(422);
  });

  it('rejects concluding a non EN_REPARACION order with 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${notRepairOrderId}/complete`)
      .set('Authorization', mechanicAuthorization)
      .send({})
      .expect(409);
  });

  it('rejects a RECEPTIONIST calling complete with 403', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${repairOrderId}/complete`)
      .set('Authorization', receptionistAuthorization)
      .send({})
      .expect(403);
  });

  it('returns 404 for an unknown work order and 400 for an invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/work-orders/00000000-0000-4000-8000-000000000999/complete')
      .set('Authorization', mechanicAuthorization)
      .send({})
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${repairOrderId}/complete`)
      .set('Authorization', mechanicAuthorization)
      .send({ finalMileage: -5 })
      .expect(400);
  });
});