import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from './dto/register-vehicle-entry.dto';
import { VehicleHistoryResponseDto } from './dto/vehicle-history.response.dto';
import { VehiclePlateParamDto } from './dto/vehicle-plate-param.dto';
import { WorkOrdersService } from './work-orders.service';

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RECEPTIONIST)
export class WorkOrdersController {
  constructor(private readonly service: WorkOrdersService) {}

  @Get('vehicles/:plate/history')
  @ApiOperation({ summary: 'Consultar el historial técnico del vehículo (US-01, RN-20)' })
  @ApiResponse({ status: 200, description: 'Historial técnico del vehículo', type: VehicleHistoryResponseDto })
  @ApiResponse({ status: 400, description: 'La placa tiene un formato inválido' })
  @ApiResponse({ status: 401, description: 'Se requiere autenticación' })
  @ApiResponse({ status: 403, description: 'El usuario no tiene rol de recepcionista' })
  @ApiResponse({ status: 404, description: 'No se encontró el vehículo' })
  getHistory(@Param() params: VehiclePlateParamDto): Promise<VehicleHistoryResponseDto> {
    return this.service.getVehicleHistory(params.plate);
  }

  @Post('work-orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar el ingreso del vehículo y crear la Orden de Trabajo (US-01, RN-01, RN-18)' })
  @ApiResponse({ status: 201, description: 'Cliente, vehículo y Orden de Trabajo registrados correctamente', type: WorkOrderResponseDto })
  @ApiResponse({ status: 400, description: 'Los datos de entrada son inválidos' })
  @ApiResponse({ status: 401, description: 'Se requiere autenticación' })
  @ApiResponse({ status: 403, description: 'El usuario no tiene rol de recepcionista' })
  @ApiResponse({ status: 409, description: 'La placa ya se encuentra registrada a nombre de otro cliente' })
  @ApiResponse({ status: 422, description: 'Los vehículos 100% eléctricos no son aceptados' })
  register(@Body() dto: RegisterVehicleEntryDto, @Req() request: Request): Promise<WorkOrderResponseDto> {
    return this.service.registerVehicleEntry(dto, request.user.id);
  }
}
