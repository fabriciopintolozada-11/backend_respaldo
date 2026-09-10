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
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { CompleteWorkOrderResponseDto } from './dto/complete-work-order.response.dto';
import { DeliverWorkOrderDto } from './dto/deliver-work-order.dto';
import { DeliverWorkOrderResponseDto } from './dto/deliver-work-order.response.dto';
import { WorkOrderSettlementResponseDto } from './dto/work-order-settlement.response.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { ListWorkOrdersResponseDto } from './dto/work-order-list.response.dto';
import { ListMechanicsResponseDto } from './dto/mechanic-list.response.dto';
import { QueryTrackingWorkOrdersDto } from './dto/query-tracking-work-orders.dto';
import { WorkOrderTrackingResponseDto } from './dto/work-order-tracking.response.dto';
import { VehicleHistoryResponseDto } from './dto/vehicle-history.response.dto';

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

  // US-05 / BE-T05.1: reactive tracking summary filtered by plate, status or
  // bay for reception and the workshop lead. Declared before any ':id' route
  // so the literal path wins.
  @Get('work-orders/tracking-summary')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get work order tracking summary by plate, status or bay (US-05 / BE-T05.1, RN-20)' })
  @ApiResponse({ status: 200, type: [WorkOrderTrackingResponseDto] })
  getTrackingSummary(@Query() query: QueryTrackingWorkOrdersDto): Promise<WorkOrderTrackingResponseDto[]> {
    return this.service.getTrackingSummary(query);
  }

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

  // US-19: conclude a repair, set the work order to LISTO_ENTREGA and free its
  // physical bay. Only the assigned mechanic or the workshop lead can trigger
  // this transition (BE-T19.2, RN-04, RN-05, RN-14, RN-19).
  @Post('work-orders/:id/complete')
  @Roles(UserRole.MECHANIC, UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conclude a repair, set the work order to LISTO_ENTREGA and release its bay (US-19, RN-05, RN-14, RN-19)' })
  @ApiResponse({ status: 200, type: CompleteWorkOrderResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role or work order not assigned to this mechanic (RN-04)' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 409, description: 'Work order is not in EN_REPARACION status' })
  @ApiResponse({ status: 422, description: 'Work order is awaiting spare parts and cannot be concluded (RN-05)' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteWorkOrderDto,
    @Req() request: Request,
  ): Promise<CompleteWorkOrderResponseDto> {
    return this.service.complete(id, request.user.id, request.user.role, dto);
  }

  // US-20: consolidated settlement (RN-21) of a work order ready to be
  // delivered. Only RECEPTIONIST and ADMIN see the monetary values (BE-12).
  @Get('work-orders/:id/settlement')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the consolidated settlement in BOB for a ready work order (US-20, RN-21)' })
  @ApiResponse({ status: 200, type: WorkOrderSettlementResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 409, description: 'Work order is not in LISTO_ENTREGA status (RN-05)' })
  getSettlement(@Param('id', ParseUUIDPipe) id: string): Promise<WorkOrderSettlementResponseDto> {
    return this.service.getSettlement(id);
  }

  // US-20: settle the account and register the vehicle handover (RN-21,
  // RN-19). The total is always computed by the backend from the approved
  // quote; the client only provides payment data (BE-13).
  @Post('work-orders/:id/deliver')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register payment and deliver the vehicle (US-20, RN-21, RN-19)' })
  @ApiResponse({ status: 200, type: DeliverWorkOrderResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error in the request body' })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 409, description: 'Work order is not in LISTO_ENTREGA or already delivered' })
  deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliverWorkOrderDto,
    @Req() request: Request,
  ): Promise<DeliverWorkOrderResponseDto> {
    return this.service.deliver(id, request.user.id, dto);
  }
}
