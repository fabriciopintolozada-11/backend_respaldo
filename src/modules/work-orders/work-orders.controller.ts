import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from './dto/register-vehicle-entry.dto';
import { WorkOrdersService } from './work-orders.service';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';
import { DiagnosticResponseDto } from './dto/diagnostic-response.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { ListMechanicsResponseDto } from './dto/mechanic-list.response.dto';
import { ListWorkOrdersResponseDto } from './dto/work-order-list.response.dto';

@ApiTags('work-orders')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrdersController {
  constructor(private readonly service: WorkOrdersService) {}

  @Get('work-orders')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'List work orders available for mechanic assignment (US-04, RN-14)' })
  @ApiResponse({ status: 200, type: ListWorkOrdersResponseDto })
  getAvailable(@Query() query: QueryWorkOrdersDto): Promise<ListWorkOrdersResponseDto> {
    return this.service.getAvailableWorkOrders(query);
  }

  @Get('mechanics')
  @Roles(UserRole.WORKSHOP_LEAD)
  @ApiOperation({ summary: 'List active mechanics for work order assignment (US-04, RN-14)' })
  @ApiResponse({ status: 200, type: ListMechanicsResponseDto })
  getActiveMechanics(@Query() query: QueryWorkOrdersDto): Promise<ListMechanicsResponseDto> {
    return this.service.getActiveMechanics(query);
  }

  @Get('vehicles/:plate/history')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD)
  @ApiOperation({ summary: 'Get vehicle technical history (US-01, RN-20)' })
  @ApiResponse({ status: 200 })
  getHistory(@Param('plate') plate: string) { return this.service.getVehicleHistory(plate); }

  @Post('work-orders')
  @Roles(UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register vehicle entry and create work order (US-01, RN-01, RN-18)' })
  @ApiResponse({ status: 201, type: WorkOrderResponseDto })
  @ApiResponse({ status: 422, description: 'Electric vehicles are not accepted' })
  register(@Body() dto: RegisterVehicleEntryDto, @Req() request: Request): Promise<WorkOrderResponseDto> {
    return this.service.registerVehicleEntry(dto, request.user.id);
  }

  @Post('work-orders/:id/diagnostic')
  @Roles(UserRole.MECHANIC)
  @ApiOperation({ summary: 'Register technical diagnosis (US-11, RN-04, RN-16, RN-19)' })
  @ApiResponse({ status: 201, type: DiagnosticResponseDto })
  createDiagnostic(@Param('id') id: string, @Body() dto: CreateDiagnosticDto, @Req() request: Request): Promise<DiagnosticResponseDto> {
    return this.service.createDiagnostic(id, request.user.id, dto);
  }
}
