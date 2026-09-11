import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PublicTrackingRow {
  id: string;
  status: string;
  createdAt: Date;
  vehicle: { model: string };
  quote: { details: { description: string; itemType: string }[] } | null;
}

// RN-17: public tracking only exposes active operational orders. Terminal or
// inactive states must behave like a non-match so lookup failures stay private.
const ACTIVE_PUBLIC_TRACKING_STATUSES = [
  'RECIBIDO',
  'ASIGNADA',
  'EN_DIAGNOSTICO',
  'PRESUPUESTO_ENVIADO',
  'APROBADO',
  'EN_REPARACION',
  'EN_ESPERA_DE_REPUESTO',
  'ESPERANDO_REPUESTO',
  'FINALIZADO',
  'LISTO_ENTREGA',
];

@Injectable()
export class PublicTrackingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByPlateAndNationalId(
    licensePlate: string,
    nationalId: string,
  ): Promise<PublicTrackingRow | null> {
    return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      tx.workOrder.findFirst({
        where: {
          vehicle: { plate: licensePlate },
          customer: { identification: nationalId },
          status: { in: ACTIVE_PUBLIC_TRACKING_STATUSES },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          vehicle: { select: { model: true } },
          quote: {
            select: {
              details: {
                where: { itemType: 'LABOR' },
                orderBy: { id: 'asc' },
                select: { description: true, itemType: true },
              },
            },
          },
        },
      }),
    );
  }
}
