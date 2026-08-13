import { ConflictException, Injectable } from '@nestjs/common';
import { RegisterVehicleEntryDto } from '../../presentation/dto/register-vehicle-entry.dto';
import { ConflictError, WorkOrdersRepository } from '../../infraestructure/repositories/work-orders.repository';

@Injectable()
export class RegisterVehicleEntryService {
  constructor(private readonly repository: WorkOrdersRepository) {}
  getHistory(plate: string) { return this.repository.getHistory(plate.trim().toUpperCase()); }
  async register(dto: RegisterVehicleEntryDto, receptionistId: string) {
    if (dto.vehicle.isFullyElectric) throw new ConflictException('Fully electric vehicles are not accepted');
    try { return await this.repository.create({ ...dto, plate: dto.plate.trim().toUpperCase() }, receptionistId); }
    catch (error) { if (error instanceof ConflictError) throw new ConflictException(error.message); throw error; }
  }
}
