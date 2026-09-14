import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from '../dto/register-vehicle-entry.dto';
import { DeliverWorkOrderDto } from '../dto/deliver-work-order.dto';
import { DeliverWorkOrderResponseDto } from '../dto/deliver-work-order.response.dto';
import { AssignWorkOrderResponseDto } from '../dto/assign-work-order.dto';
import { CreateDiagnosticDto } from '../dto/create-diagnostic.dto';
import { DiagnosticResponseDto } from '../dto/diagnostic-response.dto';
import { ConsumeSparePartDto } from '../dto/consume-spare-part.dto';
import { ReturnSparePartDto } from '../dto/return-spare-part.dto';
import { WorkOrderPartResponseDto } from '../dto/work-order-part.response.dto';
import { SetAwaitingPartDto } from '../dto/set-awaiting-part.dto';
import { AwaitingPartResponseDto } from '../dto/awaiting-part-response.dto';
import { CompleteWorkOrderDto } from '../dto/complete-work-order.dto';
import { CompleteWorkOrderResponseDto } from '../dto/complete-work-order.response.dto';
import { ApplyDiscountDto } from '../dto/apply-discount.dto';
import { VoidAdjustmentDto } from '../dto/void-adjustment.dto';
import { SettlementAdjustmentResponseDto } from '../dto/settlement-adjustment.response.dto';
import { ApproveAdditionalFindingDto } from '../dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from '../dto/reject-additional-finding.dto';
import { AdditionalFindingResponseDto } from '../dto/additional-finding.response.dto';
import { Prisma } from '../../../generated/prisma/client';
import { VehicleReceptionRepository, AvailableWorkOrderRow, WorkOrderTrackingRow, VehicleHistoryRow, ActiveMechanicRow } from './vehicle-reception.repository';
import { AdditionalFindingRepository } from './additional-finding.repository';
import { PartReservationRepository } from './part-reservation.repository';
import { WorkOrderCompletionRepository } from './work-order-completion.repository';
import { SettlementRepository } from './settlement.repository';
import { WorkOrderAssignmentRepository } from './work-order-assignment.repository';

// BE-P01: the previous single god repository was divided by domain into the
// repositories listed below. WorkOrderRepository remains a thin facade that
// keeps the exact public API and constructor used by controllers and tests;
// the domain quirks live in the focused repositories.
export type { AvailableWorkOrderRow, WorkOrderTrackingRow, VehicleHistoryRow, ActiveMechanicRow };

@Injectable()
export class WorkOrderRepository {
  private readonly vehicleReception: VehicleReceptionRepository;
  private readonly additionalFinding: AdditionalFindingRepository;
  private readonly partReservation: PartReservationRepository;
  private readonly completion: WorkOrderCompletionRepository;
  private readonly settlement: SettlementRepository;
  private readonly assignment: WorkOrderAssignmentRepository;

  constructor(private readonly prisma: PrismaService) {
    this.vehicleReception = new VehicleReceptionRepository(prisma);
    this.additionalFinding = new AdditionalFindingRepository(prisma);
    this.partReservation = new PartReservationRepository(prisma);
    this.completion = new WorkOrderCompletionRepository(prisma);
    this.settlement = new SettlementRepository(prisma);
    this.assignment = new WorkOrderAssignmentRepository(prisma);
  }

  findAssignedWorkOrder(id: string, mechanicId: string) {
    return this.vehicleReception.findAssignedWorkOrder(id, mechanicId);
  }

  findDiagnostic(workOrderId: string) {
    return this.vehicleReception.findDiagnostic(workOrderId);
  }

  findPendingQuoteOrders() {
    return this.vehicleReception.findPendingQuoteOrders();
  }

  findAvailable(page: number, pageSize: number): Promise<AvailableWorkOrderRow[]> {
    return this.vehicleReception.findAvailable(page, pageSize);
  }

  countAvailable(): Promise<number> {
    return this.vehicleReception.countAvailable();
  }

  findActiveMechanics(page: number, pageSize: number): Promise<ActiveMechanicRow[]> {
    return this.vehicleReception.findActiveMechanics(page, pageSize);
  }

  countActiveMechanics(): Promise<number> {
    return this.vehicleReception.countActiveMechanics();
  }

