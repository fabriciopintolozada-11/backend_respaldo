import { UnprocessableEntityException } from '@nestjs/common';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { ConsumeSparePartDto } from '../src/modules/work-orders/dto/consume-spare-part.dto';
import { UserRole } from '../src/common/enums/user-role.enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('WorkOrdersService.consumePart (HU-07 - Confirmar uso de repuestos)', () => {
  let service: WorkOrdersService;
  const repository = {
    findConsumeContext: jest.fn(),
    consumePart: jest.fn(),
  } as unknown as WorkOrderRepository;

  const baseContext = {
    id: 'wo-1',
    status: 'EN_REPARACION',
    mechanicId: 'mech-1',
    vehicleId: 'veh-1',
    quote: {
      parts: [
        { id: 'qp-1', sparePartId: 'sp-1', quantity: 2, status: 'RESERVED', sparePart: { code: 'FIL-01', name: 'Filtro' } },
      ],
    },
  };

  const dto: ConsumeSparePartDto = { quotePartId: 'qp-1', quantity: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkOrdersService(repository);
  });

  describe('successful confirmation', () => {
    it('delegates with the reserved part and a valid status (EN_REPARACION)', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue(baseContext);
      repository.consumePart = jest.fn().mockResolvedValue({
        id: 'qp-1',
        code: 'FIL-01',
        name: 'Filtro',
        quantity: 1,
        status: 'INSTALLED',
      });

      const result = await service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto);

      expect(repository.consumePart).toHaveBeenCalledWith('wo-1', dto, 'mech-1', 'EN_REPARACION');
      expect(result).toEqual({
        id: 'qp-1',
        code: 'FIL-01',
        name: 'Filtro',
        quantity: 1,
        status: 'INSTALLED',
      });
    });

    it('transitions an APROBADO order to EN_REPARACION on first consumption (HU-07)', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, status: 'APROBADO' });
      repository.consumePart = jest.fn().mockResolvedValue({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'INSTALLED' });

      await service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto);

      expect(repository.consumePart).toHaveBeenCalledWith('wo-1', dto, 'mech-1', 'EN_REPARACION');
    });

    it('allows the workshop lead to consume a part in any order (RN-14 oversight)', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, mechanicId: 'mech-2' });
      repository.consumePart = jest.fn().mockResolvedValue({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'INSTALLED' });

      await service.consumePart('wo-1', 'lead-1', UserRole.WORKSHOP_LEAD, dto);

      expect(repository.consumePart).toHaveBeenCalled();
    });

    it('keeps nextStatus as EN_REPARACION when the order is already in repair', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue(baseContext);
      repository.consumePart = jest.fn().mockResolvedValue({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'INSTALLED' });

      await service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto);

      expect(repository.consumePart).toHaveBeenCalledWith('wo-1', dto, 'mech-1', 'EN_REPARACION');
    });
  });

  describe('RN-04: mechanic ownership', () => {
    it('rejects a mechanic consuming a part from another mechanic work order', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, mechanicId: 'mech-2' });

      await expect(service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
        .rejects.toThrow(UnprocessableEntityException);
      expect(repository.consumePart).not.toHaveBeenCalled();
    });
  });

  describe('RN-09: work order state machine', () => {
    it.each(['RECIBIDO', 'EN_DIAGNOSTICO', 'PRESUPUESTO_ENVIADO', 'ESPERANDO_REPUESTO', 'FINALIZADO'])(
      'rejects consumption when the order is in state %s (RN-09)',
      async (status) => {
        repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, status });

        await expect(service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
          .rejects.toThrow(UnprocessableEntityException);
        expect(repository.consumePart).not.toHaveBeenCalled();
      },
    );
  });

  describe('RN-07: part must be reserved for this order', () => {
    it('rejects when the part does not belong to the order quote', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, quote: { parts: [] } });

      await expect(service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
        .rejects.toThrow(UnprocessableEntityException);
      expect(repository.consumePart).not.toHaveBeenCalled();
    });

    it('rejects when the part is not RESERVED (already installed or pending)', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({
        ...baseContext,
        quote: { parts: [{ id: 'qp-1', sparePartId: 'sp-1', quantity: 2, status: 'INSTALLED', sparePart: { code: 'FIL-01', name: 'Filtro' } }] },
      });

      await expect(service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
        .rejects.toThrow(UnprocessableEntityException);
      expect(repository.consumePart).not.toHaveBeenCalled();
    });
  });

  describe('RN-01: quantity limits', () => {
    it('rejects consuming more than the reserved quantity', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue(baseContext);
      const overDto: ConsumeSparePartDto = { quotePartId: 'qp-1', quantity: 3 };

      await expect(service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, overDto))
        .rejects.toThrow(UnprocessableEntityException);
      expect(repository.consumePart).not.toHaveBeenCalled();
    });
  });

  describe('RN-16: mechanic response allowlist', () => {
    it('does not expose financial fields in the response', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue(baseContext);
      repository.consumePart = jest.fn().mockResolvedValue({
        id: 'qp-1',
        code: 'FIL-01',
        name: 'Filtro',
        quantity: 1,
        status: 'INSTALLED',
      });

      const result = await service.consumePart('wo-1', 'mech-1', UserRole.MECHANIC, dto);

      expect(Object.keys(result)).toEqual(['id', 'code', 'name', 'quantity', 'status']);
      expect(JSON.stringify(result)).not.toMatch(/unitPrice|subtotal|total|price|cost/i);
    });
  });

  describe('ConsumeSparePartDto validation (BE-10)', () => {
    it.each([
      [{ quotePartId: undefined, quantity: 1 }, 'quotePartId'],
      [{ quotePartId: 'not-a-uuid', quantity: 1 }, 'quotePartId'],
      [{ quotePartId: 'qp-1', quantity: 0 }, 'quantity'],
      [{ quotePartId: 'qp-1', quantity: -1 }, 'quantity'],
    ])('rejects invalid payload %j (field: %s)', async (payload, field) => {
      const dto = plainToInstance(ConsumeSparePartDto, payload);
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain(field);
    });

    it('accepts a valid payload', async () => {
      const dto = plainToInstance(ConsumeSparePartDto, {
        quotePartId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        quantity: 1,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
