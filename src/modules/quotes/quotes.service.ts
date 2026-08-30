import { ConflictException, Injectable } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteRepository } from './repositories/quote.repository';

@Injectable()
export class QuotesService {
  constructor(private readonly repository: QuoteRepository) {}

  async create(workOrderId: string, dto: CreateQuoteDto) {
    const order = await this.repository.findOrderForQuote(workOrderId);
    if (!order) throw new ConflictException('Work order not found or has no diagnostic');
    if (order.status !== 'EN_DIAGNOSTICO') {
      throw new ConflictException('Work order must have a diagnostic pending quote');
    }
    return this.repository.create(workOrderId, dto);
  }
}