  findVehicleHistory(plate: string): Promise<VehicleHistoryRow | null> {
    return this.vehicleReception.findVehicleHistory(plate);
  }

  findTrackingSummary(filters: {
    licensePlate?: string;
    status?: string;
    workBayId?: string;
    staleQuoteCutoff?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<WorkOrderTrackingRow[]> {
    return this.vehicleReception.findTrackingSummary(filters);
  }

  countTrackingSummary(filters: {
    licensePlate?: string;
    status?: string;
    workBayId?: string;
    staleQuoteCutoff?: Date;
  }): Promise<number> {
    return this.vehicleReception.countTrackingSummary(filters);
  }

  createVehicleEntry(dto: RegisterVehicleEntryDto, receptionistId: string): Promise<WorkOrderResponseDto> {
    return this.vehicleReception.createVehicleEntry(dto, receptionistId);
  }

  assign(id: string, mechanicId: string): Promise<AssignWorkOrderResponseDto> {
    return this.assignment.assign(id, mechanicId);
  }

  createDiagnostic(id: string, dto: CreateDiagnosticDto, status: string, reportedBy?: string): Promise<DiagnosticResponseDto> {
    return this.additionalFinding.createDiagnostic(id, dto, status, reportedBy);
  }

  findAdditionalFindingContext(workOrderId: string) {
    return this.additionalFinding.findAdditionalFindingContext(workOrderId);
  }

  approveAdditionalFinding(
    workOrderId: string,
    dto: ApproveAdditionalFindingDto,
    userId: string,
    laborHourlyRate: Prisma.Decimal,
  ): Promise<AdditionalFindingResponseDto> {
    return this.additionalFinding.approveAdditionalFinding(workOrderId, dto, userId, laborHourlyRate);
  }

  rejectAdditionalFinding(
    workOrderId: string,
    dto: RejectAdditionalFindingDto,
    userId: string,
  ): Promise<AdditionalFindingResponseDto> {
    return this.additionalFinding.rejectAdditionalFinding(workOrderId, dto, userId);
  }

  findConsumeContext(workOrderId: string) {
    return this.partReservation.findConsumeContext(workOrderId);
  }

  consumePart(
    workOrderId: string,
    dto: ConsumeSparePartDto,
    userId: string,
    nextStatus: string,
  ): Promise<WorkOrderPartResponseDto> {
    return this.partReservation.consumePart(workOrderId, dto, userId, nextStatus);
  }

  returnPart(
    workOrderId: string,
    dto: ReturnSparePartDto,
    userId: string,
  ): Promise<WorkOrderPartResponseDto> {
    return this.partReservation.returnPart(workOrderId, dto, userId);
  }

  findAwaitingPartContext(workOrderId: string) {
    return this.partReservation.findAwaitingPartContext(workOrderId);
  }

  setAwaitingPart(
    workOrderId: string,
    dto: SetAwaitingPartDto,
    userId: string,
    vehicleId: string,
  ): Promise<AwaitingPartResponseDto> {
    return this.partReservation.setAwaitingPart(workOrderId, dto, userId, vehicleId);
  }

  findCompleteContext(workOrderId: string) {
    return this.completion.findCompleteContext(workOrderId);
  }

  completeWorkOrder(
    workOrderId: string,
    dto: CompleteWorkOrderDto,
    userId: string,
  ): Promise<CompleteWorkOrderResponseDto> {
    return this.completion.completeWorkOrder(workOrderId, dto, userId);
  }

  findSettlementContext(workOrderId: string) {
    return this.settlement.findSettlementContext(workOrderId);
  }

  deliverWorkOrder(
    workOrderId: string,
    userId: string,
    dto: DeliverWorkOrderDto,
  ): Promise<DeliverWorkOrderResponseDto> {
    return this.settlement.deliverWorkOrder(workOrderId, userId, dto);
  }

  applyDiscount(
    workOrderId: string,
    userId: string,
    dto: ApplyDiscountDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.settlement.applyDiscount(workOrderId, userId, dto);
  }

  voidAdjustment(
    workOrderId: string,
    userId: string,
    dto: VoidAdjustmentDto,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.settlement.voidAdjustment(workOrderId, userId, dto);
  }
}