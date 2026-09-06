import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AssignWorkOrderService } from '../src/modules/work-orders/assign-work-order.service';

describe('AssignWorkOrderService (HU-04, RN-14)', () => {
  const repository = { assign: jest.fn() };
  let service: AssignWorkOrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssignWorkOrderService(repository as never);
  });

  it('assigns an order using the mechanic UUID from the DTO', async () => {
    const response = { id: 'work-order-1', mechanicId: 'mechanic-1', status: 'ASIGNADA', updatedAt: new Date() };
    repository.assign.mockResolvedValue(response);

    await expect(service.assign('work-order-1', { mechanicId: 'mechanic-1' })).resolves.toBe(response);
    expect(repository.assign).toHaveBeenCalledWith('work-order-1', 'mechanic-1');
  });

  it('preserves not-found and conflict errors', async () => {
    repository.assign.mockRejectedValueOnce(new NotFoundException('Work order not found'));
    await expect(service.assign('missing-order', { mechanicId: 'mechanic-1' })).rejects.toBeInstanceOf(NotFoundException);

    repository.assign.mockRejectedValueOnce(new ConflictException('Work order is not assignable'));
    await expect(service.assign('work-order-1', { mechanicId: 'mechanic-1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps repository assignment rule failures to 422', async () => {
    repository.assign.mockRejectedValue(new Error('Work order is not assignable'));

    await expect(service.assign('work-order-1', { mechanicId: 'mechanic-1' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
