import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignWorkOrderDto, AssignWorkOrderResponseDto } from '../../presentation/dto/assign-work-order.dto';
import {
  MechanicNotFoundError,
  MechanicUnavailableError,
  WorkOrderAlreadyAssignedError,
  WorkOrderNotFoundError,
  WorkOrderNotAssignableError,
  WorkOrdersRepository,
} from '../../infraestructure/repositories/work-orders.repository';

@Injectable()
export class AssignWorkOrderService {
  constructor(private readonly repository: WorkOrdersRepository) {}

  async assign(workOrderId: string, dto: AssignWorkOrderDto): Promise<AssignWorkOrderResponseDto> {
    try {
      return await this.repository.assign(workOrderId, dto.mecanicoId);
    } catch (error) {
      if (error instanceof WorkOrderNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof WorkOrderNotAssignableError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof MechanicNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof WorkOrderAlreadyAssignedError || error instanceof MechanicUnavailableError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
