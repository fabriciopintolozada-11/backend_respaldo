import { Injectable, NotFoundException } from '@nestjs/common';
import { AssignedQuoteRow, AssignedWorkOrderRow, MechanicOrdersRepository } from './repositories/mechanic-orders.repository';
import { ListAssignedWorkOrdersResponseDto } from './dto/list-assigned-work-orders.response.dto';
import { QueryAssignedWorkOrdersDto } from './dto/query-assigned-work-orders.dto';
import { AssignedWorkOrderDetailResponseDto, ReservedPartLineDto } from './dto/assigned-work-order.response.dto';

@Injectable()
export class AssignedOrdersService {
  constructor(private readonly repository: MechanicOrdersRepository) {}

  // HU-13: expose only the approved quote. A quote is approved when its latest
  // approval decision is APPROVED. The parts carry the sparePartId the
  // frontend sends as missingPartId. Financial fields are never serialized
  // (RN-16 / BE-12).
  private toApprovedQuote(quote: AssignedQuoteRow | null) {
    if (!quote) return null;
    const latestApproval = quote.approvals[0];
    if (!latestApproval || latestApproval.decision !== 'APPROVED') {
      return null;
    }
    return {
      id: quote.id,
      parts: quote.parts.map((part) => ({
        id: part.id,
        sparePartId: part.sparePartId,
        quantity: part.quantity,
        status: part.status,
        sparePart: {
          id: part.sparePart.id,
          code: part.sparePart.code,
          name: part.sparePart.name,
        },
      })),
    };
  }

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
      data: rows.map((row: AssignedWorkOrderRow) => ({
        id: row.id,
        vehicleId: row.vehicleId,
        plate: row.vehicle.plate,
        status: row.status,
        initialComplaint: row.initialComplaint,
        assignedAt: row.assignedAt,
        quote: this.toApprovedQuote(row.quote),
      })),
      total,
      page,
      pageSize,
    };
  }

  // HU-07: returns the technical detail of an assigned work order alongside
  // its reserved spare part lines (RN-07). The mechanic may only see the work
  // orders explicitly assigned to them (RN-04). No price is mapped (RN-16).
  async getAssignedDetail(mechanicId: string, workOrderId: string): Promise<AssignedWorkOrderDetailResponseDto> {
    const order = await this.repository.findAssignedDetail(mechanicId, workOrderId);
    if (!order) throw new NotFoundException('Assigned work order not found');

    const reservedParts: ReservedPartLineDto[] = (order.quote?.parts ?? [])
      .filter((p) => p.status === 'RESERVED' || p.status === 'INSTALLED')
      .map((p) => ({
        quotePartId: p.id,
        code: p.sparePart.code,
        name: p.sparePart.name,
        quantityReserved: p.quantity,
        quantityUsed: p.status === 'INSTALLED' ? p.quantity : 0,
        status: p.status as 'RESERVED' | 'INSTALLED',
      }));
    return {
      id: order.id,
      vehicleId: order.vehicleId,
      plate: order.vehicle.plate,
      status: order.status,
      initialComplaint: order.initialComplaint,
      assignedAt: order.assignedAt,
      vehicle: {
        plate: order.vehicle.plate,
        brand: order.vehicle.brand,
        model: order.vehicle.model,
        year: order.vehicle.year,
      },
      quote: this.toApprovedQuote(order.quote),
      brand: order.vehicle.brand,
      model: order.vehicle.model,
      year: order.vehicle.year,
      reservedParts,
    };
  }
}
