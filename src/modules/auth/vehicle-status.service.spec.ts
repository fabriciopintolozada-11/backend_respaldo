import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VehicleStatusService } from './vehicle-status.service';
import { VehicleStatusRepository } from './repositories/vehicle-status.repository';

describe('VehicleStatusService (US-02)', () => {
  let service: VehicleStatusService;
  const repository = { findLatestByPlateAndIdentification: jest.fn() };

  const baseOrder = {
    id: 'ot-1',
    status: 'EN_REPARACION',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    vehicle: { plate: '1234ABC', brand: 'Toyota', model: 'Corolla', year: 2019 },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleStatusService,
        { provide: VehicleStatusRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(VehicleStatusService);
  });

  it('returns the current status and stage for a valid work order (US-02)', async () => {
    repository.findLatestByPlateAndIdentification.mockResolvedValue(baseOrder);

    const result = await service.getStatus('1234abc', '1234567');

    expect(result.status).toBe('EN_REPARACION');
    expect(result.stage).toBe('En reparación');
    expect(result.readyForPickup).toBe(false);
    expect(result.plate).toBe('1234ABC');
    // plate is normalized to uppercase before hitting the repository
    expect(repository.findLatestByPlateAndIdentification).toHaveBeenCalledWith('1234ABC', '1234567');
  });

  it('indicates the vehicle is ready for pickup when the order is finalized (US-02)', async () => {
    repository.findLatestByPlateAndIdentification.mockResolvedValue({ ...baseOrder, status: 'FINALIZADO' });

    const result = await service.getStatus('1234ABC', '1234567');

    expect(result.readyForPickup).toBe(true);
    expect(result.stage).toBe('Finalizado');
  });

  it('throws NotFoundException when no work order matches and does not leak data (US-02)', async () => {
    repository.findLatestByPlateAndIdentification.mockResolvedValue(null);

    await expect(service.getStatus('9999ZZZ', '0000000')).rejects.toThrow(NotFoundException);
  });
});
