import { Injectable } from '@nestjs/common';
import { MechanicOrdersRepository } from '../../infraestructure/repositories/mechanic-orders.repository';
import { validateMechanicCanViewOwnOrders } from '../../domain/work-orders/mechanic-order.rules';

@Injectable()
export class GetAssignedWorkOrdersService {
  constructor(private readonly repository: MechanicOrdersRepository) {}
  async getAssigned(mechanicId: string, authenticatedId: string) {
    validateMechanicCanViewOwnOrders(mechanicId, authenticatedId);
    return this.repository.findAssignedByMechanic(mechanicId);
  }
}
