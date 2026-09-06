import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AssignWorkOrderDto, AssignWorkOrderResponseDto } from './dto/assign-work-order.dto';
import { AssignWorkOrderService } from './assign-work-order.service';

@ApiTags('work-orders')
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.WORKSHOP_LEAD)
export class AssignWorkOrderController {
  constructor(private readonly service: AssignWorkOrderService) {}

  @Post(':id/assign-mechanic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a work order to a mechanic (US-04, RN-14)' })
  @ApiResponse({ status: 200, type: AssignWorkOrderResponseDto })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignWorkOrderDto): Promise<AssignWorkOrderResponseDto> {
    return this.service.assign(id, dto);
  }
}
