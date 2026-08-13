import { ForbiddenException } from '@nestjs/common';

export function validateMechanicCanViewOwnOrders(mechanicId: string, authenticatedId: string): void {
  if (mechanicId !== authenticatedId) {
    throw new ForbiddenException('Mechanics can only view their own assigned work orders');
  }
}
