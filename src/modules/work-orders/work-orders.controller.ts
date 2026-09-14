import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from './dto/register-vehicle-entry.dto';
import { WorkOrdersService } from './work-orders.service';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';
import { DiagnosticResponseDto } from './dto/diagnostic-response.dto';
import { PendingQuoteWorkOrderResponseDto } from './dto/pending-quote-work-order.response.dto';
import { ConsumeSparePartDto } from './dto/consume-spare-part.dto';
import { ReturnSparePartDto } from './dto/return-spare-part.dto';
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
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { VoidAdjustmentDto } from './dto/void-adjustment.dto';
import { SettlementAdjustmentResponseDto } from './dto/settlement-adjustment.response.dto';
import { ApproveAdditionalFindingDto } from './dto/approve-additional-finding.dto';
import { RejectAdditionalFindingDto } from './dto/reject-additional-finding.dto';
import { AdditionalFindingResponseDto } from './dto/additional-finding.response.dto';

@ApiTags('work-orders')
@Controller()
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

  // US-21 (BE-T21.2 / HU-09): approve the additional quote of an unforeseen
  // finding reported during repair (RN-03). The suggested parts are reserved
  // (RN-07) and the order resumes EN_REPARACION. Only RECEPTIONIST and
  // WORKSHOP_LEAD may decide (BE-T21.2).
  @Post('work-orders/:id/additional-findings/approve')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve the additional budget of an unforeseen finding and resume the repair (US-21, RN-03, RN-07, RN-19)' })
  @ApiResponse({ status: 200, type: AdditionalFindingResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 409, description: 'Work order is not awaiting an additional budget approval or already decided' })
  @ApiResponse({ status: 422, description: 'Insufficient available stock for a suggested spare part (RN-07)' })
  approveAdditionalFinding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveAdditionalFindingDto,
    @Req() request: Request,
  ): Promise<AdditionalFindingResponseDto> {
    return this.service.approveAdditionalFinding(id, dto, request.user.id);
  }

  // US-21 (BE-T21.2 / RN-19): reject the additional quote. The finding is
  // archived permanently as "Daño no reparado por decisión del cliente" and
  // the order resumes EN_REPARACION to finish only the originally approved
  // work. Only RECEPTIONIST and WORKSHOP_LEAD may decide (BE-T21.2).
  @Post('work-orders/:id/additional-findings/reject')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject the additional budget and archive the damage as not repaired (US-21, RN-19)' })
  @ApiResponse({ status: 200, type: AdditionalFindingResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 409, description: 'Work order is not awaiting an additional budget approval or already decided' })
  rejectAdditionalFinding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectAdditionalFindingDto,
    @Req() request: Request,
  ): Promise<AdditionalFindingResponseDto> {
    return this.service.rejectAdditionalFinding(id, dto, request.user.id);
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

  // HU-07 / BE-E03: physically return a consumed spare part and restore the
  // discounted stock. Only the assigned mechanic or the workshop lead can do it
  // (RN-04); the quantity is bounded by the net consumed units (RN-01).
  @Post('work-orders/:id/return-part')
  @Roles(UserRole.MECHANIC, UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return a consumed spare part and restore the physical stock (HU-07, BE-E03, RN-04, RN-01, RN-08, RN-19)' })
  @ApiResponse({ status: 200, type: WorkOrderPartResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Work order or spare part not found' })
  @ApiResponse({ status: 409, description: 'Work order is not in EN_REPARACION status' })
  @ApiResponse({ status: 422, description: 'Mechanic ownership, part association or net consumed quantity rules violated' })
  returnPart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnSparePartDto,
    @Req() request: Request,
  ): Promise<WorkOrderPartResponseDto> {
    return this.service.returnPart(id, request.user.id, request.user.role, dto);
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
  // delivered. Only RECEPTIONIST, ADMIN and WORKSHOP_LEAD see the monetary
  // values (BE-12). WORKSHOP_LEAD needs it to apply discounts (RN-15).
  @Get('work-orders/:id/settlement')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN, UserRole.WORKSHOP_LEAD)
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

  // US-20 / RN-15: apply a discount to the settlement. Only WORKSHOP_LEAD
  // may perform this operation (RN-15). The total is always computed by the
  // backend; the client only sends the discount amount and reason (BE-13).
  @Post('work-orders/:id/settlement/apply-discount')
  @Roles(UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a discount to the settlement (US-20, RN-15)' })
  @ApiResponse({ status: 200, type: SettlementAdjustmentResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation (RN-15)' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  @ApiResponse({ status: 409, description: 'Work order is not in LISTO_ENTREGA or already delivered' })
  @ApiResponse({ status: 422, description: 'Discount amount exceeds the available total (RN-15)' })
  applyDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyDiscountDto,
    @Req() request: Request,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.service.applyDiscount(id, request.user.id, dto);
  }

  // US-20 / RN-15: void (reverse) a previously applied discount on the
  // settlement. Only WORKSHOP_LEAD may perform this operation (RN-15).
  @Post('work-orders/:id/settlement/void-adjustment')
  @Roles(UserRole.WORKSHOP_LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a previously applied discount (US-20, RN-15)' })
  @ApiResponse({ status: 200, type: SettlementAdjustmentResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation (RN-15)' })
  @ApiResponse({ status: 404, description: 'Work order or adjustment not found' })
  @ApiResponse({ status: 409, description: 'Work order is not in LISTO_ENTREGA, already delivered, or adjustment already voided' })
  voidAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidAdjustmentDto,
    @Req() request: Request,
  ): Promise<SettlementAdjustmentResponseDto> {
    return this.service.voidAdjustment(id, request.user.id, dto);
  }
}
