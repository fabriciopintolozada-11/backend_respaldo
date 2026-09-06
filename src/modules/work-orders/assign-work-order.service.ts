import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AssignWorkOrderDto, AssignWorkOrderResponseDto } from './dto/assign-work-order.dto';
import { WorkOrderRepository } from './repositories/work-order.repository';

@Injectable()
export class AssignWorkOrderService {
  constructor(private readonly repository: WorkOrderRepository) {}

  async assign(id: string, dto: AssignWorkOrderDto): Promise<AssignWorkOrderResponseDto> {
    try { return await this.repository.assign(id, dto.mechanicId); }
    catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ConflictException) throw error;
      throw new UnprocessableEntityException((error as Error).message);
    }
  }
}
