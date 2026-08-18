import { Module } from '@nestjs/common';
import { AssignedOrdersController } from './assigned-orders.controller';
import { AssignedOrdersService } from './assigned-orders.service';
import { MechanicOrdersRepository } from './repositories/mechanic-orders.repository';

// BE-02: work-orders module owns OTs and mechanic assignment (HU-03 flow).
// The legacy HU-01 module under presentation/ will merge here in its own
// refactor.
@Module({
  controllers: [AssignedOrdersController],
  providers: [AssignedOrdersService, MechanicOrdersRepository],
})
export class AssignedOrdersModule {}
