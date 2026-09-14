import { NotFoundException } from '@nestjs/common';
import { PublicTrackingRepository } from '../src/modules/public-tracking/repositories/public-tracking.repository';
import {
  PUBLIC_TRACKING_NOT_FOUND_MESSAGE,
  PublicTrackingService,
} from '../src/modules/public-tracking/public-tracking.service';

describe('PublicTrackingService (US-17 / RN-17)', () => {
  const repository = {
    findActiveByPlateAndNationalId: jest.fn(),
  };
  let service: PublicTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublicTrackingService(repository as unknown as PublicTrackingRepository);
  });

  it('normalizes the license plate and returns sanitized public tracking data', async () => {
    repository.findActiveByPlateAndNationalId.mockResolvedValue({
      id: 'work-order-id',
      status: 'IN_REPAIR',
      createdAt: new Date('2026-09-10T12:00:00Z'),
      vehicle: { model: 'Hilux' },
      quote: {
        details: [
          { description: 'Cambio de aceite', itemType: 'LABOR' },
          { description: 'Alineación', itemType: 'LABOR' },
        ],
      },
    });

    const response = await service.findActiveWorkOrder({
      licensePlate: '  1234abc ',
      nationalId: ' 9876543 ',
    });

    expect(repository.findActiveByPlateAndNationalId).toHaveBeenCalledWith('1234ABC', '9876543');
    expect(response).toEqual({
      workOrderNumber: 'work-order-id',
      vehicleModel: 'Hilux',
      status: 'IN_REPAIR',
      receivedAt: new Date('2026-09-10T12:00:00Z'),
      readyForPickup: false,
      tasksSummary: ['Cambio de aceite', 'Alineación'],
    });
    expect(response).not.toHaveProperty('totalCharged');
    expect(response).not.toHaveProperty('mechanicName');
  });

  it.each(['READY_FOR_DELIVERY', 'FINALIZED'])('marks %s as ready for pickup', async (status) => {
    repository.findActiveByPlateAndNationalId.mockResolvedValue({
      id: 'work-order-id',
      status,
      createdAt: new Date('2026-09-10T12:00:00Z'),
      vehicle: { model: 'Corolla' },
      quote: { details: [] },
    });

    const response = await service.findActiveWorkOrder({ licensePlate: 'ABC123', nationalId: '1234567' });

    expect(response.readyForPickup).toBe(true);
  });

  it('returns an empty task summary when the active order has no quote yet', async () => {
    repository.findActiveByPlateAndNationalId.mockResolvedValue({
      id: 'work-order-id',
      status: 'RECEIVED',
      createdAt: new Date('2026-09-10T12:00:00Z'),
      vehicle: { model: 'Swift' },
      quote: null,
    });

    const response = await service.findActiveWorkOrder({ licensePlate: 'ABC123', nationalId: '1234567' });

    expect(response.tasksSummary).toEqual([]);
  });

  it('throws a privacy-preserving NotFoundException with the exact required message', async () => {
    repository.findActiveByPlateAndNationalId.mockResolvedValue(null);

    await expect(
      service.findActiveWorkOrder({ licensePlate: 'ABC123', nationalId: 'wrong-ci' }),
    ).rejects.toThrow(new NotFoundException(PUBLIC_TRACKING_NOT_FOUND_MESSAGE));
  });
});
