import { Injectable, NotFoundException } from '@nestjs/common';
import { RegisterVehicleEntryDto } from '../dto/register-vehicle-entry.dto';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { normalizePlate, validateVehicleCanBeReceived } from '../../../domain/work-orders/vehicle-entry.rules';
import { DiagnosticResponseDto } from '../dto/diagnostic-response.dto';
import { PendingQuoteWorkOrderResponseDto } from '../dto/pending-quote-work-order.response.dto';
import { QueryWorkOrdersDto } from '../dto/query-work-orders.dto';
import { ListWorkOrdersResponseDto } from '../dto/work-order-list.response.dto';
import { ListMechanicsResponseDto } from '../dto/mechanic-list.response.dto';
import { QueryTrackingWorkOrdersDto } from '../dto/query-tracking-work-orders.dto';
import { ListTrackingWorkOrdersResponseDto } from '../dto/list-tracking-work-orders.response.dto';

function elapsedDays(since: Date, now: number): number {
  return Math.max(0, Math.floor((now - since.getTime()) / 86_400_000));
}

// RN-06 (US-16): an order awaiting quote approval for at least 15 continuous
// days triggers the reception alert.
export const STALE_QUOTE_THRESHOLD_DAYS = 15;

// SUP-15: the schema has no work_orders.quote_sent_at column; the work order
// transitions to PRESUPUESTO_ENVIADO in the same transaction that creates the
// Quote (quote.repository.ts), so Quote.createdAt is the formal emission date.
export const STALE_QUOTE_REFERENCE = 'quote.createdAt as quote emission date (SUP-15)';

@Injectable()
export class VehicleReceptionService {
  constructor(private readonly repository: WorkOrderRepository) {}

  // US-05 / BE-T05.1 + BE-T05.2: tracking summary for the reactive search by
  // plate, status or bay. Pause details and days in workshop are derived here
  // (BE-06) from immutably recorded dates (RN-19).
  //
  // US-16 / RN-06 (BE-T16.1, BE-T16.3): the 15-day staleness threshold and the
  // cutoff are computed here and passed to the repository, which filters at the
  // database level when onlyStaleQuotes=true.
  async getTrackingSummary(query: QueryTrackingWorkOrdersDto): Promise<ListTrackingWorkOrdersResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const now = Date.now();

    // BE-E13 / BE-24: page and total come from the same filters so the
    // frontend can render pagination over the full filtered population.
    const filters: Parameters<WorkOrderRepository['findTrackingSummary']>[0] = {
      licensePlate: query.licensePlate ? normalizePlate(query.licensePlate) : undefined,
      status: query.status,
      workBayId: query.workBayId,
      staleQuoteCutoff:
        query.onlyStaleQuotes === true
          ? new Date(now - STALE_QUOTE_THRESHOLD_DAYS * 86_400_000)
          : undefined,
    };

    const [rows, total] = await Promise.all([
      this.repository.findTrackingSummary({ ...filters, page, pageSize }),
      this.repository.countTrackingSummary(filters),
    ]);

    return {
      data: rows.map((row) => {
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
      // BE-T16.2 (US-16 / RN-06): computed flag surfaced to the tracking DTO.
      const isStaleQuote =
        daysWaitingApproval !== null && daysWaitingApproval >= STALE_QUOTE_THRESHOLD_DAYS;

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
        isStaleQuote,
        hasPendingAdditionalFinding: row.additionalFindingDescription !== null,
        additionalFindingDescription: row.additionalFindingDescription,
      };
      }),
      total,
      page,
      pageSize,
    };
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
}