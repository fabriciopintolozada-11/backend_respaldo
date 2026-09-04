import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuotesService } from '../src/modules/quotes/quotes.service';
import { QuoteItemType } from '../src/modules/quotes/dto/create-quote.dto';
import { QuoteRepository } from '../src/modules/quotes/repositories/quote.repository';

describe('QuotesService (HU-12 - Generar presupuesto)', () => {
  let service: QuotesService;
  const repository = {
    findOrderForQuote: jest.fn(),
    create: jest.fn(),
  };
  const configService = { get: jest.fn() };

  const pendingQuote = {
    id: 'quote-1',
    workOrderId: 'order-1',
    items: [
      { id: 'd1', description: 'Cambio de aceite', itemType: QuoteItemType.LABOR, quantity: '2', unitPrice: '50', subtotal: '100' },
      { id: 'd2', description: 'Filtro', itemType: QuoteItemType.PART, quantity: '1', unitPrice: '20', subtotal: '20' },
    ],
    total: '120',
    laborSubtotal: '100',
    partsSubtotal: '20',
    currency: 'BOB',
    createdAt: new Date('2026-08-30T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue('65');
    service = new QuotesService(repository as unknown as QuoteRepository, configService as unknown as ConfigService);
  });

  // Escenario a) Cálculo exitoso y transición a PRESUPUESTO_ENVIADO.
  describe('successful quote generation (HU-12)', () => {
    it('creates the quote and returns totals in BOB when the order is EN_DIAGNOSTICO', async () => {
      repository.findOrderForQuote.mockResolvedValue({ status: 'EN_DIAGNOSTICO' });
      repository.create.mockResolvedValue(pendingQuote);

      const dto = {
        items: [
          { description: 'Cambio de aceite', itemType: QuoteItemType.LABOR, quantity: 2, unitPrice: 50 },
          { description: 'Filtro', itemType: QuoteItemType.PART, quantity: 1, unitPrice: 20, sparePartId: 'part-1' },
        ],
      };

      const result = await service.create('order-1', dto);

      expect(repository.findOrderForQuote).toHaveBeenCalledWith('order-1');
      expect(repository.create).toHaveBeenCalledWith('order-1', dto, expect.anything());
      expect(result.total).toBe('120');
      expect(result.laborSubtotal).toBe('100');
      expect(result.partsSubtotal).toBe('20');
      expect(result.currency).toBe('BOB');
    });
  });

  // Escenario b) Rechazo por estado inválido de la OT (máquina de estados).
  describe('rejection on invalid work order state (HU-12)', () => {
    it.each(['FINALIZADO', 'RECIBIDO', 'APROBADO', 'EN_REPARACION', 'RECHAZADO'] as const)(
      'throws ConflictException when the order is in %s',
      async (status) => {
        repository.findOrderForQuote.mockResolvedValue({ status });

        const dto = { items: [{ description: 'x', itemType: QuoteItemType.LABOR, quantity: 1, unitPrice: 10 }] };

        await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(ConflictException);
        expect(repository.create).not.toHaveBeenCalled();
      },
    );

    it('throws ConflictException when there is no diagnostic pending a quote', async () => {
      repository.findOrderForQuote.mockResolvedValue(null);

      const dto = { items: [{ description: 'x', itemType: QuoteItemType.LABOR, quantity: 1, unitPrice: 10 }] };

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  // Escenario c) Defensa en profundidad: rechazo de valores financieros negativos
  // en la capa de dominio (RN-21), independiente de la validación del DTO HTTP.
  describe('rejection on negative quantities and prices (HU-12, RN-21)', () => {
    it.each([
      ['negative labor quantity', { quantity: -2, unitPrice: 50 }],
      ['negative unit price', { quantity: 1, unitPrice: -10 }],
      ['negative part quantity', { quantity: -1, unitPrice: 20, sparePartId: 'part-1' }],
      ['negative part price', { quantity: 1, unitPrice: -20, sparePartId: 'part-1' }],
    ] as const)('rejects %s with UnprocessableEntityException', async (_name, overrides) => {
      repository.findOrderForQuote.mockResolvedValue({ status: 'EN_DIAGNOSTICO' });
      const dto = { items: [{ description: 'x', itemType: QuoteItemType.LABOR, ...overrides }] };

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('does not check the work order state before rejecting negative inputs', async () => {
      const dto = { items: [{ description: 'x', itemType: QuoteItemType.LABOR, quantity: -2, unitPrice: 50 }] };

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.findOrderForQuote).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  it('keeps decimal precision through Prisma.Decimal for non-integer inputs (RN-21)', async () => {
    repository.findOrderForQuote.mockResolvedValue({ status: 'EN_DIAGNOSTICO' });
    repository.create.mockResolvedValue({
      ...pendingQuote,
      items: [
        { id: 'd1', description: 'a', itemType: QuoteItemType.PART, quantity: '0.1', unitPrice: '0.2', subtotal: '0.02' },
      ],
      total: '0.02',
      partsSubtotal: '0.02',
      laborSubtotal: '0',
    });

    const result = await service.create('order-1', {
      items: [{ description: 'a', itemType: QuoteItemType.PART, quantity: 0.1, unitPrice: 0.2, sparePartId: 'part-1' }],
    });

    expect(repository.create).toHaveBeenCalled();
    // Prisma.Decimal stays exact where floating point (0.1 * 0.2 = 0.020000000000000004) would not.
    expect(result.total).toBe('0.02');
  });
});
