import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ListInventoryAlertsResponseDto } from './dto/list-inventory-alerts.response.dto';
import { QueryInventoryAlertsDto } from './dto/query-inventory-alerts.dto';
import { SparePartsService } from './spare-parts.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
export class InventoryAlertsController {
  constructor(private readonly service: SparePartsService) {}

  @Get('alerts')
  @ApiOperation({ summary: 'List inventory rotation and availability alerts (HU-08, RN-10)' })
  @ApiResponse({ status: 200, type: ListInventoryAlertsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid alert filters' })
  @ApiResponse({ status: 403, description: 'Only workshop leads and administrators can view alerts' })
  findAlerts(@Query() query: QueryInventoryAlertsDto): Promise<ListInventoryAlertsResponseDto> {
    return this.service.findAlerts(query);
  }
}
