import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// US-18: rows returned by the monitoring query. Includes the active work
// order with its vehicle and mechanic so the dashboard can render plate,
// model, mechanic and accumulated time. No cost or price is selected (RN-16).
export interface WorkBayMonitoringRow {
  id: string;
  bayNumber: number;
  isOccupied: boolean;
  currentWorkOrderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentWorkOrder: {
    id: string;
    status: string;
    assignedAt: Date | null;
    vehicle: { plate: string; brand: string; model: string } | null;
    mechanic: { id: string } | null;
  } | null;
  mechanicName: string | null;
}

export interface AssignedWorkBayRow {
  id: string;
  bayNumber: number;
  isOccupied: boolean;
  currentWorkOrderId: string | null;
  updatedAt: Date;
}

// Terminal / closed states that must never be assigned to a physical bay (US-18).
const NOT_ASSIGNABLE_STATUSES = ['ENTREGADO', 'FINALIZADO', 'LISTO_ENTREGA', 'RECHAZADO'];

// US-18 (BE-08, BE-09, BE-16): data-access layer for the 4 physical workshop
// bays. Business-state checks run inside the transaction to stay atomic.
@Injectable()
export class WorkBayRepository {
  constructor(private readonly prisma: PrismaService) {}

  // US-18 / BE-T18.2: monitoring query. Mechanic names come from the users
  // table because Mechanic.id doubles as User.id (seed convention).
  async findAllByNumber(): Promise<WorkBayMonitoringRow[]> {
    const bays = await this.prisma.workBay.findMany({
      orderBy: { bayNumber: 'asc' },
      include: {
        currentWorkOrder: {
          include: {
            vehicle: { select: { plate: true, brand: true, model: true } },
            mechanic: { select: { id: true } },
          },
        },
      },
    });

    const mechanicIds = bays
      .map((b) => b.currentWorkOrder?.mechanic?.id)
      .filter((id): id is string => Boolean(id));
    const nameByUserId = new Map<string, string>();
    if (mechanicIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: mechanicIds } },
        select: { id: true, fullName: true },
      });
      users.forEach((u) => nameByUserId.set(u.id, u.fullName));
    }

    return bays.map((b) => ({
      id: b.id,
      bayNumber: b.bayNumber,
      isOccupied: b.isOccupied,
      currentWorkOrderId: b.currentWorkOrderId,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      currentWorkOrder: b.currentWorkOrder
        ? {
            id: b.currentWorkOrder.id,
            status: b.currentWorkOrder.status,
            assignedAt: b.currentWorkOrder.assignedAt,
            vehicle: b.currentWorkOrder.vehicle,
            mechanic: b.currentWorkOrder.mechanic
              ? { id: b.currentWorkOrder.mechanic.id }
              : null,
          }
        : null,
      mechanicName: b.currentWorkOrder?.mechanic ? nameByUserId.get(b.currentWorkOrder.mechanic.id) ?? null : null,
    }));
  }

  findById(bayId: string) {
    return this.prisma.workBay.findUnique({ where: { id: bayId } });
  }

  findBayByWorkOrderId(workOrderId: string) {
    return this.prisma.workBay.findFirst({ where: { currentWorkOrderId: workOrderId } });
  }

  // US-18 / BE-T18.3: transactional assign. Frees the previous bay of the
  // work order and occupies the target bay atomically (BE-16, RN-14).
  assignWorkOrder(bayId: string, workOrderId: string): Promise<AssignedWorkBayRow> {
    return this.prisma.$transaction(async (tx) => {
      const targetBay = await tx.workBay.findUnique({ where: { id: bayId } });
      if (!targetBay) throw new NotFoundException('Work bay not found');

      const workOrder = await tx.workOrder.findUnique({ where: { id: workOrderId } });
      if (!workOrder) throw new NotFoundException('Work order not found');

      if (NOT_ASSIGNABLE_STATUSES.includes(workOrder.status)) {
        throw new Error(
          `Work order in status "${workOrder.status}" cannot be assigned to a bay`,
        );
      }

      if (targetBay.isOccupied && targetBay.currentWorkOrderId) {
        throw new ConflictException(
          'Capacity complete: the 4 bays are occupied. The vehicle must remain in the waiting queue',
        );
      }

      const previousBay = await tx.workBay.findFirst({
        where: { currentWorkOrderId: workOrderId },
      });
      if (previousBay && previousBay.id !== bayId) {
        await tx.workBay.update({
          where: { id: previousBay.id },
          data: { isOccupied: false, currentWorkOrderId: null },
        });
      }

      return tx.workBay.update({
        where: { id: bayId },
        data: { isOccupied: true, currentWorkOrderId: workOrderId },
        select: { id: true, bayNumber: true, isOccupied: true, currentWorkOrderId: true, updatedAt: true },
      });
    });
  }

  // US-18: physical status toggling. Freeing the bay also disconnects the
  // active work order (single source of truth lives on the bay).
  setOccupied(bayId: string, isOccupied: boolean): Promise<AssignedWorkBayRow> {
    return this.prisma.$transaction(async (tx) => {
      const bay = await tx.workBay.findUnique({ where: { id: bayId } });
      if (!bay) throw new NotFoundException('Work bay not found');

      if (isOccupied && !bay.currentWorkOrderId) {
        throw new Error('Cannot occupy a bay without a work order; use the assign operation instead');
      }

      return tx.workBay.update({
        where: { id: bayId },
        data: isOccupied ? { isOccupied: true } : { isOccupied: false, currentWorkOrderId: null },
        select: { id: true, bayNumber: true, isOccupied: true, currentWorkOrderId: true, updatedAt: true },
      });
    });
  }
}