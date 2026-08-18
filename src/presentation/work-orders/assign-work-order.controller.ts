import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssignWorkOrderDto, AssignWorkOrderResponseDto } from '../dto/assign-work-order.dto';
import { AssignWorkOrderService } from '../../application/services/assign-work-order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('work-orders')
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.WORKSHOP_LEAD)
export class AssignWorkOrderController {
  constructor(private readonly service: AssignWorkOrderService) {}

  @Patch(':id/assign-mechanic')
  @ApiOperation({ summary: 'Assign a work order to a mechanic (US-04, RN-14)' })
  @ApiResponse({ status: 200, type: AssignWorkOrderResponseDto })
  @ApiResponse({ status: 403, description: 'Workshop lead role is required' })
  @HttpCode(HttpStatus.OK)
  assign(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
    @Body() dto: AssignWorkOrderDto,
  ): Promise<AssignWorkOrderResponseDto> {
    return this.service.assign(id, dto);
  }
}
