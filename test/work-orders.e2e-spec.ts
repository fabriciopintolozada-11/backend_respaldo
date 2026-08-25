import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WorkOrdersController (e2e) - US-01', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authorization: string;
  let customerId: string;
  let vehicleId: string;
  let workOrderId: string;
  const plate = `W${String(Date.now()).slice(-7)}`;
  const identification = `HU01-${Date.now()}`;
  const receptionistId = '00000000-0000-0000-0000-000000000010';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    authorization = `Bearer ${jwtService.sign({ sub: receptionistId, role: UserRole.RECEPTIONIST }, { secret: process.env.JWT_SECRET })}`;
  });

  afterAll(async () => {
    if (vehicleId) {
      await prisma.technicalHistory.deleteMany({ where: { vehicleId } });
      await prisma.workOrder.deleteMany({ where: { vehicleId } });
      await prisma.vehicle.delete({ where: { id: vehicleId } });
    }
    if (customerId) await prisma.customer.delete({ where: { id: customerId } });
    await app.close();
  });

  it('registers a customer, vehicle and work order successfully', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', authorization)
      .send({
        plate,
        customer: { identification, name: 'Cliente HU-01', phone: '70000001' },
        vehicle: { brand: 'Toyota', model: 'Corolla', year: 2020, isFullyElectric: false },
        initialComplaint: 'Revisión general',
      })
      .expect(201);

    expect(response.body.status).toBe('RECIBIDO');
    customerId = response.body.customerId;
    vehicleId = response.body.vehicleId;
    workOrderId = response.body.id;
  });

  it('rejects a fully electric vehicle', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', authorization)
      .send({
        plate: `E${String(Date.now()).slice(-7)}`,
        customer: { identification: `ELECTRIC-${Date.now()}`, name: 'Cliente eléctrico' },
        vehicle: { brand: 'Tesla', model: 'Model 3', year: 2024, isFullyElectric: true },
        initialComplaint: 'Ingreso de prueba',
      })
      .expect(422);
  });

  it('rejects a plate registered to another customer', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', authorization)
      .send({
        plate,
        customer: { identification: `OTHER-${Date.now()}`, name: 'Otro cliente' },
        vehicle: { brand: 'Toyota', model: 'Corolla', year: 2020, isFullyElectric: false },
        initialComplaint: 'Intento de conflicto',
      })
      .expect(409);
  });

  it('returns the vehicle history by plate', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${plate}/history`)
      .set('Authorization', authorization)
      .expect(200);

    expect(response.body.plate).toBe(plate);
    expect(response.body.workOrders.map((order: { id: string }) => order.id)).toContain(workOrderId);
    expect(response.body).not.toHaveProperty('customer');
  });
});
