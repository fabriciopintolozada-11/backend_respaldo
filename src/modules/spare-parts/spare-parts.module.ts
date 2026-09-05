import { Module } from '@nestjs/common';
import { SparePartsController } from './spare-parts.controller';
import { SparePartsService } from './spare-parts.service';
import { SparePartRepository } from './repositories/spare-part.repository';
import { InventoryAlertsController } from './inventory-alerts.controller';

@Module({
  controllers: [SparePartsController, InventoryAlertsController],
  providers: [SparePartsService, SparePartRepository],
})
export class SparePartsModule {}
