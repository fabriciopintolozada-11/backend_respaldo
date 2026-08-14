import { Module } from '@nestjs/common';
import { AssignedOrdersController } from './assigned-orders.controller';
import { MechanicOrdersRepository } from '../../infraestructure/repositories/mechanic-orders.repository';
import { GetAssignedWorkOrdersService } from '../../application/services/mechanic-orders.service';

@Module({ controllers: [AssignedOrdersController], providers: [MechanicOrdersRepository, GetAssignedWorkOrdersService] })
export class AssignedOrdersModule {}
