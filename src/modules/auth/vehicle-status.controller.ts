import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryVehicleStatusDto } from './dto/query-vehicle-status.dto';
import { VehicleStatusResponseDto } from './dto/vehicle-status.response.dto';
import { VehicleStatusService } from './vehicle-status.service';

// BE-22 / RN-17: public endpoint, no authentication, plate + identification.
@ApiTags('public')
@Controller('public/vehicle-status')
export class VehicleStatusController {
  constructor(private readonly service: VehicleStatusService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get the current status of a vehicle without authentication (US-02, RN-17)' })
  @ApiResponse({ status: 200, type: VehicleStatusResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or missing query parameters' })
  @ApiResponse({ status: 404, description: 'No valid work order found' })
  query(@Query() dto: QueryVehicleStatusDto): Promise<VehicleStatusResponseDto> {
    return this.service.getStatus(dto.plate, dto.identification);
  }
}
