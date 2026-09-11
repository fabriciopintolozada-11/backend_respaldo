import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { VoidAdjustmentDto } from '../src/modules/work-orders/dto/void-adjustment.dto';

describe('VoidAdjustmentDto (US-20 / RN-15)', () => {
  const createDto = (data: Record<string, unknown>): VoidAdjustmentDto =>
    plainToInstance(VoidAdjustmentDto, data) as VoidAdjustmentDto;

  const VALID_UUID = 'b2c3d4e5-f6a7-4901-8cde-f12345678901';

  it('accepts a valid payload', async () => {
    const dto = createDto({ adjustmentId: VALID_UUID, reason: 'Error en el calculo del descuento original' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects a non-UUID adjustmentId', async () => {
    const dto = createDto({ adjustmentId: 'not-a-uuid', reason: 'Error en el calculo del descuento original' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'adjustmentId');
    expect(field).toBeDefined();
  });

  it('rejects missing adjustmentId', async () => {
    const dto = createDto({ reason: 'Error en el calculo del descuento original' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'adjustmentId');
    expect(field).toBeDefined();
  });

  it('rejects missing reason', async () => {
    const dto = createDto({ adjustmentId: VALID_UUID });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });

  it('rejects reason shorter than 10 characters', async () => {
    const dto = createDto({ adjustmentId: VALID_UUID, reason: 'Short' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });
});