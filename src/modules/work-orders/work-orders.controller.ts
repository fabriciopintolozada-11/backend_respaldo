import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { PendingQuoteWorkOrderResponseDto } from './dto/pending-quote-work-order.response.dto';
import { ConsumeSparePartDto } from './dto/consume-spare-part.dto';
import { WorkOrderPartResponseDto } from './dto/work-order-part.response.dto';
import { SetAwaitingPartDto } from './dto/set-awaiting-part.dto';
import { AwaitingPartResponseDto } from './dto/awaiting-part-response.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { ListWorkOrdersResponseDto } from './dto/work-order-list.response.dto';
import { ListMechanicsResponseDto } from './dto/mechanic-list.response.dto';

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

  // HU-12: list work orders in EN_DIAGNOSTICO ready to be quoted. Declared
  // before any ':id' route so the literal path wins.
  @Get('work-orders/pending-quote')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'List work orders ready to be quoted (HU-12)' })
  @ApiResponse({ status: 200, type: [PendingQuoteWorkOrderResponseDto] })
  listPendingQuoteOrders(): Promise<PendingQuoteWorkOrderResponseDto[]> {
    return this.service.getPendingQuoteOrders();
  }

  // HU-12: the advisor reads the diagnostic of a work order before quoting.
  @Get('work-orders/:id/diagnostic')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the diagnostic for a work order (HU-12)' })
  @ApiResponse({ status: 200, type: DiagnosticResponseDto })
  @ApiResponse({ status: 404, description: 'Work order or diagnostic not found' })
  getDiagnostic(@Param('id', ParseUUIDPipe) id: string): Promise<DiagnosticResponseDto> {
    return this.service.getDiagnostic(id);
  }

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

  @Post('work-orders/:id/consume-part')
  @Roles(UserRole.MECHANIC, UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm spare part installation, decrement physical stock and record kardex (HU-07, RN-04, RN-07, RN-08, RN-09, RN-01)' })
  @ApiResponse({ status: 200, type: WorkOrderPartResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 422, description: 'Work order state, ownership, reserved part or stock rules violated' })
  consumePart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsumeSparePartDto,
    @Req() request: Request,
  ): Promise<WorkOrderPartResponseDto> {
    return this.service.consumePart(id, request.user.id, request.user.role, dto);
  }

  // US-13 / RN-05: set a work order to EN_ESPERA_DE_REPUESTO when a spare
  // part is physically unavailable. Only the assigned mechanic or the
  // workshop lead can trigger this transition.
  @Post('work-orders/:id/awaiting-part')
  @Roles(UserRole.MECHANIC, UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set work order to awaiting part (US-13, RN-05, RN-04, RN-19)' })
  @ApiResponse({ status: 200, type: AwaitingPartResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 409, description: 'Work order is not in EN_REPARACION status (RN-05)' })
  @ApiResponse({ status: 422, description: 'Work order not assigned to this mechanic or spare part not associated' })
  setAwaitingPart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAwaitingPartDto,
    @Req() request: Request,
  ): Promise<AwaitingPartResponseDto> {
    return this.service.setAwaitingPart(id, request.user.id, request.user.role, dto);
  }
}
