import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import { WorkOrderRepository } from '../src/modules/work-orders/repositories/work-order.repository';
import { ReturnSparePartDto } from '../src/modules/work-orders/dto/return-spare-part.dto';
import { UserRole } from '../src/common/enums/user-role.enum';

describe('WorkOrdersService.returnPart (HU-07 / BE-E03 - Devolución física de repuestos)', () => {
  let service: WorkOrdersService;
  const repository = {
    findConsumeContext: jest.fn(),
    returnPart: jest.fn(),
  } as unknown as WorkOrderRepository;

  const baseContext = {
    id: 'wo-1',
    status: 'IN_REPAIR',
    mechanicId: 'mech-1',
    vehicleId: 'veh-1',
    quote: {
      parts: [
        { id: 'qp-1', sparePartId: 'sp-1', quantity: 2, status: 'INSTALLED', sparePart: { code: 'FIL-01', name: 'Filtro' } },
      ],
    },
  };

  const dto: ReturnSparePartDto = { sparePartId: 'sp-1', quantity: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkOrdersService(repository, { get: jest.fn() } as never);
  });

  describe('successful return', () => {
    it('delegates with the part and user after validating the context', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue(baseContext);
      repository.returnPart = jest.fn().mockResolvedValue({
        id: 'qp-1',
        code: 'FIL-01',
        name: 'Filtro',
        quantity: 1,
        status: 'RELEASED',
      });

      const result = await service.returnPart('wo-1', 'mech-1', UserRole.MECHANIC, dto);

      expect(repository.returnPart).toHaveBeenCalledWith('wo-1', dto, 'mech-1');
      expect(result).toEqual({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'RELEASED' });
    });

    it('allows the workshop lead to return a part in any order (RN-14 oversight)', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, mechanicId: 'mech-2' });
      repository.returnPart = jest.fn().mockResolvedValue({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'RELEASED' });

      await service.returnPart('wo-1', 'lead-1', UserRole.WORKSHOP_LEAD, dto);

      expect(repository.returnPart).toHaveBeenCalledWith('wo-1', dto, 'lead-1');
    });

    it('allows returning while the order is WAITING_FOR_PART (waiting part pause)', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, status: 'WAITING_FOR_PART' });
      repository.returnPart = jest.fn().mockResolvedValue({ id: 'qp-1', code: 'FIL-01', name: 'Filtro', quantity: 1, status: 'INSTALLED' });

      await service.returnPart('wo-1', 'mech-1', UserRole.MECHANIC, dto);

      expect(repository.returnPart).toHaveBeenCalled();
    });
  });

  describe('work order not found', () => {
    it('rejects with 404 when the work order does not exist', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue(null);

      await expect(service.returnPart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
        .rejects.toThrow(NotFoundException);
      expect(repository.returnPart).not.toHaveBeenCalled();
    });
  });

  describe('RN-04: mechanic ownership', () => {
    it('rejects a mechanic returning a part from another mechanic work order', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, mechanicId: 'mech-2' });

      await expect(service.returnPart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
        .rejects.toThrow(UnprocessableEntityException);
      expect(repository.returnPart).not.toHaveBeenCalled();
    });
  });

  describe('BE-E03: work order state machine', () => {
    it.each(['RECEIVED', 'IN_DIAGNOSIS', 'QUOTE_SENT', 'APPROVED', 'READY_FOR_DELIVERY', 'DELIVERED', 'FINALIZED', 'REJECTED'])(
      'rejects the return when the order is in state %s',
      async (status) => {
        repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, status });

        await expect(service.returnPart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
          .rejects.toThrow(ConflictException);
        expect(repository.returnPart).not.toHaveBeenCalled();
      },
    );
  });

  describe('RN-07: part must belong to the order quote', () => {
    it('rejects when the spare part was never part of this order quote', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue({ ...baseContext, quote: { parts: [] } });

      await expect(service.returnPart('wo-1', 'mech-1', UserRole.MECHANIC, dto))
        .rejects.toThrow(UnprocessableEntityException);
      expect(repository.returnPart).not.toHaveBeenCalled();
    });
  });

  describe('RN-16: mechanic response allowlist', () => {
    it('does not expose financial fields in the response', async () => {
      repository.findConsumeContext = jest.fn().mockResolvedValue(baseContext);
      repository.returnPart = jest.fn().mockResolvedValue({
        id: 'qp-1',
        code: 'FIL-01',
        name: 'Filtro',
        quantity: 1,
        status: 'RELEASED',
      });

      const result = await service.returnPart('wo-1', 'mech-1', UserRole.MECHANIC, dto);

      expect(Object.keys(result)).toEqual(['id', 'code', 'name', 'quantity', 'status']);
      expect(JSON.stringify(result)).not.toMatch(/unitPrice|subtotal|total|price|cost/i);
    });
  });
});