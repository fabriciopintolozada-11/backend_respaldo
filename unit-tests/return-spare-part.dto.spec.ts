import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReturnSparePartDto } from '../src/modules/work-orders/dto/return-spare-part.dto';

describe('ReturnSparePartDto validation (HU-07 / BE-E03, BE-10)', () => {
  it.each([
    [{ sparePartId: 'not-a-uuid', quantity: 1 }, 'sparePartId'],
    [{ sparePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 0 }, 'quantity'],
    [{ sparePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: -1 }, 'quantity'],
    [{ sparePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 1.5 }, 'quantity'],
    [{ sparePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 1, notes: 123 }, 'notes'],
    [{ sparePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 1, notes: 'x'.repeat(501) }, 'notes'],
  ])('rejects invalid payload %j (field: %s)', async (payload, field) => {
    const dto = plainToInstance(ReturnSparePartDto, payload);
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain(field);
  });

  it('accepts a valid payload with sparePartId and quantity', async () => {
    const dto = plainToInstance(ReturnSparePartDto, {
      sparePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      quantity: 2,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional notes field', async () => {
    const dto = plainToInstance(ReturnSparePartDto, {
      sparePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      quantity: 1,
      notes: 'Pieza incorrecta para este vehículo',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when sparePartId is missing (required field, BE-E03)', async () => {
    const dto = plainToInstance(ReturnSparePartDto, { quantity: 1 });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('sparePartId');
  });
});