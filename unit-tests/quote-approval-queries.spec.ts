import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { QueryQuoteApprovalsDto } from '../src/modules/quotes/dto/query-quote-approvals.dto';
import { QuotesService } from '../src/modules/quotes/quotes.service';

describe('QuotesService approval queries', () => {
  const repository = {
    findApprovalPage: jest.fn(),
    countApprovalQuotes: jest.fn(),
    findApprovalDetail: jest.fn(),
  };
  let service: QuotesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuotesService(repository as never);
  });

  it('returns a paginated approval list', async () => {
    repository.findApprovalPage.mockResolvedValue([{ workOrderId: 'order-1', orderCode: null, vehiclePlate: 'ABC-123', vehicleBrand: 'Toyota', vehicleModel: 'Yaris', vehicleYear: 2024, clientName: 'Client', total: '100.00', status: 'PRESUPUESTO_ENVIADO', isFullyElectric: false }]);
    repository.countApprovalQuotes.mockResolvedValue(1);

    await expect(service.listApprovalQuotes({ page: 2, pageSize: 10 })).resolves.toEqual({
      data: [{ orderId: 'order-1', orderCode: null, vehiclePlate: 'ABC-123', vehicleDescription: 'Toyota Yaris (2024)', clientName: 'Client', totalBOB: '100.00', status: 'PRESUPUESTO_ENVIADO', isFullyElectric: false }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(repository.findApprovalPage).toHaveBeenCalledWith(2, 10);
    expect(repository.countApprovalQuotes).toHaveBeenCalledTimes(1);
  });

  it('uses default pagination values', async () => {
    repository.findApprovalPage.mockResolvedValue([]);
    repository.countApprovalQuotes.mockResolvedValue(0);

    await expect(service.listApprovalQuotes({})).resolves.toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
  });

  it('returns not found when the approval detail does not exist', async () => {
    repository.findApprovalDetail.mockResolvedValue(null);

    await expect(service.getApprovalDetail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the approval detail supplied by the repository', async () => {
    const detail = { quoteId: 'quote-1', workOrderId: 'order-1', items: [] };
    repository.findApprovalDetail.mockResolvedValue(detail);

    await expect(service.getApprovalDetail('order-1')).resolves.toBe(detail);
    expect(repository.findApprovalDetail).toHaveBeenCalledWith('order-1');
  });
});

describe('QueryQuoteApprovalsDto', () => {
  it('rejects invalid pagination values', async () => {
    const query = new QueryQuoteApprovalsDto();
    query.page = 0;
    query.pageSize = 101;

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['page', 'pageSize']));
  });
});
