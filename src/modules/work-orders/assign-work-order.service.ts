import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignWorkOrderDto, AssignWorkOrderResponseDto } from './dto/assign-work-order.dto';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssignWorkOrderService {
  constructor(
    private readonly repository: WorkOrderRepository,
    private readonly prisma: PrismaService,
  ) {}

  async assign(id: string, dto: AssignWorkOrderDto): Promise<AssignWorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await this.repository.findWorkOrderForAssignment(transaction, id);
      if (!order) throw new NotFoundException('Work order not found');
      if (order.mechanicId || order.status !== 'RECIBIDO') {
        throw new ConflictException('Work order is not assignable');
      }

      const mechanic = await this.repository.findMechanicForAssignment(transaction, dto.mechanicId);
      if (!mechanic) throw new NotFoundException('Mechanic not found');
      if (!mechanic.isActive) throw new ConflictException('Mechanic cannot receive work orders');

      const assignedOrder = await this.repository.assignWorkOrder(transaction, id, dto.mechanicId);
      if (!assignedOrder) throw new ConflictException('Work order is not assignable');
      return { ...assignedOrder, mechanicId: assignedOrder.mechanicId as string };
    });
  }
}
