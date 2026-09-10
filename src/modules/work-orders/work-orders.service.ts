import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RegisterVehicleEntryDto } from './dto/register-vehicle-entry.dto';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { normalizePlate, validateVehicleCanBeReceived } from '../../domain/work-orders/vehicle-entry.rules';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';
import { ConsumeSparePartDto } from './dto/consume-spare-part.dto';
import { WorkOrderPartResponseDto } from './dto/work-order-part.response.dto';
import { SetAwaitingPartDto } from './dto/set-awaiting-part.dto';
import { AwaitingPartResponseDto } from './dto/awaiting-part-response.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { CompleteWorkOrderResponseDto } from './dto/complete-work-order.response.dto';
import { DeliverWorkOrderDto } from './dto/deliver-work-order.dto';
import { DeliverWorkOrderResponseDto } from './dto/deliver-work-order.response.dto';
import { WorkOrderSettlementResponseDto } from './dto/work-order-settlement.response.dto';
import { DiagnosticResponseDto } from './dto/diagnostic-response.dto';
import { PendingQuoteWorkOrderResponseDto } from './dto/pending-quote-work-order.response.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { ListWorkOrdersResponseDto } from './dto/work-order-list.response.dto';
import { ListMechanicsResponseDto } from './dto/mechanic-list.response.dto';
import { QueryTrackingWorkOrdersDto } from './dto/query-tracking-work-orders.dto';
import { WorkOrderTrackingResponseDto } from './dto/work-order-tracking.response.dto';
import type { VehicleHistoryRow } from './repositories/work-order.repository';
import { VehicleHistoryConsumedPartDto, VehicleHistoryResponseDto } from './dto/vehicle-history.response.dto';
import { Prisma } from '../../generated/prisma/client';

function elapsedDays(since: Date, now: number): number {
  return Math.max(0, Math.floor((now - since.getTime()) / 86_400_000));
}

// BE-T05.3: aggregates kardex OUT movements per installed spare part, keeping
// the earliest (immutable) consumption date.
function aggregateConsumedParts(
  movements: VehicleHistoryRow['workOrders'][number]['stockMovements'],
): VehicleHistoryConsumedPartDto[] {
  const byPart = new Map<string, VehicleHistoryConsumedPartDto>();
  for (const movement of movements) {
    const current = byPart.get(movement.sparePart.id);
    byPart.set(movement.sparePart.id, {
      sparePartId: movement.sparePart.id,
      code: movement.sparePart.code,
      name: movement.sparePart.name,
      quantity: (current?.quantity ?? 0) + movement.quantity,
      createdAt: current?.createdAt ?? movement.createdAt,
    });
  }
  return [...byPart.values()];
}

@Injectable()
export class WorkOrdersService {
  constructor(private readonly repository: WorkOrderRepository) {}

