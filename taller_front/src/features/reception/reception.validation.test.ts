import { describe, expect, it } from 'vitest'
import { normalizePlate, PLATE_PATTERN, toRegisterRequest } from './reception.validation'

describe('reception validation and mapping', () => {
  it('normalizes plates using the same rule as the backend', () => {
    expect(normalizePlate('  ab-c123 ')).toBe('AB-C123')
    expect(PLATE_PATTERN.test(normalizePlate('ab-c123'))).toBe(true)
    expect(PLATE_PATTERN.test(normalizePlate('AB 123'))).toBe(false)
  })

  it('creates exactly the backend DTO and omits an empty optional phone', () => {
    expect(toRegisterRequest({
      plate: ' abc123 ',
      customerIdentification: ' 123456 ',
      customerName: ' Ana Pérez ',
      customerPhone: ' ',
      brand: ' Toyota ',
      model: ' Corolla ',
      year: '2022',
      isFullyElectric: false,
      initialComplaint: ' Ruido al frenar ',
    })).toEqual({
      plate: 'ABC123',
      customer: { identification: '123456', name: 'Ana Pérez' },
      vehicle: { brand: 'Toyota', model: 'Corolla', year: 2022, isFullyElectric: false },
      initialComplaint: 'Ruido al frenar',
    })
  })
})
