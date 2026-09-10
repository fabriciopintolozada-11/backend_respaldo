import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { QueryTrackingWorkOrdersDto } from '../src/modules/work-orders/dto/query-tracking-work-orders.dto';

describe('QueryTrackingWorkOrdersDto (US-05 / BE-T05.1)', () => {
  const VALID_UUID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

  const createDto = (data: Record<string, unknown>): QueryTrackingWorkOrdersDto =>
    plainToInstance(QueryTrackingWorkOrdersDto, data) as QueryTrackingWorkOrdersDto;

  it('accepts a payload with all filters populated', async () => {
    const dto = createDto({ licensePlate: '4589-KXA', status: 'EN_REPARACION', workBayId: VALID_UUID });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty payload because every filter is optional', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a status that is not part of the work-order state machine', async () => {
    const dto = createDto({ status: 'NOT_A_STATUS' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'status');
    expect(field).toBeDefined();
  });

  it('rejects a workBayId that is not a valid UUID', async () => {
    const dto = createDto({ workBayId: 'not-a-uuid' });
    const errors = await validate(dto);
    const field = errors.find((e: ValidationError) => e.property === 'workBayId');
    expect(field).toBeDefined();
  });

  it('accepts every status used by the workshop', async () => {
    for (const status of ['RECIBIDO', 'ASIGNADA', 'EN_DIAGNOSTICO', 'PRESUPUESTO_ENVIADO', 'APROBADO', 'EN_REPARACION', 'EN_ESPERA_DE_REPUESTO', 'LISTO_ENTREGA', 'ENTREGADO', 'FINALIZADO']) {
      const dto = createDto({ status });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('coerces onlyStaleQuotes from a "true" query string to a boolean (US-16 / BE-T16.3)', async () => {
    const dto = createDto({ onlyStaleQuotes: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.onlyStaleQuotes).toBe(true);
  });

  it('coerces onlyStaleQuotes from a "false" query string to a boolean', async () => {
    const dto = createDto({ onlyStaleQuotes: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.onlyStaleQuotes).toBe(false);
  });

  it('leaves onlyStaleQuotes undefined when it is not present', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.onlyStaleQuotes).toBeUndefined();
  });
});