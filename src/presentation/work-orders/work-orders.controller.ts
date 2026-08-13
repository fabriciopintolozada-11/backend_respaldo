import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ReceptionistGuard } from '../guards/receptionist.guard';
import { RegisterVehicleEntryDto } from '../dto/register-vehicle-entry.dto';
import { RegisterVehicleEntryService } from '../../application/services/work-orders.service';

@Controller()
@UseGuards(ReceptionistGuard)
export class WorkOrdersController {
  constructor(private readonly service: RegisterVehicleEntryService) {}
  @Get('vehicles/:plate/history') getHistory(@Param('plate') plate: string) { return this.service.getHistory(plate); }
  @Post('work-orders')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterVehicleEntryDto, @Req() request: Request) {
    return this.service.register(dto, request.user.id);
  }
}
