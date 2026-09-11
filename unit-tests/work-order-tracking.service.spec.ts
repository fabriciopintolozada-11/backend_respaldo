import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';

describe('WorkOrdersService.getTrackingSummary (US-05 / BE-T05.1, BE-T05.2)', () => {
  const repository = {
    findTrackingSummary: jest.fn(),
  };
  let service: WorkOrdersService;

  const NOW = new Date('2026-09-06T00:00:00Z').getTime();

  const baseRow = {
    id: 'wo-1',
    status: 'EN_REPARACION',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    plate: '4589-KXA',
    model: 'Hilux',
    customerPhone: '710000000',
    mechanicName: 'Mecánico Uno',
    bayId: 'bay-1',
    bayNumber: 1,
    quoteCreatedAt: null,
    discrepancy: null,
    additionalFindingDescription: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    service = new WorkOrdersService(
      repository as unknown as WorkOrderRepository,
      { get: jest.fn() } as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes the plate and forwards the filters to the repository', async () => {
    repository.findTrackingSummary.mockResolvedValue([]);

    await service.getTrackingSummary({ licensePlate: ' 4589-kxa ', status: 'EN_REPARACION', workBayId: 'bay-1' });

    expect(repository.findTrackingSummary).toHaveBeenCalledWith({
      licensePlate: '4589-KXA',
      status: 'EN_REPARACION',
      workBayId: 'bay-1',
    });
  });

  it('computes the days in workshop from the immutable entry date', async () => {
    repository.findTrackingSummary.mockResolvedValue([baseRow]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.entryDate).toEqual(new Date('2026-09-01T00:00:00Z'));
    expect(tracking.daysInWorkshop).toBe(5);
    expect(tracking.bayId).toBe('bay-1');
    expect(tracking.bayNumber).toBe(1);
    expect(tracking.mechanicName).toBe('Mecánico Uno');
    expect(tracking.customerPhone).toBe('710000000');
  });

  it('reports the missing part and reason for an awaiting-part order (US-13 / RN-05)', async () => {
    repository.findTrackingSummary.mockResolvedValue([
      {
        ...baseRow,
        status: 'EN_ESPERA_DE_REPUESTO',
        discrepancy: {
          sparePartName: 'Amortiguador Delantero a Gas KYB Excel-G',
          pausedReason: 'Part not found in warehouse shelf',
        },
      },
    ]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.missingPartName).toBe('Amortiguador Delantero a Gas KYB Excel-G');
    expect(tracking.pausedReason).toBe('Part not found in warehouse shelf');
    expect(tracking.daysWaitingApproval).toBeNull();
  });

  it('computes the days waiting for customer approval on PRESUPUESTO_ENVIADO', async () => {
    const quoteCreatedAt = new Date('2026-09-03T00:00:00Z');
    repository.findTrackingSummary.mockResolvedValue([
      { ...baseRow, status: 'PRESUPUESTO_ENVIADO', quoteCreatedAt },
    ]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.pausedReason).toBe('Awaiting customer approval');
    expect(tracking.daysWaitingApproval).toBe(3);
    expect(tracking.isStaleQuote).toBe(false);
    expect(tracking.missingPartName).toBeNull();
  });

  it('flags an order as stale when it awaits approval for 15+ days (US-16 / RN-06)', async () => {
    const quoteCreatedAt = new Date('2026-08-20T00:00:00Z');
    repository.findTrackingSummary.mockResolvedValue([
      { ...baseRow, status: 'PRESUPUESTO_ENVIADO', quoteCreatedAt },
    ]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.daysWaitingApproval).toBe(17);
    expect(tracking.isStaleQuote).toBe(true);
  });

  it('does not flag non-PRESUPUESTO_ENVIADO orders as stale (US-16 / RN-06)', async () => {
    repository.findTrackingSummary.mockResolvedValue([
      { ...baseRow, status: 'EN_REPARACION', quoteCreatedAt: new Date('2026-08-01T00:00:00Z') },
    ]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.daysWaitingApproval).toBeNull();
    expect(tracking.isStaleQuote).toBe(false);
  });

  it('forwards onlyStaleQuotes=false without a stale quote cutoff (US-16 / BE-T16.3)', async () => {
    repository.findTrackingSummary.mockResolvedValue([]);

    await service.getTrackingSummary({ onlyStaleQuotes: false });

    expect(repository.findTrackingSummary).toHaveBeenCalledWith({
      licensePlate: undefined,
      status: undefined,
      workBayId: undefined,
      staleQuoteCutoff: undefined,
    });
  });

  it('computes the 15-day cutoff and requests a DB-level filter when onlyStaleQuotes=true (US-16 / BE-T16.3)', async () => {
    repository.findTrackingSummary.mockResolvedValue([]);

    await service.getTrackingSummary({ onlyStaleQuotes: true });

    // NOW is mocked to 2026-09-06T00:00:00Z -> cutoff 15 days earlier.
    expect(repository.findTrackingSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        licensePlate: undefined,
        status: undefined,
        workBayId: undefined,
        staleQuoteCutoff: new Date('2026-08-22T00:00:00Z'),
      }),
    );
  });

  it('keeps pause fields null for a normal in-shop order', async () => {
    repository.findTrackingSummary.mockResolvedValue([baseRow]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.missingPartName).toBeNull();
    expect(tracking.pausedReason).toBeNull();
    expect(tracking.daysWaitingApproval).toBeNull();
    expect(tracking.isStaleQuote).toBe(false);
  });

  it('flags a pending additional finding reported during repair (US-21 / RN-03)', async () => {
    repository.findTrackingSummary.mockResolvedValue([
      {
        ...baseRow,
        status: 'PRESUPUESTO_ENVIADO',
        quoteCreatedAt: new Date('2026-09-03T00:00:00Z'),
        additionalFindingDescription: 'Fuga de aceite detectada en el motor',
      },
    ]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.hasPendingAdditionalFinding).toBe(true);
    expect(tracking.additionalFindingDescription).toBe('Fuga de aceite detectada en el motor');
    expect(tracking.pausedReason).toBe('Awaiting customer approval');
  });

  it('does not flag the badge when the order has no pending additional finding', async () => {
    repository.findTrackingSummary.mockResolvedValue([baseRow]);

    const [tracking] = await service.getTrackingSummary({});

    expect(tracking.hasPendingAdditionalFinding).toBe(false);
    expect(tracking.additionalFindingDescription).toBeNull();
  });

  it('returns an empty list when no work orders match', async () => {
    repository.findTrackingSummary.mockResolvedValue([]);

    await expect(service.getTrackingSummary({ licensePlate: 'ZZZ-999' })).resolves.toEqual([]);
  });
});