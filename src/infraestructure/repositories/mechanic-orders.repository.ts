import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { MechanicWorkOrderDto } from '../../presentation/dto/mechanic-work-order.dto';

@Injectable()
export class MechanicOrdersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAssignedByMechanic(mechanicId: string): Promise<MechanicWorkOrderDto[]> {
    const result = await this.pool.query(
      `SELECT wo."id", wo."vehicleId", v."plate", wo."status", wo."initialComplaint", wo."assignedAt"
       FROM "WorkOrder" wo JOIN "Vehicle" v ON v."id" = wo."vehicleId"
       WHERE wo."mechanicId" = $1 ORDER BY wo."assignedAt" DESC`,
      [mechanicId],
    );
    return result.rows;
  }
}
