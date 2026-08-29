import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AssignedOrdersService } from './assigned-orders.service';
import { AssignedWorkOrderDetailResponseDto } from './dto/assigned-work-order-detail.response.dto';
import { QueryAssignedWorkOrdersDto } from './dto/query-assigned-work-orders.dto';
import { ListAssignedWorkOrdersResponseDto } from './dto/list-assigned-work-orders.response.dto';
import { WorkOrderIdParamDto } from './dto/work-order-id-param.dto';

// BE-29: only the MECHANIC role can list their own assigned work orders
// (RN-04, RN-16). The mechanic id comes from the authenticated user (BE-19).
@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MECHANIC)
export class AssignedOrdersController {
  constructor(private readonly service: AssignedOrdersService) {}

  @Get('assigned')
  @ApiOperation({ summary: 'Listar las Órdenes de Trabajo asignadas al mecánico autenticado (HU-03, RN-04)' })
  @ApiResponse({ status: 200, description: 'Página de Órdenes de Trabajo asignadas', type: ListAssignedWorkOrdersResponseDto })
  @ApiResponse({ status: 400, description: 'Los parámetros de paginación son inválidos' })
  @ApiResponse({ status: 401, description: 'Se requiere autenticación' })
  @ApiResponse({ status: 403, description: 'El usuario no tiene rol de mecánico' })
  getAssigned(
    @Req() request: Request,
    @Query() query: QueryAssignedWorkOrdersDto,
  ): Promise<ListAssignedWorkOrdersResponseDto> {
    return this.service.getAssigned(request.user.id, query);
  }

  @Get('assigned/:id')
  @ApiOperation({ summary: 'Consultar el detalle técnico de una Orden de Trabajo asignada (HU-03, RN-16)' })
  @ApiResponse({ status: 200, description: 'Detalle técnico de la Orden de Trabajo sin importes monetarios', type: AssignedWorkOrderDetailResponseDto })
  @ApiResponse({ status: 400, description: 'El identificador de la Orden de Trabajo es inválido' })
  @ApiResponse({ status: 401, description: 'Se requiere autenticación' })
  @ApiResponse({ status: 403, description: 'El usuario no tiene rol de mecánico' })
  @ApiResponse({ status: 404, description: 'La Orden de Trabajo no está asignada a este mecánico' })
  getAssignedDetail(
    @Req() request: Request,
    @Param() params: WorkOrderIdParamDto,
  ): Promise<AssignedWorkOrderDetailResponseDto> {
    return this.service.getAssignedDetail(request.user.id, params.id);
  }
}
