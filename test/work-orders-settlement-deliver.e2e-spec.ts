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
  let workshopLeadAuthorization: string;

  let customerId: string;
  let vehicleId: string;
  let readyOrderId: string;
  let reservedOnlyOrderId: string;
  let notReadyOrderId: string;
  let noQuoteOrderId: string;
  let discountableOrderId: string;
  let sparePartIds: string[] = [];

  const testIdentification = `E2E-DELIVER-${Date.now()}`;
  const testPlate = `D${String(Date.now()).slice(-7)}`;
  const receptionistId = '00000000-0000-4000-8000-000000000010';
  const adminId = '00000000-0000-4000-8000-000000000050';
  const mechanicId = '11111111-1111-4111-8111-111111111111';
  const workshopLeadId = '22222222-2222-4222-8222-222222222222';
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
    workshopLeadAuthorization = `Bearer ${jwtService.sign({ sub: workshopLeadId, role: UserRole.WORKSHOP_LEAD }, { secret: process.env.JWT_SECRET })}`;

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
    // RN-07: the quotePart RESERVED lines must be backed by reservedStock (2
    // units for readyOrder + 2 for reservedOnlyOrder), otherwise the
    // release-on-deliver guard (releaseReservedParts) aborts delivery.
    const reserved3 = await prisma.sparePart.create({
      data: { code: `E2E-DLV-SP-${now}`, name: 'Spark plugs', unitPrice: new Prisma.Decimal('80.00'), physicalStock: 4, reservedStock: 4, availableStock: 0 },
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
    const discountableOrder = await createOrder('Deliver e2e con descuento', 'LISTO_ENTREGA');
    discountableOrderId = discountableOrder.id;

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

    await prisma.quote.create({
      data: {
        workOrderId: discountableOrderId,
        laborSubtotal: new Prisma.Decimal('650.00'),
        partsSubtotal: new Prisma.Decimal('300.00'),
        total: new Prisma.Decimal('950.00'),
        parts: {
          create: [
            { sparePartId: installed1.id, quantity: 1, unitPrice: new Prisma.Decimal('200.00'), subtotal: new Prisma.Decimal('200.00'), status: 'INSTALLED' },
            { sparePartId: installed2.id, quantity: 1, unitPrice: new Prisma.Decimal('100.00'), subtotal: new Prisma.Decimal('100.00'), status: 'INSTALLED' },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    const orderIds = [readyOrderId, reservedOnlyOrderId, notReadyOrderId, noQuoteOrderId, discountableOrderId];
    await prisma.settlementAdjustment.deleteMany({ where: { workOrderId: { in: orderIds } } });
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
      where: { vehicleId, description: { contains: `Charged: BOB` } },
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

  // --- RN-15: Settlement discount tests ---

  it('WORKSHOP_LEAD can apply a discount and settlement reflects it (RN-15)', async () => {
    const discountResponse = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/apply-discount`)
      .set('Authorization', workshopLeadAuthorization)
      .send({ amount: 50, reason: 'Descuento por demora en entrega del vehiculo' })
      .expect(200);

    expect(discountResponse.body.type).toBe('DISCOUNT');
    expect(discountResponse.body.amount).toBe('50.00');
    expect(discountResponse.body.appliedBy).toBe(workshopLeadId);

    const settlementResponse = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${discountableOrderId}/settlement`)
      .set('Authorization', workshopLeadAuthorization)
      .expect(200);

    expect(settlementResponse.body.discountsTotal).toBe('50.00');
    expect(settlementResponse.body.totalAfterDiscounts).toBe('900.00');
    expect(settlementResponse.body.adjustments).toHaveLength(1);
    expect(settlementResponse.body.adjustments[0].type).toBe('DISCOUNT');
  });

  it('RECEPTIONIST cannot apply a discount (403, RN-15)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/apply-discount`)
      .set('Authorization', receptionistAuthorization)
      .send({ amount: 10, reason: 'Descuento no autorizado por recepcionista' })
      .expect(403);
  });

  it('MECHANIC cannot apply a discount (403, RN-15)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/apply-discount`)
      .set('Authorization', mechanicAuthorization)
      .send({ amount: 10, reason: 'Descuento no autorizado por mecanico' })
      .expect(403);
  });

  it('rejects discount exceeding the total with 422 (RN-15)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/apply-discount`)
      .set('Authorization', workshopLeadAuthorization)
      .send({ amount: 1000, reason: 'Descuento que excede el total de la liquidacion' })
      .expect(422);
  });

  it('WORKSHOP_LEAD can void a discount and the settlement recalculates (RN-15)', async () => {
    const settlementBefore = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${discountableOrderId}/settlement`)
      .set('Authorization', workshopLeadAuthorization)
      .expect(200);

    const adjustmentId = settlementBefore.body.adjustments[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/void-adjustment`)
      .set('Authorization', workshopLeadAuthorization)
      .send({ adjustmentId, reason: 'Error en el calculo del descuento original' })
      .expect(200);

    const settlementAfter = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${discountableOrderId}/settlement`)
      .set('Authorization', workshopLeadAuthorization)
      .expect(200);

    expect(settlementAfter.body.discountsTotal).toBe('0.00');
    expect(settlementAfter.body.totalAfterDiscounts).toBe('950.00');
    expect(settlementAfter.body.adjustments).toHaveLength(2);
  });

  it('rejects void for a non-existent adjustment (404)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/void-adjustment`)
      .set('Authorization', workshopLeadAuthorization)
      .send({ adjustmentId: '00000000-0000-4000-8000-000000000999', reason: 'Intento de anular ajuste que no existe en el sistema' })
      .expect(404);
  });

  it('delivers with the discount-adjusted total (RN-15, RN-21)', async () => {
    // Apply a new discount after the void
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/apply-discount`)
      .set('Authorization', workshopLeadAuthorization)
      .send({ amount: 30, reason: 'Descuento por cliente frecuente autorizado' })
      .expect(200);

    const deliverResponse = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/deliver`)
      .set('Authorization', receptionistAuthorization)
      .send({ paymentMethod: 'CASH', receiptNumber: 'F2026-E2E-DISC-001' })
      .expect(200);

    expect(deliverResponse.body.status).toBe('ENTREGADO');
    expect(new Prisma.Decimal(deliverResponse.body.totalCharged).equals(new Prisma.Decimal('920.00'))).toBe(true);
  });

  it('WORKSHOP_LEAD can view settlement of a LISTO_ENTREGA order (RN-15)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${notReadyOrderId}/settlement`)
      .set('Authorization', workshopLeadAuthorization)
      .expect(409);
  });

  it('rejects discount with amount zero or negative (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/apply-discount`)
      .set('Authorization', workshopLeadAuthorization)
      .send({ amount: 0, reason: 'Descuento invalido con monto cero' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${discountableOrderId}/settlement/apply-discount`)
      .set('Authorization', workshopLeadAuthorization)
      .send({ amount: -10, reason: 'Descuento invalido con monto negativo' })
      .expect(400);
  });
});