import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AssignWorkOrderDto, AssignWorkOrderResponseDto } from '../dto/assign-work-order.dto';
import { AssignWorkOrderService } from '../../application/services/assign-work-order.service';
import { WorkshopManagerGuard } from '../guards/workshop-manager.guard';

@Controller('ordenes')
@UseGuards(WorkshopManagerGuard)
export class AssignWorkOrderController {
  constructor(private readonly service: AssignWorkOrderService) {}

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  assign(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
    @Body() dto: AssignWorkOrderDto,
  ): Promise<AssignWorkOrderResponseDto> {
    return this.service.assign(id, dto);
  }
}
