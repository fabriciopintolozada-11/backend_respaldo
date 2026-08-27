import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterVehicleEntryDto, WorkOrderResponseDto } from '../dto/register-vehicle-entry.dto';
import { AssignWorkOrderResponseDto } from '../dto/assign-work-order.dto';

export interface VehicleHistoryRecord {
  plate: string;
  brand: string;
  model: string;
  year: number;
  technicalHistory: Array<{ description: string; createdAt: Date }>;
  workOrders: Array<{ id: string; status: string; createdAt: Date; updatedAt: Date }>;
}

@Injectable()
export class WorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVehicleHistory(plate: string): Promise<VehicleHistoryRecord> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { plate },
      select: {
        plate: true,
        brand: true,
        model: true,
        year: true,
        technicalHistory: { orderBy: { createdAt: 'desc' } },
        workOrders: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, createdAt: true, updatedAt: true },
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
      const existingVehicle = await transaction.vehicle.findUnique({ where: { plate: dto.plate } });
      if (existingVehicle && existingVehicle.customerId !== customer.id) {
        throw new ConflictException('La placa ya se encuentra registrada a nombre de otro cliente');
      }

      const vehicle = existingVehicle
        ? await transaction.vehicle.update({
            where: { id: existingVehicle.id },
            data: { brand: dto.vehicle.brand, model: dto.vehicle.model, year: dto.vehicle.year },
          })
        : await transaction.vehicle.create({
            data: {
              customerId: customer.id,
              plate: dto.plate,
              brand: dto.vehicle.brand,
              model: dto.vehicle.model,
              year: dto.vehicle.year,
              isFullyElectric: dto.vehicle.isFullyElectric,
            },
          });

      if (vehicle.isFullyElectric) {
        throw new UnprocessableEntityException('Los vehículos 100% eléctricos no son aceptados');
      }
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

  findWorkOrderForAssignment(db: Pick<PrismaService, 'workOrder'>, id: string) {
    return db.workOrder.findUnique({
      where: { id },
      select: { mechanicId: true, status: true },
    });
  }

  findMechanicForAssignment(db: Pick<PrismaService, 'mechanic'>, mechanicId: string) {
    return db.mechanic.findUnique({
      where: { id: mechanicId },
      select: { isActive: true },
    });
  }

  async assignWorkOrder(
    db: Pick<PrismaService, 'workOrder'>,
    id: string,
    mechanicId: string,
  ): Promise<AssignWorkOrderResponseDto | null> {
    const result = await db.workOrder.updateMany({
      where: { id, mechanicId: null, status: 'RECIBIDO' },
      data: { mechanicId, assignedAt: new Date(), status: 'ASIGNADA' },
    });
    if (result.count === 0) return null;

    return db.workOrder.findUnique({
      where: { id },
      select: { id: true, mechanicId: true, status: true, updatedAt: true },
    }) as Promise<AssignWorkOrderResponseDto>;
  }
}
