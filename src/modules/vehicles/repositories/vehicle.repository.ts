import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

// BE-T05.3: only these terminal states count as a previous delivered visit.
// FINALIZED is the legacy closed state; DELIVERED is the delivered state.
const DELIVERED_WORK_ORDER_STATUSES: string[] = [WorkOrderStatus.DELIVERED, WorkOrderStatus.FINALIZED];

export interface VehicleHistoryRow {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  isFullyElectric: boolean;
  customerId: string;
  customer: { id: string; identification: string; name: string; phone: string | null };
  technicalHistory: { id: string; description: string; createdAt: Date }[];
  workOrders: {
    id: string;
    status: string;
    createdAt: Date;
    diagnostic: {
      id: string;
      description: string;
      suggestedTasks: Prisma.JsonValue;
      estimatedHours: Prisma.Decimal;
      createdAt: Date;
    } | null;
    stockMovements: {
      quantity: number;
      createdAt: Date;
      sparePart: { id: string; code: string; name: string };
    }[];
  }[];
}

@Injectable()
export class VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // US-05 / BE-T05.3: previous delivered work orders of a vehicle with their
  // immutable diagnosis, installed spare parts (kardex OUT movements) and dates
  // (RN-19). Active orders are intentionally excluded from the history.
  async findVehicleHistory(plate: string): Promise<VehicleHistoryRow | null> {
    return this.prisma.vehicle.findUnique({
      where: { plate },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        isFullyElectric: true,
        customerId: true,
        customer: { select: { id: true, identification: true, name: true, phone: true } },
        technicalHistory: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, description: true, createdAt: true },
        },
        workOrders: {
          where: { status: { in: DELIVERED_WORK_ORDER_STATUSES } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            diagnostic: {
              select: {
                id: true,
                description: true,
                suggestedTasks: true,
                estimatedHours: true,
                createdAt: true,
              },
            },
            stockMovements: {
              where: { type: 'OUT' },
              orderBy: { createdAt: 'asc' },
              select: {
                quantity: true,
                createdAt: true,
                sparePart: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });
  }
}