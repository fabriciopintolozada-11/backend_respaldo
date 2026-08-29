import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from '../dto/register-vehicle-entry.dto';
import { AssignWorkOrderResponseDto } from '../dto/assign-work-order.dto';
import { CreateDiagnosticDto } from '../dto/create-diagnostic.dto';
import { DiagnosticResponseDto } from '../dto/diagnostic-response.dto';

@Injectable()
export class WorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAssignedWorkOrder(id: string, mechanicId: string) {
    return this.prisma.workOrder.findFirst({ where: { id, mechanicId }, select: { status: true } });
  }

  async findVehicleHistory(plate: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { plate },
      include: {
        customer: true,
        technicalHistory: { orderBy: { createdAt: 'desc' } },
        workOrders: {
          orderBy: { createdAt: 'desc' },
          include: { mechanic: true },
        },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  createVehicleEntry(dto: RegisterVehicleEntryDto, receptionistId: string): Promise<WorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.upsert({
        where: { identification: dto.customer.identification },
        update: { name: dto.customer.name, phone: dto.customer.phone },
        create: { identification: dto.customer.identification, name: dto.customer.name, phone: dto.customer.phone },
      });
      const vehicle = await transaction.vehicle.upsert({
        where: { plate: dto.plate },
        update: { brand: dto.vehicle.brand, model: dto.vehicle.model, year: dto.vehicle.year },
        create: { customerId: customer.id, plate: dto.plate, brand: dto.vehicle.brand, model: dto.vehicle.model, year: dto.vehicle.year, isFullyElectric: dto.vehicle.isFullyElectric },
      });
      const workOrder = await transaction.workOrder.create({
        data: { vehicleId: vehicle.id, customerId: customer.id, receptionistId, initialComplaint: dto.initialComplaint },
        select: { id: true, vehicleId: true, customerId: true, status: true, initialComplaint: true, createdAt: true },
      });
      await transaction.technicalHistory.create({
        data: {
          vehicleId: vehicle.id,
          description: `Initial state: ${workOrder.status}. Initial complaint: ${workOrder.initialComplaint}`,
        },
      });
      return workOrder;
    });
  }

  assign(id: string, mechanicId: string): Promise<AssignWorkOrderResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.workOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Work order not found');
      if (order.mechanicId || order.status !== 'RECIBIDO') throw new Error('Work order is not assignable');
      const mechanic = await transaction.mechanic.findUnique({ where: { id: mechanicId } });
      if (!mechanic) throw new NotFoundException('Mechanic not found');
      if (!mechanic.isActive) throw new Error('Mechanic cannot receive work orders');
      const assignedOrder = await transaction.workOrder.update({
        where: { id },
        data: { mechanicId, assignedAt: new Date(), status: 'ASIGNADA' },
        select: { id: true, mechanicId: true, status: true, updatedAt: true },
      });
      return { ...assignedOrder, mechanicId: assignedOrder.mechanicId as string };
    });
  }

  createDiagnostic(id: string, dto: CreateDiagnosticDto, status: string): Promise<DiagnosticResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const diagnostic = await transaction.diagnostic.upsert({
        where: { workOrderId: id },
        update: { description: dto.description, suggestedTasks: dto.suggestedTasks, suggestedPartIds: dto.suggestedPartIds, estimatedHours: dto.estimatedHours },
        create: { workOrderId: id, description: dto.description, suggestedTasks: dto.suggestedTasks, suggestedPartIds: dto.suggestedPartIds, estimatedHours: dto.estimatedHours },
      });
      const order = await transaction.workOrder.update({ where: { id }, data: { status }, select: { vehicleId: true } });
      await transaction.technicalHistory.create({ data: { vehicleId: order.vehicleId, description: `Diagnostic recorded for work order ${id}: ${dto.description}` } });
      // RN-16: return an explicit allowlist. Never serialize the Prisma entity
      // into a mechanic-facing response, so future financial fields cannot leak.
      return {
        id: diagnostic.id,
        workOrderId: diagnostic.workOrderId,
        description: diagnostic.description,
        suggestedTasks: diagnostic.suggestedTasks as string[],
        suggestedPartIds: diagnostic.suggestedPartIds as string[],
        estimatedHours: Number(diagnostic.estimatedHours),
        createdAt: diagnostic.createdAt,
      };
    });
  }
}
