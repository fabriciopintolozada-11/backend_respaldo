import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RegisterVehicleEntryDto } from '../dto/register-vehicle-entry.dto';
import { RegisterVehicleEntryService } from '../../application/services/work-orders.service';

@Controller()
@ApiTags('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RECEPTIONIST)
export class WorkOrdersController {
  constructor(private readonly service: RegisterVehicleEntryService) {}
  @Get('vehicles/:plate/history')
  @ApiOperation({ summary: 'Get vehicle technical history (US-01, RN-20)' })
  @ApiResponse({ status: 200 })
  getHistory(@Param('plate') plate: string) { return this.service.getHistory(plate); }
  @Post('work-orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register vehicle entry and create work order (US-01, RN-01, RN-18)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 422, description: 'Electric vehicles are not accepted' })
  register(@Body() dto: RegisterVehicleEntryDto, @Req() request: Request) {
    return this.service.register(dto, request.user.id);
  }
}
