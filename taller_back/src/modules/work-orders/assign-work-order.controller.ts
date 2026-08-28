import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AssignWorkOrderDto, AssignWorkOrderResponseDto } from './dto/assign-work-order.dto';
import { AssignWorkOrderService } from './assign-work-order.service';

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.WORKSHOP_LEAD)
export class AssignWorkOrderController {
  constructor(private readonly service: AssignWorkOrderService) {}

  @Post(':id/assign-mechanic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a work order to a mechanic (US-04, RN-14)' })
  @ApiResponse({ status: 200, type: AssignWorkOrderResponseDto })
  @ApiResponse({ status: 401, description: 'Se requiere autenticación' })
  @ApiResponse({ status: 403, description: 'Solo el jefe de taller puede asignar órdenes' })
  @ApiResponse({ status: 404, description: 'No se encontró la orden o el mecánico' })
  @ApiResponse({ status: 409, description: 'La orden o el mecánico no están disponibles para la asignación' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignWorkOrderDto): Promise<AssignWorkOrderResponseDto> {
    return this.service.assign(id, dto);
  }
}