  // US-05 / BE-T05.3: vehicle file with the previous delivered work orders
  // (diagnosis + installed parts) and the immutable technical history (RN-19).
  async getVehicleHistory(plate: string): Promise<VehicleHistoryResponseDto> {
    const vehicle = await this.repository.findVehicleHistory(normalizePlate(plate));
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      isFullyElectric: vehicle.isFullyElectric,
      customerId: vehicle.customerId,
      customer: vehicle.customer,
      technicalHistory: vehicle.technicalHistory,
      workOrders: vehicle.workOrders.map((order) => ({
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        diagnostic: order.diagnostic
          ? {
              id: order.diagnostic.id,
              description: order.diagnostic.description,
              suggestedTasks: Array.isArray(order.diagnostic.suggestedTasks)
                ? (order.diagnostic.suggestedTasks as string[])
                : [],
              estimatedHours: Number(order.diagnostic.estimatedHours),
              createdAt: order.diagnostic.createdAt,
            }
          : null,
        consumedParts: aggregateConsumedParts(order.stockMovements),
      })),
    };
  }

  // US-05 / BE-T05.1 + BE-T05.2: tracking summary for the reactive search by
  // plate, status or bay. Pause details and days in workshop are derived here
  // (BE-06) from immutably recorded dates (RN-19).
  async getTrackingSummary(query: QueryTrackingWorkOrdersDto): Promise<WorkOrderTrackingResponseDto[]> {
    const rows = await this.repository.findTrackingSummary({
      licensePlate: query.licensePlate ? normalizePlate(query.licensePlate) : undefined,
      status: query.status,
      workBayId: query.workBayId,
    });
    const now = Date.now();

    return rows.map((row) => {
      let missingPartName: string | null = null;
      let pausedReason: string | null = null;
      let daysWaitingApproval: number | null = null;

      // US-13 / RN-05: awaiting part with the pending warehouse discrepancy.
      if (row.status === 'EN_ESPERA_DE_REPUESTO' && row.discrepancy) {
        missingPartName = row.discrepancy.sparePartName;
        pausedReason = row.discrepancy.pausedReason;
      }
      // Rendezvous awaiting customer approval after the budget was sent.
      if (row.status === 'PRESUPUESTO_ENVIADO' && row.quoteCreatedAt) {
        pausedReason = 'Awaiting customer approval';
        daysWaitingApproval = elapsedDays(row.quoteCreatedAt, now);
      }

      return {
        id: row.id,
        plate: row.plate,
        model: row.model,
        status: row.status,
        entryDate: row.createdAt,
        daysInWorkshop: elapsedDays(row.createdAt, now),
        bayId: row.bayId,
        bayNumber: row.bayNumber,
        mechanicName: row.mechanicName,
        customerPhone: row.customerPhone,
        missingPartName,
        pausedReason,
        daysWaitingApproval,
      };
    });
  }

  // HU-12: the advisor reads the diagnostic for the work order before quoting.
  async getDiagnostic(id: string): Promise<DiagnosticResponseDto> {
    const order = await this.repository.findDiagnostic(id);
    if (!order) throw new NotFoundException('Work order not found');
    if (!order.diagnostic) throw new NotFoundException('Work order has no diagnostic yet');
    const { diagnostic } = order;
    return {
      id: diagnostic.id,
      workOrderId: diagnostic.workOrderId,
      description: diagnostic.description,
      suggestedTasks: Array.isArray(diagnostic.suggestedTasks) ? diagnostic.suggestedTasks as string[] : [],
      suggestedPartIds: Array.isArray(diagnostic.suggestedPartIds) ? diagnostic.suggestedPartIds as string[] : [],
      estimatedHours: Number(diagnostic.estimatedHours),
      createdAt: diagnostic.createdAt,
    };
  }

  // HU-12: list work orders in EN_DIAGNOSTICO that are ready to be quoted.
  getPendingQuoteOrders(): Promise<PendingQuoteWorkOrderResponseDto[]> {
    return this.repository.findPendingQuoteOrders().then((rows) =>
      rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicleId,
        plate: row.vehicle.plate,
        brand: row.vehicle.brand,
        model: row.vehicle.model,
        year: row.vehicle.year,
        customerName: row.customer.name,
        status: row.status,
        initialComplaint: row.initialComplaint,
        createdAt: row.createdAt,
      })),
    );
  }

  registerVehicleEntry(dto: RegisterVehicleEntryDto, receptionistId: string) {
    validateVehicleCanBeReceived(dto.vehicle.isFullyElectric);
    return this.repository.createVehicleEntry({ ...dto, plate: normalizePlate(dto.plate) }, receptionistId);
  }

  async getAvailableWorkOrders(query: QueryWorkOrdersDto): Promise<ListWorkOrdersResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [rows, total] = await Promise.all([
      this.repository.findAvailable(page, pageSize),
      this.repository.countAvailable(),
    ]);

    return { data: rows, total, page, pageSize };
  }

  async getActiveMechanics(query: QueryWorkOrdersDto): Promise<ListMechanicsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [data, total] = await Promise.all([
      this.repository.findActiveMechanics(page, pageSize),
      this.repository.countActiveMechanics(),
    ]);

    return { data, total, page, pageSize };
  }

  async createDiagnostic(id: string, mechanicId: string, dto: CreateDiagnosticDto) {
    const order = await this.repository.findAssignedWorkOrder(id, mechanicId);
    if (!order) throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    if (!['RECIBIDO', 'ASIGNADA', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(order.status)) {
      throw new ConflictException('Work order cannot receive a diagnostic in its current state');
    }
    // RN-03: additional findings suspend repair until a new quote is approved.
    return this.repository.createDiagnostic(id, dto, order.status === 'EN_REPARACION' ? 'PRESUPUESTO_ENVIADO' : 'EN_DIAGNOSTICO');
  }

  // HU-07: confirm the installation/use of a reserved spare part.
  // All rules live in the service (BE-06); the repository performs the atomic
  // persistence (BE-16).
  async consumePart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: ConsumeSparePartDto,
  ): Promise<WorkOrderPartResponseDto> {
    const context = await this.repository.findConsumeContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: only the assigned mechanic consumes parts; the workshop lead
    // oversees and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-09: the order must be approved or in repair. Receiving/diagnostic
    // stages cannot start a repair or consume stock.
    if (!['APROBADO', 'EN_REPARACION'].includes(context.status)) {
      throw new UnprocessableEntityException('RN-09: work order is not approved or in repair to consume a spare part');
    }

    // RN-07: the requested part must belong to this order's approved quote and
    // be reserved exclusively for it.
    const partId = dto.workOrderPartId ?? dto.quotePartId;
    const part = context.quote?.parts?.find((item) => item.id === partId);
    if (!part || part.status !== 'RESERVED') {
      throw new UnprocessableEntityException('RN-07: spare part is not reserved for this work order');
    }

    // RN-01: never consume more than the reserved quantity.
    // HU-07: the first consumption of an approved order moves it to repair.
    const nextStatus = context.status === 'APROBADO' ? 'EN_REPARACION' : context.status;

    return this.repository.consumePart(workOrderId, dto, userId, nextStatus);
  }

  // US-13: set a work order to EN_ESPERA_DE_REPUESTO when a spare part is
  // physically unavailable in the warehouse. All business rules live here
  // (BE-06); the repository performs the atomic persistence (BE-16).
  async setAwaitingPart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: SetAwaitingPartDto,
  ): Promise<AwaitingPartResponseDto> {
    const context = await this.repository.findAwaitingPartContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: only the assigned mechanic can set the order to awaiting part;
    // the workshop lead oversees and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-05: the work order must be strictly in EN_REPARACION to transition
    // to EN_ESPERA_DE_REPUESTO.
    if (context.status !== 'EN_REPARACION') {
      throw new ConflictException(
        'RN-05: work order must be in EN_REPARACION to set awaiting part',
      );
    }

    // Validate that the missing part belongs to this work order's approved
    // quote. This prevents reporting a part that was never requested.
    const quoteParts = context.quote?.parts ?? [];
    const partBelongsToOrder = quoteParts.some(
      (p) => p.sparePartId === dto.missingPartId,
    );
    if (!partBelongsToOrder) {
      throw new UnprocessableEntityException(
        'The reported spare part is not associated with this work order',
      );
    }

    return this.repository.setAwaitingPart(
      workOrderId,
      dto,
      userId,
      context.vehicleId,
    );
  }

  // US-19: conclude a repair, set the work order to LISTO_ENTREGA and free
  // its physical bay (BE-T19.2, RN-05, RN-14, RN-19). All rules live here
  // (BE-06); the repository performs the atomic persistence (BE-16).
  async complete(
    workOrderId: string,
    userId: string,
    role: string,
    dto: CompleteWorkOrderDto,
  ): Promise<CompleteWorkOrderResponseDto> {
    const context = await this.repository.findCompleteContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: the mechanic can only conclude work orders assigned to him; the
    // workshop lead supervises and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new ForbiddenException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-05: a work order waiting for spare parts must not be concluded.
    if (context.status === 'EN_ESPERA_DE_REPUESTO') {
      throw new UnprocessableEntityException(
        'RN-05: work order is awaiting spare parts and cannot be concluded',
      );
    }

    // State machine (E4): only EN_REPARACION can be concluded.
    if (context.status !== 'EN_REPARACION') {
      throw new ConflictException(
        'Work order must be in EN_REPARACION to conclude the repair',
      );
    }

    return this.repository.completeWorkOrder(workOrderId, dto, userId);
  }

  // US-20: build the consolidated settlement (RN-21) for an order that is
  // ready to be delivered. Only LISTO_ENTREGA is settled; every monetary
  // value is serialized as a string (BE-13).
  async getSettlement(workOrderId: string): Promise<WorkOrderSettlementResponseDto> {
    const context = await this.repository.findSettlementContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-05 (E4): only LISTO_ENTREGA orders can be settled.
    if (context.status !== 'LISTO_ENTREGA') {
      throw new ConflictException('Work order must be in LISTO_ENTREGA to settle');
    }

    // RN-21: total = approved labor subtotal + installed parts subtotal.
    // Every monetary value is serialized with the DECIMAL(12,2) scale so the
    // API always returns two decimals (BE-13).
    const installedParts = (context.quote?.parts ?? []).filter((part) => part.status === 'INSTALLED');
    const partsSubtotal = installedParts.reduce(
      (sum, part) => sum.plus(part.subtotal),
      new Prisma.Decimal(0),
    );
    const laborSubtotal = context.quote?.laborSubtotal ?? new Prisma.Decimal(0);

    return {
      workOrderId: context.id,
      status: context.status,
      plate: context.vehicle.plate,
      brand: context.vehicle.brand,
      model: context.vehicle.model,
      year: context.vehicle.year,
      customerName: context.customer.name,
      laborSubtotal: laborSubtotal.toFixed(2),
      parts: installedParts.map((part) => ({
        id: part.id,
        code: part.sparePart.code,
        name: part.sparePart.name,
        quantity: part.quantity,
        unitPrice: part.unitPrice.toFixed(2),
        subtotal: part.subtotal.toFixed(2),
      })),
      partsSubtotal: partsSubtotal.toFixed(2),
      total: partsSubtotal.plus(laborSubtotal).toFixed(2),
      currency: context.quote?.currency ?? 'BOB',
    };
  }

  // US-20: settle the account and register the vehicle handover (RN-21,
  // RN-19). All business rules live here (BE-06); the repository performs the
  // atomic persistence (BE-16).
  async deliver(
    workOrderId: string,
    userId: string,
    dto: DeliverWorkOrderDto,
  ): Promise<DeliverWorkOrderResponseDto> {
    const context = await this.repository.findSettlementContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-05 (E4): only LISTO_ENTREGA orders can be delivered.
    if (context.status !== 'LISTO_ENTREGA') {
      throw new ConflictException('Work order must be in LISTO_ENTREGA to be delivered');
    }

    // RN-21: an order already handed over cannot be settled again.
    if (context.deliveredAt) {
      throw new ConflictException('Work order has already been delivered');
    }

    return this.repository.deliverWorkOrder(workOrderId, userId, dto);
  }
}
