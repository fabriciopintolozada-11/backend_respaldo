import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegisterVehicleEntryDto } from './dto/register-vehicle-entry.dto';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';
import { ConsumeSparePartDto } from './dto/consume-spare-part.dto';
import { ReturnSparePartDto } from './dto/return-spare-part.dto';
import { SetAwaitingPartDto } from './dto/set-awaiting-part.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { QueryTrackingWorkOrdersDto } from './dto/query-tracking-work-orders.dto';
import { ApproveAdditionalFindingDto } from './dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from './dto/reject-additional-finding.dto';
import { VehicleReceptionService, STALE_QUOTE_THRESHOLD_DAYS, STALE_QUOTE_REFERENCE } from './services/vehicle-reception.service';
import { AdditionalFindingsService } from './services/additional-findings.service';
import { PartReservationService } from './services/part-reservation.service';
import { WorkOrderCompletionService } from './services/work-order-completion.service';
import { AppConfigService } from '../config/app-config.service';

// BE-P01: the previous single god service was divided by domain into the
// services wired below. WorkOrdersService remains a thin facade that keeps the
// exact public API and constructor used by the controllers; the business rules
// (BE-06) live in the focused domain services.
export { STALE_QUOTE_THRESHOLD_DAYS, STALE_QUOTE_REFERENCE };

@Injectable()
export class WorkOrdersService {
  private readonly vehicleReception: VehicleReceptionService;
  private readonly additionalFindings: AdditionalFindingsService;
  private readonly partReservation: PartReservationService;
  private readonly completion: WorkOrderCompletionService;

  constructor(
    repository: WorkOrderRepository,
    configService: ConfigService,
  ) {
    this.vehicleReception = new VehicleReceptionService(repository);
    this.additionalFindings = new AdditionalFindingsService(repository, new AppConfigService(configService));
    this.partReservation = new PartReservationService(repository);
    this.completion = new WorkOrderCompletionService(repository);
  }

  // US-05 / BE-T05.1 + BE-T05.2 + US-16 / RN-06: tracking summary.
  getTrackingSummary(query: QueryTrackingWorkOrdersDto) {
    return this.vehicleReception.getTrackingSummary(query);
  }

  // HU-12: the advisor reads the diagnostic of a work order before quoting.
  getDiagnostic(id: string) {
    return this.vehicleReception.getDiagnostic(id);
  }

  // HU-12: list work orders in EN_DIAGNOSTICO that are ready to be quoted.
  getPendingQuoteOrders() {
    return this.vehicleReception.getPendingQuoteOrders();
  }

  registerVehicleEntry(dto: RegisterVehicleEntryDto, receptionistId: string) {
    return this.vehicleReception.registerVehicleEntry(dto, receptionistId);
  }

  async getAvailableWorkOrders(query: QueryWorkOrdersDto) {
    return this.vehicleReception.getAvailableWorkOrders(query);
  }

  async getActiveMechanics(query: QueryWorkOrdersDto) {
    return this.vehicleReception.getActiveMechanics(query);
  }

  async createDiagnostic(id: string, mechanicId: string, dto: CreateDiagnosticDto) {
    return this.additionalFindings.createDiagnostic(id, mechanicId, dto);
  }

  approveAdditionalFinding(
    workOrderId: string,
    dto: ApproveAdditionalFindingDto,
    userId: string,
  ) {
    return this.additionalFindings.approveAdditionalFinding(workOrderId, dto, userId);
  }

  rejectAdditionalFinding(
    workOrderId: string,
    dto: RejectAdditionalFindingDto,
    userId: string,
  ) {
    return this.additionalFindings.rejectAdditionalFinding(workOrderId, dto, userId);
  }

  consumePart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: ConsumeSparePartDto,
  ) {
    return this.partReservation.consumePart(workOrderId, userId, role, dto);
  }

  returnPart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: ReturnSparePartDto,
  ) {
    return this.partReservation.returnPart(workOrderId, userId, role, dto);
  }

  setAwaitingPart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: SetAwaitingPartDto,
  ) {
    return this.partReservation.setAwaitingPart(workOrderId, userId, role, dto);
  }

  complete(workOrderId: string, userId: string, role: string, dto: CompleteWorkOrderDto) {
    return this.completion.complete(workOrderId, userId, role, dto);
  }
}