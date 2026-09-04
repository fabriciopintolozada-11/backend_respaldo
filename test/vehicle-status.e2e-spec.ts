import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const testIdentification = `E2E-${Date.now()}`;
const testPlate = `E${String(Date.now()).slice(-7)}`;
let prisma: PrismaService;
let customerId: string;
let vehicleId: string;
let inProcessWorkOrderId: string;
let finalizedWorkOrderId: string;

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

    prisma = app.get(PrismaService);
    const customer = await prisma.customer.create({ data: { identification: testIdentification, name: 'Cliente e2e' } });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: { customerId, plate: testPlate, brand: 'Toyota', model: 'Corolla', year: 2020 },
    });
    vehicleId = vehicle.id;
    const inProcessWorkOrder = await prisma.workOrder.create({
      data: { vehicleId, customerId, receptionistId: '00000000-0000-0000-0000-000000000001', initialComplaint: 'Falla de prueba', status: 'EN_REPARACION', createdAt: new Date(Date.now() - 1000) },
    });
    inProcessWorkOrderId = inProcessWorkOrder.id;
    const finalizedWorkOrder = await prisma.workOrder.create({
      data: { vehicleId, customerId, receptionistId: '00000000-0000-0000-0000-000000000001', initialComplaint: 'Falla finalizada', status: 'FINALIZADO', createdAt: new Date() },
    });
    finalizedWorkOrderId = finalizedWorkOrder.id;
  });

  afterAll(async () => {
    await prisma.workOrder.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.customer.delete({ where: { id: customerId } });
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

  it('GET /api/v1/public/vehicle-status rejects a valid plate with an incorrect document', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/public/vehicle-status?plate=${testPlate}&identification=INCORRECTO`)
      .expect(404);
  });

  it('GET /api/v1/public/vehicle-status returns the current stage for an order in process', async () => {
    await prisma.workOrder.update({ where: { id: inProcessWorkOrderId }, data: { status: 'EN_REPARACION' } });
    await prisma.workOrder.update({ where: { id: finalizedWorkOrderId }, data: { status: 'CERRADA' } });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/public/vehicle-status?plate=${testPlate}&identification=${testIdentification}`)
      .expect(200);

    expect(response.body.stage).toBe('En reparación');
    expect(response.body.readyForPickup).toBe(false);
  });

  it('GET /api/v1/public/vehicle-status returns the current stage and pickup status when finalized', async () => {
    await prisma.workOrder.update({ where: { id: finalizedWorkOrderId }, data: { status: 'FINALIZADO' } });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/public/vehicle-status?plate=${testPlate}&identification=${testIdentification}`)
      .expect(200);

    expect(response.body.stage).toBe('Finalizado');
    expect(response.body.readyForPickup).toBe(true);
  });
});
