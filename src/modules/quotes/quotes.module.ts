import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { QuoteRepository } from './repositories/quote.repository';

@Module({ controllers: [QuotesController], providers: [QuotesService, QuoteRepository] })
export class QuotesModule {}
