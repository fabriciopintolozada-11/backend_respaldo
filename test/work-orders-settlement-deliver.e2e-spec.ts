import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '../src/generated/prisma/client';

jest.setTimeout(60000);

describe('WorkOrdersController (e2e) — US-20 settlement / deliver', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let receptionistAuthorization: string;
  let adminAuthorization: string;
  let mechanicAuthorization: string;

  let customerId: string;
  let vehicleId: string;
  let readyOrderId: string;
  let reservedOnlyOrderId: string;
  let notReadyOrderId: string;
  let noQuoteOrderId: string;
  let sparePartIds: string[] = [];

  const testIdentification = `E2E-DELIVER-${Date.now()}`;
  const testPlate = `D${String(Date.now()).slice(-7)}`;
  const receptionistId = '00000000-0000-4000-8000-000000000010';
  const adminId = '00000000-0000-4000-8000-000000000050';
  const mechanicId = '11111111-1111-4111-8111-111111111111';
  const now = Date.now();

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
    receptionistAuthorization = `Bearer ${jwtService.sign({ sub: receptionistId, role: UserRole.RECEPTIONIST }, { secret: process.env.JWT_SECRET })}`;
    adminAuthorization = `Bearer ${jwtService.sign({ sub: adminId, role: UserRole.ADMIN }, { secret: process.env.JWT_SECRET })}`;
    mechanicAuthorization = `Bearer ${jwtService.sign({ sub: mechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;

    const customer = await prisma.customer.create({ data: { identification: testIdentification, name: 'Cliente e2e deliver' } });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: { customerId, plate: testPlate, brand: 'Toyota', model: 'Corolla', year: 2021 },
    });
    vehicleId = vehicle.id;

    const installed1 = await prisma.sparePart.create({
      data: { code: `E2E-DLV-BP-${now}`, name: 'Brake pads', unitPrice: new Prisma.Decimal('200.00') },
    });
    const installed2 = await prisma.sparePart.create({
      data: { code: `E2E-DLV-OF-${now}`, name: 'Oil filter', unitPrice: new Prisma.Decimal('100.00') },
    });
    const reserved3 = await prisma.sparePart.create({
      data: { code: `E2E-DLV-SP-${now}`, name: 'Spark plugs', unitPrice: new Prisma.Decimal('80.00') },
    });
    sparePartIds = [installed1.id, installed2.id, reserved3.id];

    const base = { vehicleId, customerId, receptionistId, createdAt: new Date() };

    const createOrder = (initialComplaint: string, status: string) =>
      prisma.workOrder.create({ data: { ...base, initialComplaint, status } });

    const readyOrder = await createOrder('Deliver e2e listo para entrega', 'LISTO_ENTREGA');
    readyOrderId = readyOrder.id;
    const reservedOnlyOrder = await createOrder('Deliver e2e solo reservados', 'LISTO_ENTREGA');
    reservedOnlyOrderId = reservedOnlyOrder.id;
    const notReadyOrder = await createOrder('Deliver e2e en reparacion', 'EN_REPARACION');
    notReadyOrderId = notReadyOrder.id;
    const noQuoteOrder = await createOrder('Deliver e2e sin presupuesto', 'LISTO_ENTREGA');
    noQuoteOrderId = noQuoteOrder.id;

    const readyQuote = await prisma.quote.create({
      data: {
        workOrderId: readyOrderId,
        laborSubtotal: new Prisma.Decimal('650.00'),
        partsSubtotal: new Prisma.Decimal('300.00'),
        total: new Prisma.Decimal('950.00'),
        parts: {
          create: [
            { sparePartId: installed1.id, quantity: 1, unitPrice: new Prisma.Decimal('200.00'), subtotal: new Prisma.Decimal('200.00'), status: 'INSTALLED' },
            { sparePartId: installed2.id, quantity: 1, unitPrice: new Prisma.Decimal('100.00'), subtotal: new Prisma.Decimal('100.00'), status: 'INSTALLED' },
            { sparePartId: reserved3.id, quantity: 2, unitPrice: new Prisma.Decimal('80.00'), subtotal: new Prisma.Decimal('160.00'), status: 'RESERVED' },
          ],
        },
      },
    });

    await prisma.quote.create({
      data: {
        workOrderId: reservedOnlyOrderId,
        laborSubtotal: new Prisma.Decimal('200.00'),
        partsSubtotal: new Prisma.Decimal('160.00'),
        total: new Prisma.Decimal('360.00'),
        parts: {
          create: [
            { sparePartId: reserved3.id, quantity: 2, unitPrice: new Prisma.Decimal('80.00'), subtotal: new Prisma.Decimal('160.00'), status: 'RESERVED' },
          ],
        },
      },
    });

    expect(readyQuote.id).toBeDefined();
  });

  afterAll(async () => {
    const orderIds = [readyOrderId, reservedOnlyOrderId, notReadyOrderId, noQuoteOrderId];
    await prisma.quotePart.deleteMany({ where: { sparePartId: { in: sparePartIds } } });
    await prisma.quote.deleteMany({ where: { workOrderId: { in: orderIds } } });
    await prisma.workOrder.deleteMany({ where: { vehicleId } });
    if (vehicleId) await prisma.technicalHistory.deleteMany({ where: { vehicleId } });
    if (sparePartIds.length > 0) await prisma.sparePart.deleteMany({ where: { id: { in: sparePartIds } } });
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } });
    if (customerId) await prisma.customer.delete({ where: { id: customerId } });
    await app.close();
  });

  it('returns the consolidated settlement with only INSTALLED parts (US-20, RN-21)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${readyOrderId}/settlement`)
      .set('Authorization', receptionistAuthorization)
      .expect(200);

    expect(response.body).toMatchObject({
      workOrderId: readyOrderId,
      status: 'LISTO_ENTREGA',
      plate: testPlate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2021,
      customerName: 'Cliente e2e deliver',
      partsSubtotal: '300.00',
      currency: 'BOB',
    });
    expect(response.body.parts).toHaveLength(2);
    const partCodes: string[] = response.body.parts.map((part: { code: string }) => part.code);
    expect(partCodes).not.toContain(`E2E-DLV-SP-${now}`);
    expect(new Prisma.Decimal(response.body.laborSubtotal).equals(new Prisma.Decimal('650.00'))).toBe(true);
    expect(new Prisma.Decimal(response.body.total).equals(new Prisma.Decimal('950.00'))).toBe(true);
  });

  it('charges no parts when only RESERVED parts exist (RN-21)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${reservedOnlyOrderId}/settlement`)
      .set('Authorization', adminAuthorization)
      .expect(200);

    expect(response.body.parts).toEqual([]);
    expect(response.body.partsSubtotal).toBe('0.00');
    expect(new Prisma.Decimal(response.body.total).equals(new Prisma.Decimal('200.00'))).toBe(true);
  });

  it('returns zero totals for a work order without a quote', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${noQuoteOrderId}/settlement`)
      .set('Authorization', receptionistAuthorization)
      .expect(200);

    expect(response.body.parts).toEqual([]);
    expect(response.body.laborSubtotal).toBe('0.00');
    expect(response.body.total).toBe('0.00');
  });

  it('rejects settlement for a non LISTO_ENTREGA order with 409 (RN-05)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${notReadyOrderId}/settlement`)
      .set('Authorization', receptionistAuthorization)
      .expect(409);
  });

  it('rejects settlement for a mechanic with 403 (BE-12)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${readyOrderId}/settlement`)
      .set('Authorization', mechanicAuthorization)
      .expect(403);
  });

  it('returns 404 for an unknown work order on settlement', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/work-orders/00000000-0000-4000-8000-000000000999/settlement')
      .set('Authorization', receptionistAuthorization)
      .expect(404);
  });

  it('delivers the vehicle, computes the charged total and records history (US-20, RN-21, RN-19)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${readyOrderId}/deliver`)
      .set('Authorization', receptionistAuthorization)
      .send({ paymentMethod: 'CASH', receiptNumber: 'F2026-E2E-001', deliveryNotes: 'Entregado con llaves' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: readyOrderId,
      status: 'ENTREGADO',
      paymentMethod: 'CASH',
      receiptNumber: 'F2026-E2E-001',
      deliveryNotes: 'Entregado con llaves',
    });
    expect(typeof response.body.deliveredAt).toBe('string');
    expect(new Prisma.Decimal(response.body.totalCharged).equals(new Prisma.Decimal('950.00'))).toBe(true);

    const order = await prisma.workOrder.findUniqueOrThrow({ where: { id: readyOrderId } });
    expect(order.status).toBe('ENTREGADO');
    expect(order.paymentMethod).toBe('CASH');
    expect(order.receiptNumber).toBe('F2026-E2E-001');
    expect(order.deliveryNotes).toBe('Entregado con llaves');
    expect(order.deliveredAt).not.toBeNull();
    expect(Number(order.totalCharged)).toBe(950);

    const history = await prisma.technicalHistory.findFirst({
      where: { vehicleId, description: { contains: `receipt: F2026-E2E-001` } },
    });
    const adminHistory = await prisma.technicalHistory.findFirst({
      where: { vehicleId, description: { contains: `charged: BOB` } },
    });
    expect(history).toBeDefined();
    expect(adminHistory).toBeDefined();
  });

  it('allows ADMIN to deliver and returns 200', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${reservedOnlyOrderId}/deliver`)
      .set('Authorization', adminAuthorization)
      .send({ paymentMethod: 'QR_TRANSFER', receiptNumber: 'F2026-E2E-002' })
      .expect(200);

    expect(response.body.status).toBe('ENTREGADO');
    expect(new Prisma.Decimal(response.body.totalCharged).equals(new Prisma.Decimal('200.00'))).toBe(true);
  });

  it('delivers an order without a quote charging zero', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${noQuoteOrderId}/deliver`)
      .set('Authorization', receptionistAuthorization)
      .send({ paymentMethod: 'CARD', receiptNumber: 'F2026-E2E-003' })
      .expect(200);

    expect(response.body.status).toBe('ENTREGADO');
    expect(response.body.totalCharged).toBe('0.00');
  });

  it('rejects a second delivery with 409 (RN-21)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${readyOrderId}/deliver`)
      .set('Authorization', receptionistAuthorization)
      .send({ paymentMethod: 'CASH', receiptNumber: 'F2026-E2E-004' })
      .expect(409);
  });

  it('rejects settlement after delivery with 409', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${readyOrderId}/settlement`)
      .set('Authorization', receptionistAuthorization)
      .expect(409);
  });

  it('rejects delivery for a non LISTO_ENTREGA order with 409 (RN-05)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${notReadyOrderId}/deliver`)
      .set('Authorization', receptionistAuthorization)
      .send({ paymentMethod: 'CASH', receiptNumber: 'F2026-E2E-005' })
      .expect(409);
  });

  it('rejects an invalid payment method with 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${notReadyOrderId}/deliver`)
      .set('Authorization', receptionistAuthorization)
      .send({ paymentMethod: 'BITCOIN', receiptNumber: 'F2026-E2E-006' })
      .expect(400);
  });

  it('rejects delivery for a mechanic with 403 (BE-12)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${notReadyOrderId}/deliver`)
      .set('Authorization', mechanicAuthorization)
      .send({ paymentMethod: 'CASH', receiptNumber: 'F2026-E2E-007' })
      .expect(403);
  });

  it('returns 404 for an unknown work order on deliver', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/work-orders/00000000-0000-4000-8000-000000000999/deliver')
      .set('Authorization', receptionistAuthorization)
      .send({ paymentMethod: 'CASH', receiptNumber: 'F2026-E2E-008' })
      .expect(404);
  });
});