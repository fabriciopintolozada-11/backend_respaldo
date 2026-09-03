import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VehicleStatusService } from '../src/modules/auth/vehicle-status.service';
import { VehicleStatusRepository } from '../src/modules/auth/repositories/vehicle-status.repository';

describe('VehicleStatusService (HU-02 - Consultar estado del vehículo)', () => {
  let service: VehicleStatusService;
  const repository = { findLatestByPlateAndIdentification: jest.fn() };

  const baseOrder = {
    id: 'ot-1',
    status: 'EN_REPARACION',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    vehicle: { plate: '1234ABC', brand: 'Toyota', model: 'Corolla', year: 2019 },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleStatusService,
        { provide: VehicleStatusRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(VehicleStatusService);
  });

  // Escenario 1: Consulta exitosa mostrando etapa actual y avance.
  describe('successful lookup showing current stage and progress', () => {
    it('returns the current status and stage for a valid work order (HU-02)', async () => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue(baseOrder);

      const result = await service.getStatus('1234abc', '1234567');

      expect(result.status).toBe('EN_REPARACION');
      expect(result.stage).toBe('En reparación');
      expect(result.readyForPickup).toBe(false);
      expect(result.plate).toBe('1234ABC');
      expect(result.workOrderId).toBe('ot-1');
      expect(result.vehicle).toEqual({ brand: 'Toyota', model: 'Corolla', year: 2019 });
    });

    it('does not expose customer personal or financial data in the response (RN-17)', async () => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue(baseOrder);

      const result = await service.getStatus('1234abc', '1234567');

      const keys = Object.keys(result);
      expect(keys).toEqual(['workOrderId', 'plate', 'vehicle', 'createdAt', 'status', 'stage', 'readyForPickup']);
      expect(JSON.stringify(result)).not.toMatch(/customer|phone|identification|price|cost|total|BOB/i);
    });

    it('normalizes the plate to uppercase and trims the identification before querying', async () => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue(baseOrder);

      await service.getStatus('  1234abc  ', '  1234567  ');

      expect(repository.findLatestByPlateAndIdentification).toHaveBeenCalledWith('1234ABC', '1234567');
    });

    it.each([
      ['RECIBIDO', 'Recibido'],
      ['ASIGNADA', 'Asignado'],
      ['EN_DIAGNOSTICO', 'En diagnóstico'],
      ['PRESUPUESTO_ENVIADO', 'Presupuesto enviado'],
      ['APROBADO', 'Aprobado'],
      ['EN_REPARACION', 'En reparación'],
      ['ESPERANDO_REPUESTO', 'Esperando repuesto'],
      ['FINALIZADO', 'Finalizado'],
      ['LISTO_ENTREGA', 'Listo para entrega'],
    ])('maps status %s to a human readable stage %s (HU-02)', async (status, stage) => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue({ ...baseOrder, status });

      const result = await service.getStatus('1234ABC', '1234567');

      expect(result.stage).toBe(stage);
    });
  });

  // Escenario 2: Indicación explícita de "Finalizado / Listo para entrega".
  describe('ready for pickup indication (HU-02)', () => {
    it('indicates the vehicle is ready for pickup when the order is FINALIZADO', async () => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue({ ...baseOrder, status: 'FINALIZADO' });

      const result = await service.getStatus('1234ABC', '1234567');

      expect(result.readyForPickup).toBe(true);
      expect(result.stage).toBe('Finalizado');
    });

    it('indicates the vehicle is ready for pickup when the order is LISTO_ENTREGA', async () => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue({ ...baseOrder, status: 'LISTO_ENTREGA' });

      const result = await service.getStatus('1234ABC', '1234567');

      expect(result.readyForPickup).toBe(true);
      expect(result.stage).toBe('Listo para entrega');
    });

    it.each(['RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REPUESTO'])(
      'reports readyForPickup=false while the order is still in progress (%s)',
      async (status) => {
        repository.findLatestByPlateAndIdentification.mockResolvedValue({ ...baseOrder, status });

        const result = await service.getStatus('1234ABC', '1234567');

        expect(result.readyForPickup).toBe(false);
      },
    );
  });

  // Escenario 3: Identificador inexistente/incorrecto -> error genérico 404 sin filtrar datos.
  describe('invalid or non-existent identifier (HU-02)', () => {
    it('throws a generic NotFoundException when no work order matches the plate and identification', async () => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue(null);

      await expect(service.getStatus('9999ZZZ', '0000000')).rejects.toThrow(NotFoundException);
    });

    it('uses a generic message that does not reveal whether plate or identification failed (RN-17)', async () => {
      repository.findLatestByPlateAndIdentification.mockResolvedValue(null);

      const error = await service.getStatus('9999ZZZ', '0000000').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      const response = (error as NotFoundException).getResponse();
      const message =
        typeof response === 'string' ? response : (response as { message?: string }).message;
      expect(message).toBe('No valid work order found for the provided data');
      expect(String(message)).not.toMatch(/1234567|plate|identification|other customer|not found/i);
    });
  });
});
