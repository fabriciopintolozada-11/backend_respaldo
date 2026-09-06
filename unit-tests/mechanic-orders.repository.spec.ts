import { MechanicOrdersRepository } from '../src/modules/work-orders/repositories/mechanic-orders.repository';

describe('MechanicOrdersRepository (HU-03)', () => {
  let repo: MechanicOrdersRepository;
  let prisma: { workOrder: { findMany: jest.Mock; findFirst: jest.Mock; count: jest.Mock } };

  const mechanicId = '00000000-0000-0000-0000-000000000021';
  const assignedRow = {
    id: 'wo-1',
    vehicleId: 'v-1',
    status: 'EN_REPARACION',
    initialComplaint: 'No arranca',
    assignedAt: new Date('2026-08-02T10:00:00Z'),
    vehicle: { plate: '1234ABC' },
    quote: null,
  };

  beforeEach(() => {
    prisma = { workOrder: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() } };
    repo = new MechanicOrdersRepository(prisma as never);
  });

  it('filters by the authenticated mechanic id and orders by assignedAt (RN-04, BE-19)', async () => {
    prisma.workOrder.findMany.mockResolvedValue([assignedRow]);

    const result = await repo.findAssignedToMechanic(mechanicId, 1, 20);

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mechanicId },
        orderBy: { assignedAt: 'desc' },
        skip: 0,
        take: 20,
      }),
    );
    expect(result).toEqual([assignedRow]);
  });

  it('applies pagination offsets based on page and pageSize (BE-24)', async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);

    await repo.findAssignedToMechanic(mechanicId, 3, 25);

    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 }),
    );
  });

  it('selects only assigned fields and never reads cost or price values (RN-16, BE-12)', async () => {
    prisma.workOrder.findMany.mockResolvedValue([assignedRow]);

    await repo.findAssignedToMechanic(mechanicId, 1, 20);

    const select = prisma.workOrder.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(
      ['assignedAt', 'id', 'initialComplaint', 'quote', 'status', 'vehicleId', 'vehicle'].sort(),
    );
    expect(select.quote.select.parts.select.sparePart.select).toEqual(
      expect.objectContaining({ code: true, name: true }),
    );
    expect(select.quote.select.parts.select).toEqual(
      expect.objectContaining({ sparePartId: true, quantity: true, status: true }),
    );
    const serialized = JSON.stringify(select);
    expect(serialized).not.toMatch(/price|cost|amount|rate|total/i);
  });

  it('returns the technical detail only when the order belongs to the mechanic (RN-04)', async () => {
    prisma.workOrder.findFirst.mockResolvedValue({
      ...assignedRow,
      vehicle: { plate: '1234ABC', brand: 'Toyota', model: 'Corolla', year: 2020 },
    });

    const result = await repo.findAssignedDetail(mechanicId, 'wo-1');

    expect(prisma.workOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wo-1', mechanicId } }),
    );
    const select = prisma.workOrder.findFirst.mock.calls[0][0].select;
    expect(select.vehicle.select).toEqual(
      expect.objectContaining({ brand: true, model: true, year: true }),
    );
    expect(result?.vehicle.plate).toBe('1234ABC');
  });

  it('returns null when the detail belongs to another mechanic (RN-04)', async () => {
    prisma.workOrder.findFirst.mockResolvedValue(null);

    const result = await repo.findAssignedDetail(mechanicId, 'foreign-wo');

    expect(result).toBeNull();
  });

  it('the detail query omits any monetary value (RN-16, BE-12)', async () => {
    prisma.workOrder.findFirst.mockResolvedValue(null);

    await repo.findAssignedDetail(mechanicId, 'wo-1');

    const select = prisma.workOrder.findFirst.mock.calls[0][0].select;
    expect(JSON.stringify(select)).not.toMatch(/price|cost|amount|rate|total/i);
  });

  it('counts only the work orders assigned to the given mechanic (RN-04)', async () => {
    prisma.workOrder.count.mockResolvedValue(3);

    const result = await repo.countAssignedToMechanic(mechanicId);

    expect(prisma.workOrder.count).toHaveBeenCalledWith({ where: { mechanicId } });
    expect(result).toBe(3);
  });

  it('returns an empty list when the mechanic has no assigned work orders', async () => {
    prisma.workOrder.findMany.mockResolvedValue([]);

    const result = await repo.findAssignedToMechanic(mechanicId, 1, 20);

    expect(result).toEqual([]);
  });
});
