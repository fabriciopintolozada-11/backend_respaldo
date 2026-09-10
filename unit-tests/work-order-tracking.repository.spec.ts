import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';

describe('WorkOrderRepository.findTrackingSummary (US-05 / BE-T05.1)', () => {
  const prisma = {
    workOrder: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    vehicle: { findUnique: jest.fn() },
  };
  let repo: WorkOrderRepository;

  const orderRow = {
    id: 'wo-1',
    status: 'EN_REPARACION',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    vehicle: { plate: '4589-KXA', model: 'Hilux' },
    customer: { phone: '710000000' },
    mechanic: { id: 'mech-1' },
    currentBay: { id: 'bay-1', bayNumber: 1 },
    quote: null,
    inventoryDiscrepancies: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WorkOrderRepository(prisma as never);
  });

  it('builds the relation filters by plate, status and bay', async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);

    await repo.findTrackingSummary({ licensePlate: '4589-KXA', status: 'EN_REPARACION', workBayId: 'bay-1' });

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicle: { is: { plate: '4589-KXA' } },
          status: 'EN_REPARACION',
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
      status: 'EN_REPARACION',
      createdAt: orderRow.createdAt,
      plate: '4589-KXA',
      model: 'Hilux',
      customerPhone: '710000000',
      mechanicName: 'Mecánico Uno',
      bayId: 'bay-1',
      bayNumber: 1,
      quoteCreatedAt: null,
      discrepancy: null,
    });
  });

  it('maps the latest pending discrepancy as the suspension detail', async () => {
    prisma.workOrder.findMany.mockResolvedValue([
      {
        ...orderRow,
        status: 'EN_ESPERA_DE_REPUESTO',
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
});

describe('WorkOrderRepository.findVehicleHistory (US-05 / BE-T05.3)', () => {
  const prisma = {
    workOrder: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    vehicle: { findUnique: jest.fn() },
  };
  let repo: WorkOrderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WorkOrderRepository(prisma as never);
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
            where: { status: { in: ['ENTREGADO', 'FINALIZADO'] } },
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