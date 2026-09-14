import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { CreateDiagnosticDto } from '../dto/create-diagnostic.dto';
import { ApproveAdditionalFindingDto } from '../dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from '../dto/reject-additional-finding.dto';
import { AdditionalFindingResponseDto } from '../dto/additional-finding.response.dto';
import { AppConfigService } from '../../config/app-config.service';
import { WorkOrderStatus } from '../../../common/enums/work-order-status.enum';

@Injectable()
export class AdditionalFindingsService {
  constructor(
    private readonly repository: WorkOrderRepository,
    private readonly appConfig: AppConfigService,
  ) {}

  async createDiagnostic(id: string, mechanicId: string, dto: CreateDiagnosticDto) {
    const order = await this.repository.findAssignedWorkOrder(id, mechanicId);
    if (!order) throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    if (![WorkOrderStatus.RECEIVED, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_DIAGNOSIS, WorkOrderStatus.IN_REPAIR].includes(order.status as WorkOrderStatus)) {
      throw new ConflictException('Work order cannot receive a diagnostic in its current state');
    }
    // RN-03: additional findings suspend repair until a new quote is approved.
    // The reportedBy comes from the authenticated mechanic (BE-19) and the
    // repository creates the AdditionalFinding annex for US-21 when the order
    // is suspended to QUOTE_SENT.
    return this.repository.createDiagnostic(id, dto, order.status === WorkOrderStatus.IN_REPAIR ? WorkOrderStatus.QUOTE_SENT : WorkOrderStatus.IN_DIAGNOSIS, mechanicId);
  }

  // US-21 (BE-T21.2, HU-09): the reception or the workshop lead approves the
  // additional quote of an unforeseen finding. The official hourly rate is read
  // from configuration (BE-12.5), never from the frontend, and passed to the
  // transactional repository operation (BE-6 / BE-16).
  async approveAdditionalFinding(
    workOrderId: string,
    dto: ApproveAdditionalFindingDto,
    userId: string,
  ): Promise<AdditionalFindingResponseDto> {
    const context = await this.repository.findAdditionalFindingContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');
    if (context.status !== WorkOrderStatus.QUOTE_SENT) {
      throw new ConflictException('Work order is not awaiting an additional budget approval');
    }
    if (context.additionalFindings.length === 0) {
      throw new ConflictException('Work order has no additional finding awaiting a decision');
    }
    const laborHourlyRate = this.appConfig.getLaborHourlyRate();
    return this.repository.approveAdditionalFinding(workOrderId, dto, userId, laborHourlyRate);
  }

  // US-21 (BE-T21.2, RN-19): the reception or the workshop lead rejects the
  // additional quote and the damage is archived permanently as not repaired by
  // customer decision. All rules live here (BE-06); the repository persists
  // atomically (BE-16).
  async rejectAdditionalFinding(
    workOrderId: string,
    dto: RejectAdditionalFindingDto,
    userId: string,
  ): Promise<AdditionalFindingResponseDto> {
    const context = await this.repository.findAdditionalFindingContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');
    if (context.status !== WorkOrderStatus.QUOTE_SENT) {
      throw new ConflictException('Work order is not awaiting an additional budget approval');
    }
    if (context.additionalFindings.length === 0) {
      throw new ConflictException('Work order has no additional finding awaiting a decision');
    }
    return this.repository.rejectAdditionalFinding(workOrderId, dto, userId);
  }
}