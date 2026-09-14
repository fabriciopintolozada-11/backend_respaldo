import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { VehicleRepository } from '../src/modules/vehicles/repositories/vehicle.repository';

describe('WorkOrderRepository.findTrackingSummary (US-05 / BE-T05.1)', () => {
  const prisma = {
    workOrder: { findMany: jest.fn(), count: jest.fn() },
    user: { findMany: jest.fn() },
    vehicle: { findUnique: jest.fn() },
  };
  let repo: WorkOrderRepository;

  const orderRow = {
    id: 'wo-1',
    status: 'IN_REPAIR',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    vehicle: { plate: '4589-KXA', model: 'Hilux' },
    customer: { phone: '710000000' },
    mechanic: { id: 'mech-1' },
    currentBay: { id: 'bay-1', bayNumber: 1 },
    quote: null,
    inventoryDiscrepancies: [],
    additionalFindings: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WorkOrderRepository(prisma as never);
  });

  it('builds the relation filters by plate, status and bay', async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);

    await repo.findTrackingSummary({ licensePlate: '4589-KXA', status: 'IN_REPAIR', workBayId: 'bay-1' });

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicle: { is: { plate: '4589-KXA' } },
          status: 'IN_REPAIR',
          currentBay: { is: { id: 'bay-1' } },
        },
      }),
    );
  });

  it('runs without filters when none are provided', async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);

    await repo.findTrackingSummary({});

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('filters stale quotes at the database level when a cutoff is provided (US-16 / BE-T16.3)', async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    const cutoff = new Date('2026-08-22T00:00:00Z');

    await repo.findTrackingSummary({ staleQuoteCutoff: cutoff, licensePlate: '4589-KXA' });

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicle: { is: { plate: '4589-KXA' } },
          status: 'QUOTE_SENT',
          quote: { is: { createdAt: { lte: cutoff } } },
        },
      }),
    );
  });

  it('resolves mechanic names from the users table (seed convention) and returns bay data', async () => {
    prisma.workOrder.findMany.mockResolvedValue([orderRow]);
    prisma.user.findMany.mockResolvedValue([{ id: 'mech-1', fullName: 'Mecánico Uno' }]);

    const result = await repo.findTrackingSummary({});

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['mech-1'] } },
      select: { id: true, fullName: true },
    });
    expect(result[0]).toEqual({
      id: 'wo-1',
      status: 'IN_REPAIR',
      createdAt: orderRow.createdAt,
      plate: '4589-KXA',
      model: 'Hilux',
      customerPhone: '710000000',
      mechanicName: 'Mecánico Uno',
      bayId: 'bay-1',
      bayNumber: 1,
      quoteCreatedAt: null,
      discrepancy: null,
      additionalFindingDescription: null,
    });
  });

  it('maps the latest pending discrepancy as the suspension detail', async () => {
    prisma.workOrder.findMany.mockResolvedValue([
      {
        ...orderRow,
        status: 'WAITING_FOR_PART',
        quote: { createdAt: new Date() },
        inventoryDiscrepancies: [
          { reason: 'Out of stock', sparePart: { name: 'Pastillas de Freno Brembo' } },
        ],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'mech-1', fullName: 'Mecánico Uno' }]);

    const [result] = await repo.findTrackingSummary({});

    expect(result.quoteCreatedAt).toBeInstanceOf(Date);
    expect(result.discrepancy).toEqual({
      sparePartName: 'Pastillas de Freno Brembo',
      pausedReason: 'Out of stock',
    });
  });

  it('paginates the row set with skip/take when page and pageSize are provided (BE-E13, BE-24)', async () => {
    prisma.workOrder.findMany.mockResolvedValue([orderRow]);
    prisma.user.findMany.mockResolvedValue([]);

    await repo.findTrackingSummary({ page: 3, pageSize: 10 });

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('applies the default page and pageSize when none are provided (BE-E13, BE-24)', async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);

    await repo.findTrackingSummary({});

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('counts the filtered population with the same where and no pagination (BE-E13, BE-24)', async () => {
    prisma.workOrder.count.mockResolvedValue(7);
    const cutoff = new Date('2026-08-22T00:00:00Z');

    const total = await repo.countTrackingSummary({ licensePlate: '4589-KXA', staleQuoteCutoff: cutoff });

    expect(total).toBe(7);
    expect(prisma.workOrder.count).toHaveBeenCalledWith({
      where: {
        vehicle: { is: { plate: '4589-KXA' } },
        status: 'QUOTE_SENT',
        quote: { is: { createdAt: { lte: cutoff } } },
      },
    });
  });

  it('leaves mechanic name and bay null when they are not assigned', async () => {
    prisma.workOrder.findMany.mockResolvedValue([
      { ...orderRow, mechanic: null, currentBay: null },
    ]);
    prisma.user.findMany.mockResolvedValue([]);

    const [result] = await repo.findTrackingSummary({});

    expect(result.mechanicName).toBeNull();
    expect(result.bayId).toBeNull();
    expect(result.bayNumber).toBeNull();
  });

  it('surfaces the latest pending additional finding description (US-21 / RN-03)', async () => {
    prisma.workOrder.findMany.mockResolvedValue([
      {
        ...orderRow,
        status: 'QUOTE_SENT',
        quote: { createdAt: new Date('2026-09-03T00:00:00Z') },
        additionalFindings: [
          { description: 'Fuga de aceite detectada en el motor' },
        ],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'mech-1', fullName: 'Mecánico Uno' }]);

    const [result] = await repo.findTrackingSummary({});

    expect(result.additionalFindingDescription).toBe('Fuga de aceite detectada en el motor');
  });
});

describe('VehicleRepository.findVehicleHistory (US-05 / BE-T05.3)', () => {
  const prisma = {
    workOrder: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    vehicle: { findUnique: jest.fn() },
  };
  let repo: VehicleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new VehicleRepository(prisma as never);
  });

  it('queries the vehicle by plate filtering only delivered work orders', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v-1',
      plate: '4589-KXA',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2022,
      isFullyElectric: false,
      customerId: 'c-1',
      customer: { id: 'c-1', identification: 'CI-1000000', name: 'Juan Pérez', phone: '710000000' },
      technicalHistory: [],
      workOrders: [],
    });

    await repo.findVehicleHistory('4589-KXA');

    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plate: '4589-KXA' },
        select: expect.objectContaining({
          workOrders: expect.objectContaining({
            where: { status: { in: ['DELIVERED', 'FINALIZED'] } },
          }),
        }),
      }),
    );
  });

  it('returns null when the vehicle does not exist', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(null);

    await expect(repo.findVehicleHistory('ZZZ-999')).resolves.toBeNull();
  });
});