import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class VehicleStatusRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findLatestByPlateAndIdentification(plate: string, identification: string) {
    const result = await this.pool.query(
      `SELECT wo."id", wo."status", wo."initialComplaint", wo."createdAt", v."plate", v."brand", v."model", v."year", c."name"
       FROM "WorkOrder" wo
       JOIN "Vehicle" v ON v."id" = wo."vehicleId"
       JOIN "Customer" c ON c."id" = wo."customerId"
       WHERE v."plate" = $1 AND c."identification" = $2
       ORDER BY wo."createdAt" DESC
       LIMIT 1`,
      [plate, identification],
    );
    if (!result.rows[0]) throw new NotFoundException('No se encontró una orden de trabajo válida');
    return result.rows[0];
  }
}
