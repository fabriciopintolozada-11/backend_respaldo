import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApprovalChannel, ApproveQuoteDto } from './approve-quote.dto';
import { RejectQuoteDto } from './reject-quote.dto';

describe('Quote decision DTOs', () => {
  it('accepts a supported approval channel and required evidence', async () => {
    const dto = plainToInstance(ApproveQuoteDto, {
      channel: ApprovalChannel.CALL,
      customerName: 'Cliente',
      notes: 'Aprobación confirmada por llamada',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    ['unsupported channel', { channel: 'EMAIL', customerName: 'Cliente', notes: 'Confirmado' }],
    ['missing customer name', { channel: ApprovalChannel.CALL, notes: 'Confirmado' }],
    ['missing notes', { channel: ApprovalChannel.CALL, customerName: 'Cliente' }],
  ])('rejects approval with %s', async (_name, payload) => {
    expect(await validate(plainToInstance(ApproveQuoteDto, payload))).not.toHaveLength(0);
  });

  it('requires a rejection reason', async () => {
    expect(await validate(plainToInstance(RejectQuoteDto, { reason: 'Cliente no autoriza' }))).toHaveLength(0);
    expect(await validate(plainToInstance(RejectQuoteDto, { reason: '' }))).not.toHaveLength(0);
  });
});
