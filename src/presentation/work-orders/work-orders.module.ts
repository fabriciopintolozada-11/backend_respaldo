import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersRepository } from '../../infraestructure/repositories/work-orders.repository';
import { RegisterVehicleEntryService } from '../../application/services/work-orders.service';

@Module({ controllers: [WorkOrdersController], providers: [WorkOrdersRepository, RegisterVehicleEntryService] })
export class WorkOrdersModule {}
