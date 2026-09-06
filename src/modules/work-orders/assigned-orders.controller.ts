import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AssignedOrdersService } from './assigned-orders.service';
import { QueryAssignedWorkOrdersDto } from './dto/query-assigned-work-orders.dto';
import { ListAssignedWorkOrdersResponseDto } from './dto/list-assigned-work-orders.response.dto';
import { AssignedWorkOrderDetailResponseDto } from './dto/assigned-work-order.response.dto';

// BE-29: only the MECHANIC role can list their own assigned work orders
// (RN-04, RN-16). The mechanic id comes from the authenticated user (BE-19).
@ApiTags('work-orders')
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MECHANIC)
export class AssignedOrdersController {
  constructor(private readonly service: AssignedOrdersService) {}

  @Get('assigned')
  @ApiOperation({ summary: 'Get the work orders assigned to the authenticated mechanic (US-03, RN-04)' })
  @ApiResponse({ status: 200, type: ListAssignedWorkOrdersResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication is required' })
  @ApiResponse({ status: 403, description: 'Mechanic role is required' })
  getAssigned(
    @Req() request: Request,
    @Query() query: QueryAssignedWorkOrdersDto,
  ): Promise<ListAssignedWorkOrdersResponseDto> {
    return this.service.getAssigned(request.user.id, query);
  }

  @Get('assigned/:id')
  @ApiOperation({ summary: 'Get an assigned work order technical detail (US-03, HU-07), including reserved spare parts' })
  @ApiResponse({ status: 200, type: AssignedWorkOrderDetailResponseDto })
  @ApiResponse({ status: 404, description: 'The work order is not assigned to this mechanic' })
  getAssignedDetail(@Req() request: Request, @Param('id', ParseUUIDPipe) id: string): Promise<AssignedWorkOrderDetailResponseDto> {
    return this.service.getAssignedDetail(request.user.id, id);
  }
}
