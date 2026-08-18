import { ConflictException, NotFoundException } from '@nestjs/common';
import { AssignWorkOrderService } from './assign-work-order.service';
import { MechanicNotFoundError, WorkOrderAlreadyAssignedError, WorkOrdersRepository } from '../../infraestructure/repositories/work-orders.repository';

describe('AssignWorkOrderService (US-04)', () => {
  const repository = { assign: jest.fn() } as unknown as WorkOrdersRepository;
  const service = new AssignWorkOrderService(repository);

  beforeEach(() => jest.clearAllMocks());

  it('returns the assigned order', async () => {
    repository.assign = jest.fn().mockResolvedValue({ id: 'order-1', mecanicoId: 'mechanic-1', status: 'ASIGNADA', updatedAt: new Date() });
    await expect(service.assign('order-1', { mecanicoId: 'mechanic-1' })).resolves.toHaveProperty('status', 'ASIGNADA');
  });

  it('maps missing orders and mechanics to not found', async () => {
    repository.assign = jest.fn().mockRejectedValue(new MechanicNotFoundError('Mechanic not found'));
    await expect(service.assign('order-1', { mecanicoId: 'mechanic-1' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves assignment conflicts', async () => {
    repository.assign = jest.fn().mockRejectedValue(new WorkOrderAlreadyAssignedError('Work order is already assigned'));
    await expect(service.assign('order-1', { mecanicoId: 'mechanic-1' })).rejects.toBeInstanceOf(ConflictException);
  });
});
