import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ApproveQuoteDto } from './dto/approve-quote.dto';
import { RejectQuoteDto } from './dto/reject-quote.dto';
import { QuoteDecisionResponseDto } from './dto/quote-decision-response.dto';
import { ListQuoteApprovalResponseDto, QuoteApprovalDetailResponseDto } from './dto/quote-approval-query-response.dto';
import { QueryQuoteApprovalsDto } from './dto/query-quote-approvals.dto';
import { QuoteRepository } from './repositories/quote.repository';

// BE-12.5 (HU-12): the official hourly labor rate used to price labor items is
// read from configuration, never from the frontend.
export const DEFAULT_LABOR_HOURLY_RATE = '65';

@Injectable()
export class QuotesService {
  constructor(
    private readonly repository: QuoteRepository,
    private readonly configService: ConfigService,
  ) {}

  async listApprovalQuotes(query: QueryQuoteApprovalsDto): Promise<ListQuoteApprovalResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [rows, total] = await Promise.all([
      this.repository.findApprovalPage(page, pageSize),
      this.repository.countApprovalQuotes(),
    ]);

    return {
      data: rows.map((row) => ({
        orderId: row.workOrderId,
        orderCode: row.orderCode,
        vehiclePlate: row.vehiclePlate,
        vehicleDescription: `${row.vehicleBrand} ${row.vehicleModel} (${row.vehicleYear})`,
        clientName: row.clientName,
        status: row.status,
        totalBOB: row.total,
        isFullyElectric: row.isFullyElectric,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getApprovalDetail(workOrderId: string): Promise<QuoteApprovalDetailResponseDto> {
    const detail = await this.repository.findApprovalDetail(workOrderId);
    if (!detail) throw new NotFoundException('Quote not found');
    return detail;
  }

  async create(workOrderId: string, dto: CreateQuoteDto) {
    // RN-21: defense in depth. Financial inputs are validated again at the
    // domain layer even though the HTTP DTO already enforces @Min(0).
    const invalid = dto.items.find(
      (item) => item.quantity < 0 || (item.unitPrice !== undefined && item.unitPrice < 0),
    );
    if (invalid) {
      throw new UnprocessableEntityException(
        'Quote quantities and unit prices must be non-negative (RN-21)',
      );
    }
    const order = await this.repository.findOrderForQuote(workOrderId);
    if (!order) throw new ConflictException('Work order not found or has no diagnostic');
    // HU-21 / BE-E06: a quote may be emitted for the first time from
    // EN_DIAGNOSTICO or re-emitted (append-only, superseding the previous
    // lines) while the previous budget is PRESUPUESTO_ENVIADO or RECHAZADO.
    if (!['EN_DIAGNOSTICO', 'PRESUPUESTO_ENVIADO', 'RECHAZADO'].includes(order.status)) {
      throw new ConflictException('Work order state does not allow generating or re-emitting the quote');
    }
    const laborHourlyRate = new Prisma.Decimal(
      this.configService.get<string>('LABOR_HOURLY_RATE') ?? DEFAULT_LABOR_HOURLY_RATE,
    );
    return this.repository.create(workOrderId, dto, laborHourlyRate);
  }

  async approve(workOrderId: string, dto: ApproveQuoteDto, recordedBy: string): Promise<QuoteDecisionResponseDto> {
    const context = await this.repository.findDecisionContext(workOrderId);
    if (!context) throw new NotFoundException('Quote not found');
    if (context.workOrder.status !== 'PRESUPUESTO_ENVIADO') throw new ConflictException('Quote is not awaiting a decision');
    return this.repository.approve(workOrderId, dto, recordedBy);
  }

  async reject(workOrderId: string, dto: RejectQuoteDto, recordedBy: string): Promise<QuoteDecisionResponseDto> {
    const context = await this.repository.findDecisionContext(workOrderId);
    if (!context) throw new NotFoundException('Quote not found');
    if (context.workOrder.status !== 'PRESUPUESTO_ENVIADO') throw new ConflictException('Quote is not awaiting a decision');
    return this.repository.reject(workOrderId, dto, recordedBy);
  }
}