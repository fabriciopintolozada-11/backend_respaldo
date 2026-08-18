import { Controller, Get, Query } from '@nestjs/common';
import { QueryVehicleStatusDto } from '../dto/query-vehicle-status.dto';
import { QueryVehicleStatusService } from '../../application/services/vehicle-status.service';

@Controller()
export class VehicleStatusController {
  constructor(private readonly service: QueryVehicleStatusService) {}

  @Get('vehicle-status')
  query(@Query() dto: QueryVehicleStatusDto) {
    return this.service.getStatus(dto.plate, dto.identification);
  }
}
