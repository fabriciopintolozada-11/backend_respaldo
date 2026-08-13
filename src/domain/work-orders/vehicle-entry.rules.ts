import { ConflictException } from '@nestjs/common';

export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

export function validateVehicleCanBeReceived(isFullyElectric: boolean): void {
  if (isFullyElectric) {
    throw new ConflictException('Fully electric vehicles are not accepted');
  }
}
