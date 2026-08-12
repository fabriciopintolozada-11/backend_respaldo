import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersRepository } from './work-orders.repository';
import { RegisterVehicleEntryService } from './work-orders.service';

@Module({ controllers: [WorkOrdersController], providers: [WorkOrdersRepository, RegisterVehicleEntryService] })
export class WorkOrdersModule {}
