import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuoteDto, QuoteItemType } from './create-quote.dto';

const validItem = { description: 'Cambio', itemType: QuoteItemType.LABOR, quantity: 2, unitPrice: 10.5 };

describe('CreateQuoteDto', () => {
  it.each([
    ['invalid itemType', { ...validItem, itemType: 'INVALID' }],
    ['missing itemType', { ...validItem, itemType: undefined }],
    ['missing description', { ...validItem, description: undefined }],
    ['negative quantity', { ...validItem, quantity: -1 }],
    ['negative unit price', { ...validItem, unitPrice: -1 }],
  ])('rejects %s', async (_name, item) => {
    const dto = plainToInstance(CreateQuoteDto, { items: [item] });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects an empty payload and the old type field', async () => {
    expect(await validate(plainToInstance(CreateQuoteDto, { items: [] }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(CreateQuoteDto, { items: [{ ...validItem, type: 'LABOR' }] }), { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
  });

  it('accepts labor and part items', async () => {
    expect(await validate(plainToInstance(CreateQuoteDto, { items: [validItem] }))).toHaveLength(0);
    expect(await validate(plainToInstance(CreateQuoteDto, { items: [{ ...validItem, itemType: QuoteItemType.PART }] }))).toHaveLength(0);
  });
});
