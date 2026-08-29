import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AssignWorkOrderController (e2e) - HU-04', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let workOrderId: string;
  let vehicleId: string;
  let customerId: string;
  const leadId = '00000000-0000-4000-8000-000000000041';
  const receptionistId = '00000000-0000-4000-8000-000000000042';
  const mechanicId = '00000000-0000-4000-8000-000000000043';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const customer = await prisma.customer.create({ data: { identification: `HU04-${Date.now()}`, name: 'Cliente HU-04' } });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: { customerId, plate: `H${String(Date.now()).slice(-7)}`, brand: 'Toyota', model: 'Yaris', year: 2022 },
    });
    vehicleId = vehicle.id;
    await prisma.mechanic.create({ data: { id: mechanicId, isActive: true } });
    const order = await prisma.workOrder.create({
      data: { vehicleId, customerId, receptionistId, initialComplaint: 'Revisión de frenos' },
    });
    workOrderId = order.id;
  });

  afterAll(async () => {
    await prisma.workOrder.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.mechanic.delete({ where: { id: mechanicId } });
    await app.close();
  });

  function authorization(sub: string, role: UserRole): string {
    return `Bearer ${app.get(JwtService).sign({ sub, role }, { secret: process.env.JWT_SECRET })}`;
  }

  it('assigns a received work order to the selected mechanic (RN-14)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/assign-mechanic`)
      .set('Authorization', authorization(leadId, UserRole.WORKSHOP_LEAD))
      .send({ mechanicId })
      .expect(200);

    expect(response.body).toMatchObject({ id: workOrderId, mechanicId, status: 'ASIGNADA' });

    const assignedOrders = await request(app.getHttpServer())
      .get('/api/v1/work-orders/assigned')
      .set('Authorization', authorization(mechanicId, UserRole.MECHANIC))
      .expect(200);

    expect(assignedOrders.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: workOrderId, status: 'ASIGNADA' })]),
    );
  });

  it('denies assignment to users without the workshop lead role', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/assign-mechanic`)
      .set('Authorization', authorization(receptionistId, UserRole.RECEPTIONIST))
      .send({ mechanicId })
      .expect(403);

    const order = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    expect(order.mechanicId).toBe(mechanicId);
    expect(order.status).toBe('ASIGNADA');
  });
});
