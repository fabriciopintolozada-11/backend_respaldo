import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { DeliverWorkOrderDto, PaymentMethod } from '../src/modules/work-orders/dto/deliver-work-order.dto';

describe('DeliverWorkOrderDto (US-20)', () => {
  const createDto = (data: Record<string, unknown>): DeliverWorkOrderDto =>
    plainToInstance(DeliverWorkOrderDto, data) as DeliverWorkOrderDto;

  it('accepts a valid payload with deliveryNotes', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.CASH, receiptNumber: 'F2026-00123', deliveryNotes: 'Delivered to the owner' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('accepts a valid payload without deliveryNotes', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.QR_TRANSFER, receiptNumber: 'F2026-00124' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('accepts every payment method of the enum', async () => {
    for (const method of [PaymentMethod.CASH, PaymentMethod.QR_TRANSFER, PaymentMethod.CARD]) {
      const dto = createDto({ paymentMethod: method, receiptNumber: 'F2026-00125' });
      const errors = await validate(dto);
      if (errors.length > 0) {
        const details = errors.map((e) => `${e.property}: ${JSON.stringify(e.constraints)}`);
        throw new Error(`Unexpected validation errors for ${method}: ${details.join(', ')}`);
      }
    }
  });

  it('rejects a missing paymentMethod', async () => {
    const dto = createDto({ receiptNumber: 'F2026-00126' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'paymentMethod');
    expect(field).toBeDefined();
  });

  it('rejects an unsupported paymentMethod', async () => {
    const dto = createDto({ paymentMethod: 'BITCOIN', receiptNumber: 'F2026-00127' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'paymentMethod');
    expect(field).toBeDefined();
  });

  it('rejects a missing receiptNumber', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.CASH });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'receiptNumber');
    expect(field).toBeDefined();
  });

  it('rejects an empty receiptNumber', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.CASH, receiptNumber: '' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'receiptNumber');
    expect(field).toBeDefined();
  });

  it('rejects a receiptNumber longer than 50 characters', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.CASH, receiptNumber: 'x'.repeat(51) });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'receiptNumber');
    expect(field).toBeDefined();
  });

  it('rejects a non-string deliveryNotes', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.CASH, receiptNumber: 'R-1', deliveryNotes: 42 });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'deliveryNotes');
    expect(field).toBeDefined();
  });

  it('rejects deliveryNotes longer than 500 characters', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.CASH, receiptNumber: 'R-1', deliveryNotes: 'x'.repeat(501) });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'deliveryNotes');
    expect(field).toBeDefined();
  });

  it('rejects a non-string receiptNumber', async () => {
    const dto = createDto({ paymentMethod: PaymentMethod.CASH, receiptNumber: 12345 });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'receiptNumber');
    expect(field).toBeDefined();
  });
});