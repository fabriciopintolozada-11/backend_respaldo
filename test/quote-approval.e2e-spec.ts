import 'dotenv/config';
import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { UserRole } from '../src/common/enums/user-role.enum';
import { QuotesController } from '../src/modules/quotes/quotes.controller';
import { QuotesService } from '../src/modules/quotes/quotes.service';
import { QuoteRepository } from '../src/modules/quotes/repositories/quote.repository';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requestContext = context.switchToHttp().getRequest<Request>();
    requestContext.user = { id: 'user-1', role: requestContext.header('x-user-role') ?? UserRole.RECEPTIONIST };
    return true;
  }
}

describe('Quote approval endpoints (e2e) — US-09', () => {
  let app: INestApplication;
  const workOrderId = '00000000-0000-4000-8000-000000000001';
  const repository = {
    findDecisionContext: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        QuotesService,
        RolesGuard,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: QuoteRepository, useValue: repository },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findDecisionContext.mockResolvedValue({ id: 'quote-1', workOrder: { id: 'order-1', status: 'PRESUPUESTO_ENVIADO' } });
    repository.approve.mockResolvedValue({ decision: 'APPROVED', quoteId: 'quote-1', workOrderId: 'order-1' });
    repository.reject.mockResolvedValue({ decision: 'REJECTED', quoteId: 'quote-1', workOrderId: 'order-1' });
  });

  it('approves a quote with channel and evidence', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/approve-quote`)
      .send({ channel: 'WHATSAPP', customerName: 'Cliente', notes: 'Autorizado por WhatsApp' })
      .expect(200);

    expect(response.body.decision).toBe('APPROVED');
    expect(repository.approve).toHaveBeenCalledWith(workOrderId, {
      channel: 'WHATSAPP',
      customerName: 'Cliente',
      notes: 'Autorizado por WhatsApp',
    }, 'user-1');
  });

  it('rejects a quote with a mandatory reason', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/reject-quote`)
      .send({ reason: 'Cliente no autoriza el trabajo' })
      .expect(200);

    expect(response.body.decision).toBe('REJECTED');
    expect(repository.reject).toHaveBeenCalledWith(workOrderId, { reason: 'Cliente no autoriza el trabajo' }, 'user-1');
  });

  it('rejects invalid approval payloads', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/approve-quote`)
      .send({ channel: 'EMAIL', customerName: 'Cliente' })
      .expect(400);

    expect(repository.approve).not.toHaveBeenCalled();
  });

  it('rejects mechanic access with 403 before the service is called', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/approve-quote`)
      .set('x-user-role', UserRole.MECHANIC)
      .send({ channel: 'CALL', customerName: 'Cliente', notes: 'Autorizado' })
      .expect(403);

    expect(repository.approve).not.toHaveBeenCalled();
  });
});
