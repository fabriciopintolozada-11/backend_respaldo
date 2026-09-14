import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SettlementsService } from './settlements.service';
import { WorkOrderSettlementResponseDto } from './dto/work-order-settlement.response.dto';
import { DeliverWorkOrderDto } from './dto/deliver-work-order.dto';
import { DeliverWorkOrderResponseDto } from './dto/deliver-work-order.response.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { VoidAdjustmentDto } from './dto/void-adjustment.dto';
import { SettlementAdjustmentResponseDto } from './dto/settlement-adjustment.response.dto';

// BE-P02: settlements module owns the US-20 flows. The routes moved here from
// work-orders with identical paths, roles and contract so the frontend is
// untouched.
@ApiTags('settlements')
@ApiBearerAuth()
@Controller()
export class SettlementsController {
  constructor(private readonly service: SettlementsService) {}

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