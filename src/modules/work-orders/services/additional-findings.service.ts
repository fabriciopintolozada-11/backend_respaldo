import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkOrderRepository } from '../repositories/work-order.repository';
import { CreateDiagnosticDto } from '../dto/create-diagnostic.dto';
import { ApproveAdditionalFindingDto } from '../dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from '../dto/reject-additional-finding.dto';
import { AdditionalFindingResponseDto } from '../dto/additional-finding.response.dto';
import { Prisma } from '../../../generated/prisma/client';
import { DEFAULT_LABOR_HOURLY_RATE } from '../../quotes/quotes.service';

@Injectable()
export class AdditionalFindingsService {
  constructor(
    private readonly repository: WorkOrderRepository,
    private readonly configService: ConfigService,
  ) {}

  async createDiagnostic(id: string, mechanicId: string, dto: CreateDiagnosticDto) {
    const order = await this.repository.findAssignedWorkOrder(id, mechanicId);
    if (!order) throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    if (!['RECIBIDO', 'ASIGNADA', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(order.status)) {
      throw new ConflictException('Work order cannot receive a diagnostic in its current state');
    }
    // RN-03: additional findings suspend repair until a new quote is approved.
    // The reportedBy comes from the authenticated mechanic (BE-19) and the
    // repository creates the AdditionalFinding annex for US-21 when the order
    // is suspended to PRESUPUESTO_ENVIADO.
    return this.repository.createDiagnostic(id, dto, order.status === 'EN_REPARACION' ? 'PRESUPUESTO_ENVIADO' : 'EN_DIAGNOSTICO', mechanicId);
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
    if (context.status !== 'PRESUPUESTO_ENVIADO') {
      throw new ConflictException('Work order is not awaiting an additional budget approval');
    }
    if (context.additionalFindings.length === 0) {
      throw new ConflictException('Work order has no additional finding awaiting a decision');
    }
    const laborHourlyRate = new Prisma.Decimal(
      this.configService.get<string>('LABOR_HOURLY_RATE') ?? DEFAULT_LABOR_HOURLY_RATE,
    );
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
    if (context.status !== 'PRESUPUESTO_ENVIADO') {
      throw new ConflictException('Work order is not awaiting an additional budget approval');
    }
    if (context.additionalFindings.length === 0) {
      throw new ConflictException('Work order has no additional finding awaiting a decision');
    }
    return this.repository.rejectAdditionalFinding(workOrderId, dto, userId);
  }
}