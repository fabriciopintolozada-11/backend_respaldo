import { Prisma } from '../src/generated/prisma/client';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { CreateDiagnosticDto } from '../src/modules/work-orders/dto/create-diagnostic.dto';

describe('WorkOrderRepository.createDiagnostic (HU-11)', () => {
  const workOrderId = 'aaaa0000-0000-4000-8000-000000000001';
  const vehicleId = 'bbbb0000-0000-4000-8000-000000000002';
  const partA = 'cccc0000-0000-4000-8000-000000000003';

  const diagnostic: CreateDiagnosticDto = {
    description: 'Frenos desgastados',
    suggestedTasks: ['Reemplazar pastillas'],
    suggestedPartIds: [partA],
    estimatedHours: 2,
  };

  function buildFixture() {
    const diagnosticRow = {
      id: 'dddd0000-0000-4000-8000-000000000004',
      workOrderId,
      description: diagnostic.description,
      suggestedTasks: diagnostic.suggestedTasks as unknown as Prisma.InputJsonValue,
      suggestedPartIds: diagnostic.suggestedPartIds as unknown as Prisma.InputJsonValue,
      estimatedHours: new Prisma.Decimal('2'),
      createdAt: new Date('2026-08-20T10:00:00Z'),
    };
    const tx = {
      diagnostic: { upsert: jest.fn().mockResolvedValue(diagnosticRow) },
      workOrder: {
        update: jest.fn().mockResolvedValue({ vehicleId }),
      },
      technicalHistory: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    return { repository: new WorkOrderRepository(prisma as never), tx };
  }

  it('persists the diagnostic, updates the work order status and appends immutable history (RN-19)', async () => {
    const { repository, tx } = buildFixture();

    await repository.createDiagnostic(workOrderId, diagnostic, 'EN_DIAGNOSTICO');

    expect(tx.diagnostic.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workOrderId },
        create: expect.objectContaining({
          workOrderId,
          description: diagnostic.description,
          suggestedTasks: diagnostic.suggestedTasks,
          suggestedPartIds: diagnostic.suggestedPartIds,
        }),
      }),
    );
    expect(tx.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: workOrderId },
        data: { status: 'EN_DIAGNOSTICO' },
      }),
    );
    // RN-19: the technical history is append-only inside the same atomic transaction.
    expect(tx.technicalHistory.create).toHaveBeenCalledWith({
      data: {
        vehicleId,
        description: expect.stringContaining(diagnostic.description),
      },
    });
  });

  it('suspends the order to PRESUPUESTO_ENVIADO inside the same transaction when there are additional findings (RN-03)', async () => {
    const { repository, tx } = buildFixture();

    await repository.createDiagnostic(workOrderId, diagnostic, 'PRESUPUESTO_ENVIADO');

    expect(tx.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: workOrderId },
        data: { status: 'PRESUPUESTO_ENVIADO' },
      }),
    );
    expect(tx.technicalHistory.create).toHaveBeenCalledTimes(1);
  });

  it('returns an explicit non-financial allowlist so no prices leak to the mechanic (RN-16)', async () => {
    const { repository } = buildFixture();

    const result = await repository.createDiagnostic(workOrderId, diagnostic, 'EN_DIAGNOSTICO');

    const keys = Object.keys(result);
    expect(keys).toEqual([
      'id',
      'workOrderId',
      'description',
      'suggestedTasks',
      'suggestedPartIds',
      'estimatedHours',
      'createdAt',
    ]);
    expect(result).not.toHaveProperty('unitPrice');
    expect(result).not.toHaveProperty('total');
    expect(result.estimatedHours).toBe(2);
  });
});
