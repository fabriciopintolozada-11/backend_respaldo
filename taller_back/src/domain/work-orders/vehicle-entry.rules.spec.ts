import { UnprocessableEntityException } from '@nestjs/common';
import { normalizePlate, validateVehicleCanBeReceived } from './vehicle-entry.rules';

describe('Vehicle entry rules (US-01)', () => {
  it('normalizes plates for history lookup', () => {
    expect(normalizePlate(' abc-123 ')).toBe('ABC-123');
  });

  it('rejects fully electric vehicles (RN-18)', () => {
    expect(() => validateVehicleCanBeReceived(true)).toThrow(UnprocessableEntityException);
  });

  it('accepts combustion and hybrid vehicles', () => {
    expect(() => validateVehicleCanBeReceived(false)).not.toThrow();
  });
});
