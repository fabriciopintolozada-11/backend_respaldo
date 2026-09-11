import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApproveAdditionalFindingDto } from '../src/modules/work-orders/dto/approve-additional-finding.dto';
import { ApprovalChannel } from '../src/modules/quotes/dto/approve-quote.dto';

describe('ApproveAdditionalFindingDto (US-21 / BE-T21.2)', () => {
  it('accepts a valid approval payload', async () => {
    const instance = plainToInstance(ApproveAdditionalFindingDto, {
      channel: ApprovalChannel.CALL,
      customerName: 'Juan Pérez',
      notes: 'El cliente aprobó el presupuesto adicional',
    });

    const errors = await validate(instance);

    expect(errors).toHaveLength(0);
  });

  it.each([['SMS', 'Invalid channel rejected']])('rejects a channel outside the approved set', async (channel) => {
    const instance = plainToInstance(ApproveAdditionalFindingDto, {
      channel,
      customerName: 'Juan Pérez',
      notes: 'nota válida',
    });

    const errors = await validate(instance);

    expect(errors.map((error) => error.property)).toContain('channel');
  });

  it('rejects a missing customer name', async () => {
    const instance = plainToInstance(ApproveAdditionalFindingDto, {
      channel: ApprovalChannel.WHATSAPP,
      notes: 'nota válida',
    });

    const errors = await validate(instance);

    expect(errors.map((error) => error.property)).toContain('customerName');
  });
});