import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { RegisterVehicleEntryDto } from './dto/register-vehicle-entry.dto';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { normalizePlate, validateVehicleCanBeReceived } from '../../domain/work-orders/vehicle-entry.rules';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { ListMechanicsResponseDto } from './dto/mechanic-list.response.dto';
import { ListWorkOrdersResponseDto } from './dto/work-order-list.response.dto';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly repository: WorkOrderRepository) {}

  getVehicleHistory(plate: string) {
    return this.repository.findVehicleHistory(normalizePlate(plate));
  }

  registerVehicleEntry(dto: RegisterVehicleEntryDto, receptionistId: string) {
    validateVehicleCanBeReceived(dto.vehicle.isFullyElectric);
    return this.repository.createVehicleEntry({ ...dto, plate: normalizePlate(dto.plate) }, receptionistId);
  }

  async getAvailableWorkOrders(query: QueryWorkOrdersDto): Promise<ListWorkOrdersResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [rows, total] = await Promise.all([
      this.repository.findAvailable(page, pageSize),
      this.repository.countAvailable(),
    ]);

    return { data: rows, total, page, pageSize };
  }

  async getActiveMechanics(query: QueryWorkOrdersDto): Promise<ListMechanicsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [data, total] = await Promise.all([
      this.repository.findActiveMechanics(page, pageSize),
      this.repository.countActiveMechanics(),
    ]);

    return { data, total, page, pageSize };
  }

  async createDiagnostic(id: string, mechanicId: string, dto: CreateDiagnosticDto) {
    const order = await this.repository.findAssignedWorkOrder(id, mechanicId);
    if (!order) throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    if (!['RECIBIDO', 'ASIGNADA', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(order.status)) {
      throw new ConflictException('Work order cannot receive a diagnostic in its current state');
    }
    // RN-03: additional findings suspend repair until a new quote is approved.
    return this.repository.createDiagnostic(id, dto, order.status === 'EN_REPARACION' ? 'PRESUPUESTO_ENVIADO' : 'EN_DIAGNOSTICO');
  }
}
