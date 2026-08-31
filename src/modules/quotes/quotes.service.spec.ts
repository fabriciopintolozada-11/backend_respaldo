import { ConflictException } from '@nestjs/common';
import { ApprovalChannel } from './dto/approve-quote.dto';
import { QuotesService } from './quotes.service';

describe('QuotesService quote decisions', () => {
  it('approves only a quote awaiting customer decision', async () => {
    const repository = {
      findDecisionContext: jest.fn().mockResolvedValue({ id: 'quote-1', workOrder: { id: 'order-1', status: 'PRESUPUESTO_ENVIADO' } }),
      approve: jest.fn().mockResolvedValue({ decision: 'APPROVED' }),
    };
    const service = new QuotesService(repository as never);

    await service.approve('order-1', { channel: ApprovalChannel.WHATSAPP, customerName: 'Cliente', notes: 'Autorizado' }, 'user-1');

    expect(repository.approve).toHaveBeenCalledWith('order-1', { channel: ApprovalChannel.WHATSAPP, customerName: 'Cliente', notes: 'Autorizado' }, 'user-1');
  });

  it('rejects a decision when the quote is not awaiting approval', async () => {
    const repository = {
      findDecisionContext: jest.fn().mockResolvedValue({ id: 'quote-1', workOrder: { id: 'order-1', status: 'APROBADO' } }),
      reject: jest.fn(),
    };
    const service = new QuotesService(repository as never);

    await expect(service.reject('order-1', { reason: 'Cliente no autoriza' }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.reject).not.toHaveBeenCalled();
  });
});
