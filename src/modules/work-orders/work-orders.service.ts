import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RegisterVehicleEntryDto } from './dto/register-vehicle-entry.dto';
import { WorkOrderRepository } from './repositories/work-order.repository';
import { normalizePlate, validateVehicleCanBeReceived } from '../../domain/work-orders/vehicle-entry.rules';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';
import { ConsumeSparePartDto } from './dto/consume-spare-part.dto';
import { WorkOrderPartResponseDto } from './dto/work-order-part.response.dto';
import { SetAwaitingPartDto } from './dto/set-awaiting-part.dto';
import { AwaitingPartResponseDto } from './dto/awaiting-part-response.dto';
import { UserRole } from '../../common/enums/user-role.enum';

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

  async createDiagnostic(id: string, mechanicId: string, dto: CreateDiagnosticDto) {
    const order = await this.repository.findAssignedWorkOrder(id, mechanicId);
    if (!order) throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    if (!['RECIBIDO', 'ASIGNADA', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(order.status)) {
      throw new ConflictException('Work order cannot receive a diagnostic in its current state');
    }
    // RN-03: additional findings suspend repair until a new quote is approved.
    return this.repository.createDiagnostic(id, dto, order.status === 'EN_REPARACION' ? 'PRESUPUESTO_ENVIADO' : 'EN_DIAGNOSTICO');
  }

  // HU-07: confirm the installation/use of a reserved spare part.
  // All rules live in the service (BE-06); the repository performs the atomic
  // persistence (BE-16).
  async consumePart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: ConsumeSparePartDto,
  ): Promise<WorkOrderPartResponseDto> {
    const context = await this.repository.findConsumeContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: only the assigned mechanic consumes parts; the workshop lead
    // oversees and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-09: the order must be approved or in repair. Receiving/diagnostic
    // stages cannot start a repair or consume stock.
    if (!['APROBADO', 'EN_REPARACION'].includes(context.status)) {
      throw new UnprocessableEntityException('RN-09: work order is not approved or in repair to consume a spare part');
    }

    // RN-07: the requested part must belong to this order's approved quote and
    // be reserved exclusively for it.
    const part = context.quote?.parts?.find((item) => item.id === dto.quotePartId);
    if (!part || part.status !== 'RESERVED') {
      throw new UnprocessableEntityException('RN-07: spare part is not reserved for this work order');
    }

    // RN-01: never consume more than the reserved quantity.
    if (dto.quantity > part.quantity) {
      throw new UnprocessableEntityException('RN-01: quantity exceeds the reserved amount for the spare part');
    }

    // HU-07: the first consumption of an approved order moves it to repair.
    const nextStatus = context.status === 'APROBADO' ? 'EN_REPARACION' : context.status;

    return this.repository.consumePart(workOrderId, dto, userId, nextStatus);
  }

  // US-13: set a work order to EN_ESPERA_DE_REPUESTO when a spare part is
  // physically unavailable in the warehouse. All business rules live here
  // (BE-06); the repository performs the atomic persistence (BE-16).
  async setAwaitingPart(
    workOrderId: string,
    userId: string,
    role: string,
    dto: SetAwaitingPartDto,
  ): Promise<AwaitingPartResponseDto> {
    const context = await this.repository.findAwaitingPartContext(workOrderId);
    if (!context) throw new NotFoundException('Work order not found');

    // RN-04: only the assigned mechanic can set the order to awaiting part;
    // the workshop lead oversees and is always allowed.
    if (role === UserRole.MECHANIC && context.mechanicId !== userId) {
      throw new UnprocessableEntityException('RN-04: work order is not assigned to this mechanic');
    }

    // RN-05: the work order must be strictly in EN_REPARACION to transition
    // to EN_ESPERA_DE_REPUESTO.
    if (context.status !== 'EN_REPARACION') {
      throw new ConflictException(
        'RN-05: work order must be in EN_REPARACION to set awaiting part',
      );
    }

    // Validate that the missing part belongs to this work order's approved
    // quote. This prevents reporting a part that was never requested.
    const quoteParts = context.quote?.parts ?? [];
    const partBelongsToOrder = quoteParts.some(
      (p) => p.sparePartId === dto.missingPartId,
    );
    if (!partBelongsToOrder) {
      throw new UnprocessableEntityException(
        'The reported spare part is not associated with this work order',
      );
    }

    return this.repository.setAwaitingPart(
      workOrderId,
      dto,
      userId,
      context.vehicleId,
    );
  }
}
