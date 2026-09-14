import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

// HU-07 / BE-E03 / BE-16 / RN-07: releases the spare parts that still keep a
// RESERVED status for a work order, inside the caller's Prisma transaction.
//
// Reserved units that were never confirmed as installed return to the
// available stock (reservedStock is decremented, availableStock increased) and
// the quote_part lines are marked RELEASED, so a reservation can never be left
// permanently blocked when the work order does not get finalized (quote
// rejected, vehicle delivered without consuming the part, or a re-quote that
// cleans the previous budget).
//
// The released amount is the pending reservation: part.quantity minus the
// units already confirmed with kardex OUT movements of the same work order
// (a partially consumed part only frees what is still reserved). Releasing is
// not a physical movement (no stock is added or removed), so no kardex row is
// created, but an immutable technical history entry records the event (RN-19).
// Returns the number of released part lines (0 when there is nothing to do).
export async function releaseReservedParts(
  transaction: Prisma.TransactionClient,
  workOrderId: string,
): Promise<number> {
  const order = await transaction.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      vehicleId: true,
      quote: {
        select: {
          parts: {
            where: { status: 'RESERVED' },
            select: { id: true, sparePartId: true, quantity: true },
          },
        },
      },
    },
  });

  const parts = order?.quote?.parts ?? [];
  if (parts.length === 0) return 0;
  const vehicleId = order?.vehicleId;
  if (!vehicleId) return 0;

  let released = 0;
  for (const part of parts) {
    const consumed = await transaction.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { workOrderId, sparePartId: part.sparePartId, type: 'OUT' },
    });
    const consumedQuantity = consumed._sum.quantity ?? 0;
    const pendingQuantity = part.quantity - consumedQuantity;
    if (pendingQuantity <= 0) continue;

    // RN-07: move the pending reserved units back to the available stock. The
    // guarded update only matches when the reserved stock really backs the
    // pending reservation; otherwise the transaction aborts (BE-16).
    const stockUpdate = await transaction.sparePart.updateMany({
      where: { id: part.sparePartId, reservedStock: { gte: pendingQuantity } },
      data: {
        reservedStock: { decrement: pendingQuantity },
        availableStock: { increment: pendingQuantity },
      },
    });
    if (stockUpdate.count !== 1) {
      throw new UnprocessableEntityException(
        'Invalid reserved stock while releasing spare part reservations',
      );
    }

    await transaction.quotePart.update({
      where: { id: part.id },
      data: { status: 'RELEASED' },
    });
    released += 1;
  }

  if (released > 0) {
    // RN-19: permanent, immutable technical history entry.
    // vehicleId is guaranteed defined when released > 0 because that means
    // parts was non-empty, which required order to exist.
    await transaction.technicalHistory.create({
      data: {
        vehicleId: vehicleId,
        description: `Reserved spare parts released for work order ${workOrderId}`,
      },
    });
  }

  return released;
}