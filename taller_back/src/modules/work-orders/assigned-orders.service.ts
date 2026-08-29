import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignedWorkOrderDetailRow,
  AssignedWorkOrderListRow,
  MechanicOrdersRepository,
} from './repositories/mechanic-orders.repository';
import { AssignedWorkOrderDetailResponseDto } from './dto/assigned-work-order-detail.response.dto';
import { ListAssignedWorkOrdersResponseDto } from './dto/list-assigned-work-orders.response.dto';
import { QueryAssignedWorkOrdersDto } from './dto/query-assigned-work-orders.dto';

@Injectable()
export class AssignedOrdersService {
  constructor(private readonly repository: MechanicOrdersRepository) {}

  // RN-04: a mechanic can only see the work orders explicitly assigned to
  // them. The mechanic id always comes from the authenticated user (BE-19),
  // so a mechanic can never query another mechanic's orders.
  async getAssigned(
    mechanicId: string,
    query: QueryAssignedWorkOrdersDto,
  ): Promise<ListAssignedWorkOrdersResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [rows, total] = await Promise.all([
      this.repository.findAssignedToMechanic(mechanicId, page, pageSize),
      this.repository.countAssignedToMechanic(mechanicId),
    ]);

    return {
      data: rows.map((row: AssignedWorkOrderListRow) => ({
        id: row.id,
        vehicleId: row.vehicleId,
        plate: row.vehicle.plate,
        status: row.status,
        initialComplaint: row.initialComplaint,
        assignedAt: row.assignedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getAssignedDetail(mechanicId: string, workOrderId: string): Promise<AssignedWorkOrderDetailResponseDto> {
    const order = await this.repository.findAssignedDetail(mechanicId, workOrderId);
    if (!order) throw new NotFoundException('No se encontró una Orden de Trabajo asignada a este mecánico');
    const detail: AssignedWorkOrderDetailRow = order;
    return {
      id: detail.id,
      vehicleId: detail.vehicleId,
      plate: detail.vehicle.plate,
      brand: detail.vehicle.brand,
      model: detail.vehicle.model,
      year: detail.vehicle.year,
      status: detail.status,
      initialComplaint: detail.initialComplaint,
      assignedAt: detail.assignedAt,
    };
  }
}
