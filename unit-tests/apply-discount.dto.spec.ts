import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ApplyDiscountDto } from '../src/modules/work-orders/dto/apply-discount.dto';

describe('ApplyDiscountDto (US-20 / RN-15)', () => {
  const createDto = (data: Record<string, unknown>): ApplyDiscountDto =>
    plainToInstance(ApplyDiscountDto, data) as ApplyDiscountDto;

  it('accepts a valid payload', async () => {
    const dto = createDto({ amount: 50.0, reason: 'Descuento por demora en entrega del vehiculo' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('accepts the minimum valid amount (0.01)', async () => {
    const dto = createDto({ amount: 0.01, reason: 'Descuento minimo autorizado por el jefe' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('accepts the maximum valid amount (999999.99)', async () => {
    const dto = createDto({ amount: 999999.99, reason: 'Descuento de prueba con monto maximo permitido' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects amount of zero', async () => {
    const dto = createDto({ amount: 0, reason: 'Descuento invalido con monto cero' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'amount');
    expect(field).toBeDefined();
  });

  it('rejects negative amount', async () => {
    const dto = createDto({ amount: -50, reason: 'Descuento invalido con monto negativo' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'amount');
    expect(field).toBeDefined();
  });

  it('rejects amount exceeding maximum', async () => {
    const dto = createDto({ amount: 1000000, reason: 'Descuento con monto que excede el limite maximo' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'amount');
    expect(field).toBeDefined();
  });

  it('rejects missing reason', async () => {
    const dto = createDto({ amount: 50 });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });

  it('rejects reason shorter than 10 characters', async () => {
    const dto = createDto({ amount: 50, reason: 'Short' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });

  it('rejects reason longer than 500 characters', async () => {
    const dto = createDto({ amount: 50, reason: 'x'.repeat(501) });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });

  it('rejects reason with only whitespace', async () => {
    const dto = createDto({ amount: 50, reason: '           ' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'reason');
    expect(field).toBeDefined();
  });
});