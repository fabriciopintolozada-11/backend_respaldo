import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { VehiclesService } from './vehicles.service';
import { VehicleHistoryResponseDto } from './dto/vehicle-history.response.dto';

// BE-P02: vehicle domain module. The /vehicles/:plate/history route moved here
// from work-orders keeping the exact path, roles and contract so the frontend
// is untouched.
@ApiTags('vehicles')
@ApiBearerAuth()
@Controller()
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  // US-05 / BE-T05.3 + RN-19: previous delivered work orders of a vehicle with
  // their diagnosis, installed spare parts and immutable dates.
  @Get('vehicles/:plate/history')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get vehicle technical history with previous delivered work orders (US-01, US-05 / BE-T05.3, RN-19, RN-20)' })
  @ApiResponse({ status: 200, type: VehicleHistoryResponseDto })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  getHistory(@Param('plate') plate: string): Promise<VehicleHistoryResponseDto> {
    return this.service.getVehicleHistory(plate);
  }
}