import { ConflictException, Injectable } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteRepository } from './repositories/quote.repository';

@Injectable()
export class QuotesService {
  constructor(private readonly repository: QuoteRepository) {}

  create(workOrderId: string, dto: CreateQuoteDto) {
    if (dto.laborItems.length === 0 && dto.partItems.length === 0) throw new ConflictException('A quote must contain labor or spare parts');
    return this.repository.create(workOrderId, dto);
  }
}
