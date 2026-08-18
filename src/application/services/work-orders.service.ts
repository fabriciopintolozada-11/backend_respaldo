import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { RegisterVehicleEntryDto } from '../../presentation/dto/register-vehicle-entry.dto';
import { ConflictError, WorkOrdersRepository } from '../../infraestructure/repositories/work-orders.repository';
import { normalizePlate, validateVehicleCanBeReceived } from '../../domain/work-orders/vehicle-entry.rules';

@Injectable()
export class RegisterVehicleEntryService {
  constructor(private readonly repository: WorkOrdersRepository) {}
  getHistory(plate: string) { return this.repository.getHistory(normalizePlate(plate)); }
  async register(dto: RegisterVehicleEntryDto, receptionistId: string) {
    const plate = normalizePlate(dto.plate);
    validateVehicleCanBeReceived(dto.vehicle.isFullyElectric);
    try { return await this.repository.create({ ...dto, plate }, receptionistId); }
    catch (error) { if (error instanceof ConflictError) throw new UnprocessableEntityException(error.message); throw error; }
  }
}
