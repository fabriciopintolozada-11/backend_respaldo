import { Injectable } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteRepository } from './repositories/quote.repository';

@Injectable()
export class QuotesService {
  constructor(private readonly repository: QuoteRepository) {}

  create(workOrderId: string, dto: CreateQuoteDto) {
    return this.repository.create(workOrderId, dto);
  }
}
