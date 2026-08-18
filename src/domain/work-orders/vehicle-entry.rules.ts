import { UnprocessableEntityException } from '@nestjs/common';

export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

export function validateVehicleCanBeReceived(isFullyElectric: boolean): void {
  if (isFullyElectric) {
    // RN-18: 100% electric vehicles cannot be received by this workshop.
    throw new UnprocessableEntityException('Fully electric vehicles are not accepted');
  }
}
