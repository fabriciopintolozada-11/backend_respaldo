import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from '../dto/register-vehicle-entry.dto';
import { AssignWorkOrderResponseDto } from '../dto/assign-work-order.dto';

@Injectable()
export class WorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
