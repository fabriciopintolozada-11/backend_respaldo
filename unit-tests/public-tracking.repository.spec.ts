import { PublicTrackingRepository } from '../src/modules/public-tracking/repositories/public-tracking.repository';

describe('PublicTrackingRepository (US-17 / BE-T17.3)', () => {
  it('uses a transactional Prisma select allowlist without financial or mechanic data', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      $transaction: jest.fn((callback: (tx: { workOrder: { findFirst: typeof findFirst } }) => unknown) =>
        callback({ workOrder: { findFirst } }),
      ),
    };
    const repository = new PublicTrackingRepository(prisma as never);

    await repository.findActiveByPlateAndNationalId('1234ABC', '1234567');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        vehicle: { plate: '1234ABC' },
        customer: { identification: '1234567' },
        status: {
          in: expect.arrayContaining(['RECEIVED', 'IN_REPAIR', 'READY_FOR_DELIVERY']),
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        vehicle: { select: { model: true } },
        quote: {
          select: {
            details: {
              where: { itemType: 'LABOR' },
              orderBy: { id: 'asc' },
              select: { description: true, itemType: true },
            },
          },
        },
      },
    });

    const query = findFirst.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(query)).not.toContain('mechanic');
    expect(JSON.stringify(query)).not.toContain('totalCharged');
    expect(JSON.stringify(query)).not.toContain('unitPrice');
    expect(JSON.stringify(query)).not.toContain('subtotal');
    expect(JSON.stringify(query)).not.toContain('laborSubtotal');
    expect(JSON.stringify(query)).not.toContain('partsSubtotal');
  });
});
