import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignWorkOrderService } from './assign-work-order.service';
import { WorkOrderRepository } from './repositories/work-order.repository';

describe('AssignWorkOrderService (HU-04)', () => {
  const repository = {
    findWorkOrderForAssignment: jest.fn(),
    findMechanicForAssignment: jest.fn(),
    assignWorkOrder: jest.fn(),
  } as unknown as WorkOrderRepository;
  const transaction = jest.fn((callback: (db: unknown) => unknown) => callback({}));
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  let service: AssignWorkOrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssignWorkOrderService(repository, prisma);
  });

  it('assigns a received work order and changes it to ASIGNADA (RN-14)', async () => {
    repository.findWorkOrderForAssignment = jest.fn().mockResolvedValue({ mechanicId: null, status: 'RECIBIDO' });
    repository.findMechanicForAssignment = jest.fn().mockResolvedValue({ isActive: true });
    repository.assignWorkOrder = jest.fn().mockResolvedValue({
      id: 'order-1', mechanicId: 'mechanic-1', status: 'ASIGNADA', updatedAt: new Date(),
    });

    await expect(service.assign('order-1', { mechanicId: 'mechanic-1' })).resolves.toMatchObject({ status: 'ASIGNADA' });
    expect(repository.assignWorkOrder).toHaveBeenCalledWith({}, 'order-1', 'mechanic-1');
  });

  it('rejects an unknown work order', async () => {
    repository.findWorkOrderForAssignment = jest.fn().mockResolvedValue(null);

    await expect(service.assign('missing', { mechanicId: 'mechanic-1' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects assignment by state without changing the order', async () => {
    repository.findWorkOrderForAssignment = jest.fn().mockResolvedValue({ mechanicId: null, status: 'EN_REPARACION' });

    await expect(service.assign('order-1', { mechanicId: 'mechanic-1' })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.assignWorkOrder).not.toHaveBeenCalled();
  });
});
