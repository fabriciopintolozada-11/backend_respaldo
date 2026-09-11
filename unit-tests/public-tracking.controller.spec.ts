import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { PublicTrackingController } from '../src/modules/public-tracking/public-tracking.controller';
import { PublicTrackingService } from '../src/modules/public-tracking/public-tracking.service';

describe('PublicTrackingController (US-17 / BE-T17)', () => {
  const service = {
    findActiveWorkOrder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates the public tracking request to the service', async () => {
    const controller = new PublicTrackingController(service as unknown as PublicTrackingService);
    const dto = { licensePlate: '1234ABC', nationalId: '1234567' };
    const response = {
      workOrderNumber: 'work-order-id',
      vehicleModel: 'Hilux',
      status: 'EN_REPARACION',
      receivedAt: new Date('2026-09-10T12:00:00Z'),
      readyForPickup: false,
      tasksSummary: ['Cambio de aceite'],
    };
    service.findActiveWorkOrder.mockResolvedValue(response);

    await expect(controller.findActiveWorkOrder(dto)).resolves.toBe(response);
    expect(service.findActiveWorkOrder).toHaveBeenCalledWith(dto);
  });

  it('marks the endpoint as public and rate limited to 10 requests per 60 seconds', () => {
    const handler = PublicTrackingController.prototype.findActiveWorkOrder;
    const guards = Reflect.getMetadata(GUARDS_METADATA, PublicTrackingController) as unknown[];

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(guards).toContain(ThrottlerGuard);
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(10);
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(60_000);
  });
});
