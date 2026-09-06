import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { SetAwaitingPartDto } from '../src/modules/work-orders/dto/set-awaiting-part.dto';

describe('SetAwaitingPartDto', () => {
  const VALID_UUID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

  const createDto = (data: Record<string, unknown>): SetAwaitingPartDto =>
    plainToInstance(SetAwaitingPartDto, data) as SetAwaitingPartDto;

  it('accepts a valid payload with all required fields', async () => {
    const dto = createDto({
      missingPartId: VALID_UUID,
      quantity: 2,
      reason: 'Part not found in warehouse shelf',
    });
    const errors = await validate(dto);
    if (errors.length > 0) {
      const details = errors.map((e) => `${e.property}: ${JSON.stringify(e.constraints)}`);
      throw new Error(`Unexpected validation errors: ${details.join(', ')}`);
    }
    expect(errors.length).toBe(0);
  });

  it('rejects missingPartId when it is not a valid UUID', async () => {
    const dto = createDto({
      missingPartId: 'not-a-uuid',
      quantity: 1,
      reason: 'Missing part',
    });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'missingPartId');
    expect(field).toBeDefined();
  });

  it('rejects missingPartId when empty', async () => {
    const dto = createDto({
      missingPartId: '',
      quantity: 1,
      reason: 'Missing part',
    });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'missingPartId');
    expect(field).toBeDefined();
  });

  it('rejects quantity when zero', async () => {
    const dto = createDto({
      missingPartId: VALID_UUID,
      quantity: 0,
      reason: 'Missing part',
    });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'quantity');
    expect(field).toBeDefined();
  });

  it('rejects quantity when negative', async () => {
    const dto = createDto({
      missingPartId: VALID_UUID,
      quantity: -3,
      reason: 'Missing part',
    });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'quantity');
    expect(field).toBeDefined();
  });

  it('rejects quantity when it is a decimal', async () => {
    const dto = createDto({
      missingPartId: VALID_UUID,
      quantity: 1.5,
      reason: 'Missing part',
    });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'quantity');
    expect(field).toBeDefined();
  });

  it('rejects reason when it is empty', async () => {
    const dto = createDto({
      missingPartId: VALID_UUID,
      quantity: 1,
      reason: '',
    });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });

  it('rejects reason when it contains only whitespace', async () => {
    const dto = createDto({
      missingPartId: VALID_UUID,
      quantity: 1,
      reason: '   ',
    });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });

  it('rejects missing fields entirely', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
