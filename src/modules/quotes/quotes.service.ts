import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ApproveQuoteDto } from './dto/approve-quote.dto';
import { RejectQuoteDto } from './dto/reject-quote.dto';
import { QuoteDecisionResponseDto } from './dto/quote-decision-response.dto';
import { QuoteRepository } from './repositories/quote.repository';

@Injectable()
export class QuotesService {
  constructor(private readonly repository: QuoteRepository) {}

  async create(workOrderId: string, dto: CreateQuoteDto) {
    // RN-21: defense in depth. Financial inputs are validated again at the
    // domain layer even though the HTTP DTO already enforces @Min(0).
    const invalid = dto.items.find(
      (item) => item.quantity < 0 || item.unitPrice < 0,
    );
    if (invalid) {
      throw new UnprocessableEntityException(
        'Quote quantities and unit prices must be non-negative (RN-21)',
      );
    }
    const order = await this.repository.findOrderForQuote(workOrderId);
    if (!order) throw new ConflictException('Work order not found or has no diagnostic');
    if (order.status !== 'EN_DIAGNOSTICO') {
      throw new ConflictException('Work order must have a diagnostic pending quote');
    }
    return this.repository.create(workOrderId, dto);
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
