import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// BE-02.2 (US-02 / RN-17): only these operational work-order states are visible
// through the public lookup. Any terminal / inactive state (RECHAZADO,
// CANCELADA, CERRADA, ENTREGADO) is excluded so the query resolves to a 404.
const ACTIVE_WORK_ORDER_STATES = [
  'RECIBIDO',
  'ASIGNADA',
  'EN_DIAGNOSTICO',
  'PRESUPUESTO_ENVIADO',
  'APROBADO',
  'EN_REPARACION',
  'ESPERANDO_REPUESTO',
  'FINALIZADO',
  'LISTO_ENTREGA',
];

// BE-08: PrismaService is only injected inside repositories. This class exposes
// semantic data-access methods for the public vehicle status lookup (RN-17).
@Injectable()
export class VehicleStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatestByPlateAndIdentification(plate: string, identification: string) {
    return this.prisma.workOrder.findFirst({
      where: {
        vehicle: { plate },
        customer: { identification },
        // HU-02 / RN-17: only active operational work orders are visible.
        status: { in: ACTIVE_WORK_ORDER_STATES },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        vehicle: { select: { plate: true, brand: true, model: true, year: true } },
      },
    });
  }
}
