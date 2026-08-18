import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { AssignWorkOrderController } from './assign-work-order.controller';
import { WorkOrdersRepository } from '../../infraestructure/repositories/work-orders.repository';
import { RegisterVehicleEntryService } from '../../application/services/work-orders.service';
import { AssignWorkOrderService } from '../../application/services/assign-work-order.service';

@Module({
  controllers: [WorkOrdersController, AssignWorkOrderController],
  providers: [WorkOrdersRepository, RegisterVehicleEntryService, AssignWorkOrderService],
})
export class WorkOrdersModule {}
