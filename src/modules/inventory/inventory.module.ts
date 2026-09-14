import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';
import { InventoryAlertsController } from './inventory-alerts.controller';

// BE-P02: inventory module (renamed from spare-parts). Owns spare part
// catalog, stock movement/adjustment and rotation/availability alerts. The
// HTTP routes keep the legacy /spare-parts and /inventory prefixes so the
// frontend contract is untouched.
@Module({
  controllers: [InventoryController, InventoryAlertsController],
  providers: [InventoryService, InventoryRepository],
})
export class InventoryModule {}