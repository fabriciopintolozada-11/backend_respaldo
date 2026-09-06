import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SparePartsController (e2e) - HU-23', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let partId: string;
  let alertPartId: string;
  let leadAuthorization: string;
  let mechanicAuthorization: string;
  let receptionistAuthorization: string;
  const code = `E2E-${Date.now()}`;
  const alertCode = `${code}-ALERT`;
  const leadId = '00000000-0000-4000-8000-000000000040';
  const mechanicId = '11111111-1111-4111-8111-111111111111';
  const receptionistId = '00000000-0000-4000-8000-000000000010';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    leadAuthorization = `Bearer ${jwtService.sign({ sub: leadId, role: UserRole.WORKSHOP_LEAD }, { secret: process.env.JWT_SECRET })}`;
    mechanicAuthorization = `Bearer ${jwtService.sign({ sub: mechanicId, role: UserRole.MECHANIC }, { secret: process.env.JWT_SECRET })}`;
    receptionistAuthorization = `Bearer ${jwtService.sign({ sub: receptionistId, role: UserRole.RECEPTIONIST }, { secret: process.env.JWT_SECRET })}`;
  });

  afterAll(async () => {
    if (partId) {
      await prisma.stockMovement.deleteMany({ where: { sparePartId: partId } });
      await prisma.sparePart.delete({ where: { id: partId } });
    }
    if (alertPartId) {
      await prisma.stockMovement.deleteMany({ where: { sparePartId: alertPartId } });
      await prisma.sparePart.delete({ where: { id: alertPartId } });
    }
    await app.close();
  });

  it('creates, lists and hides price from a mechanic using PostgreSQL', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/spare-parts')
      .set('Authorization', leadAuthorization)
      .send({ code, name: 'Pastilla E2E', category: 'FRENOS', unitPrice: 125.5, initialStock: 8 })
      .expect(201);

    partId = created.body.id as string;
    expect(created.body.physicalStock).toBe(8);
    expect(created.body.availableStock).toBe(8);
    expect(created.body.unitPrice).toBe('125.5');

    const mechanicList = await request(app.getHttpServer())
      .get('/api/v1/spare-parts?search=E2E&category=FRENOS&page=1&pageSize=10')
      .set('Authorization', mechanicAuthorization)
      .expect(200);

    expect(mechanicList.body.data.some((item: { id: string }) => item.id === partId)).toBe(true);
    const mechanicItem = mechanicList.body.data.find((item: { id: string }) => item.id === partId) as Record<string, unknown>;
    expect(mechanicItem.unitPrice).toBeUndefined();
    expect(mechanicList.body).toMatchObject({ page: 1, pageSize: 10 });
  });

  it('rejects catalog creation for reception and deactivates logically for the lead', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/spare-parts')
      .set('Authorization', receptionistAuthorization)
      .send({ code: `${code}-NO`, name: 'No autorizado', category: 'MOTOR', unitPrice: 1, initialStock: 1 })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/spare-parts/${partId}/deactivate`)
      .set('Authorization', leadAuthorization)
      .expect(200);

    const stored = await prisma.sparePart.findUnique({ where: { id: partId } });
    expect(stored?.isActive).toBe(false);
  });

  it('reports an STOCK_OUT alert to the lead and hides the endpoint from mechanics (HU-08, RN-10)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/spare-parts')
      .set('Authorization', leadAuthorization)
      .send({ code: alertCode, name: 'Repuesto sin stock E2E', category: 'MOTOR', unitPrice: 80, initialStock: 0 })
      .expect(201);

    alertPartId = created.body.id as string;
    expect(alertPartId).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/v1/inventory/alerts')
      .set('Authorization', mechanicAuthorization)
      .expect(403);

    const alerts = await request(app.getHttpServer())
      .get(`/api/v1/inventory/alerts?search=${alertCode}&page=1&pageSize=10`)
      .set('Authorization', leadAuthorization)
      .expect(200);

    expect(alerts.body).toMatchObject({ page: 1, pageSize: 10 });
    const alert = alerts.body.data.find((item: { partId: string }) => item.partId === alertPartId);
    expect(alert).toBeDefined();
    expect(alert).toMatchObject({
      alertType: 'STOCK_OUT',
      physicalStock: 0,
      availableStock: 0,
    });
  });
});
