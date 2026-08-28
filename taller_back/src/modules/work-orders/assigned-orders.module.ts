import { Module } from '@nestjs/common';
import { AssignedOrdersController } from './assigned-orders.controller';
import { AssignedOrdersService } from './assigned-orders.service';
import { MechanicOrdersRepository } from './repositories/mechanic-orders.repository';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { AssignWorkOrderController } from './assign-work-order.controller';
import { AssignWorkOrderService } from './assign-work-order.service';

// BE-02: work-orders module owns OTs and mechanic assignment (HU-03 flow).
@Module({
  controllers: [AssignedOrdersController, WorkOrdersController, AssignWorkOrderController],
  providers: [AssignedOrdersService, MechanicOrdersRepository, WorkOrdersService, WorkOrderRepository, AssignWorkOrderService],
})
export class AssignedOrdersModule {}
