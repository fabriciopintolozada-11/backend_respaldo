import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
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

@ApiTags('work-orders')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RECEPTIONIST)
export class WorkOrdersController {
  constructor(private readonly service: WorkOrdersService) {}

  @Get('vehicles/:plate/history')
  @ApiOperation({ summary: 'Get vehicle technical history (US-01, RN-20)' })
  @ApiResponse({ status: 200 })
  getHistory(@Param('plate') plate: string) { return this.service.getVehicleHistory(plate); }

  @Post('work-orders')
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
