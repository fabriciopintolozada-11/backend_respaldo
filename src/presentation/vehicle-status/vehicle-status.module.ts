import { Module } from '@nestjs/common';
import { VehicleStatusController } from './vehicle-status.controller';
import { VehicleStatusRepository } from '../../infraestructure/repositories/vehicle-status.repository';
import { QueryVehicleStatusService } from '../../application/services/vehicle-status.service';

@Module({ controllers: [VehicleStatusController], providers: [VehicleStatusRepository, QueryVehicleStatusService] })
export class VehicleStatusModule {}
