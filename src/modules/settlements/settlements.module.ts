import { Module } from '@nestjs/common';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementRepository } from './repositories/settlement.repository';

// BE-P02: settlements module owns the US-20 settlement, delivery and
// discount flows (RN-15, RN-21, RN-19).
@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementRepository],
})
export class SettlementsModule {}