import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { MechanicGuard } from '../guards/mechanic.guard';
import { GetAssignedWorkOrdersService } from '../../application/services/mechanic-orders.service';

@Controller()
@UseGuards(MechanicGuard)
export class AssignedOrdersController {
  constructor(private readonly service: GetAssignedWorkOrdersService) {}
  @Get('ordenes/mecanico/:id')
  getAssignedOrders(@Param('id') id: string, @Req() request: Request) {
    return this.service.getAssigned(id, request.user.id);
  }
}
