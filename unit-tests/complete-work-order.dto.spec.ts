import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CompleteWorkOrderDto } from '../src/modules/work-orders/dto/complete-work-order.dto';

describe('CompleteWorkOrderDto (US-19)', () => {
  const createDto = (data: Record<string, unknown>): CompleteWorkOrderDto =>
    plainToInstance(CompleteWorkOrderDto, data) as CompleteWorkOrderDto;

  it('accepts an empty payload (all fields optional)', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('accepts a valid payload with finalMileage and closingNotes', async () => {
    const dto = createDto({ finalMileage: 125400, closingNotes: 'Radiator replaced and road-tested' });
    const errors = await validate(dto);
    if (errors.length > 0) {
      const details = errors.map((e) => `${e.property}: ${JSON.stringify(e.constraints)}`);
      throw new Error(`Unexpected validation errors: ${details.join(', ')}`);
    }
    expect(errors.length).toBe(0);
  });

  it('accepts finalMileage equal to zero', async () => {
    const dto = createDto({ finalMileage: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects a negative finalMileage', async () => {
    const dto = createDto({ finalMileage: -10 });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'finalMileage');
    expect(field).toBeDefined();
  });

  it('rejects a decimal finalMileage', async () => {
    const dto = createDto({ finalMileage: 10.5 });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'finalMileage');
    expect(field).toBeDefined();
  });

  it('rejects a non-numeric finalMileage', async () => {
    const dto = createDto({ finalMileage: 'one-hundred' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'finalMileage');
    expect(field).toBeDefined();
  });

  it('rejects a finalMileage above the allowed maximum', async () => {
    const dto = createDto({ finalMileage: 1000001 });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'finalMileage');
    expect(field).toBeDefined();
  });

  it('rejects a non-string closingNotes', async () => {
    const dto = createDto({ closingNotes: 42 });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'closingNotes');
    expect(field).toBeDefined();
  });

  it('rejects closingNotes longer than 1000 characters', async () => {
    const dto = createDto({ closingNotes: 'x'.repeat(1001) });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'closingNotes');
    expect(field).toBeDefined();
  });
});