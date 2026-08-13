import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { RegisterVehicleEntryDto } from '../../presentation/dto/register-vehicle-entry.dto';

@Injectable()
export class WorkOrdersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async getHistory(plate: string) {
    const result = await this.pool.query(`SELECT v."id", v."plate", v."isFullyElectric", c."id" customer_id, c."name" customer_name,
      COALESCE(json_agg(json_build_object('id', h."id", 'description', h."description", 'createdAt', h."createdAt")
      ORDER BY h."createdAt" DESC) FILTER (WHERE h."id" IS NOT NULL), '[]') history
      FROM "Vehicle" v JOIN "Customer" c ON c."id" = v."customerId" LEFT JOIN "TechnicalHistory" h ON h."vehicleId" = v."id"
      WHERE v."plate" = $1 GROUP BY v."id", c."id"`, [plate]);
    if (!result.rows[0]) throw new NotFoundException('Vehicle not found');
    return result.rows[0];
  }

  async create(dto: RegisterVehicleEntryDto, receptionistId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let customer = (await client.query('SELECT "id" FROM "Customer" WHERE "identification" = $1 FOR UPDATE', [dto.customer.identification])).rows[0];
      if (!customer) customer = (await client.query('INSERT INTO "Customer" ("identification", "name", "phone") VALUES ($1,$2,$3) RETURNING "id"', [dto.customer.identification, dto.customer.name, dto.customer.phone ?? null])).rows[0];
      let vehicle = (await client.query('SELECT "id", "isFullyElectric" FROM "Vehicle" WHERE "plate" = $1 FOR UPDATE', [dto.plate])).rows[0];
      if (vehicle && vehicle.is_fully_electric) throw new ConflictError('Fully electric vehicles are not accepted');
      if (!vehicle) vehicle = (await client.query('INSERT INTO "Vehicle" ("customerId", "plate", "brand", "model", "year", "isFullyElectric") VALUES ($1,$2,$3,$4,$5,$6) RETURNING "id"', [customer.id, dto.plate, dto.vehicle.brand, dto.vehicle.model, dto.vehicle.year, dto.vehicle.isFullyElectric])).rows[0];
      if (dto.vehicle.isFullyElectric) throw new ConflictError('Fully electric vehicles are not accepted');
       const order = (await client.query('INSERT INTO "WorkOrder" ("vehicleId", "customerId", "receptionistId", "initialComplaint", "status") VALUES ($1,$2,$3,$4,\'RECIBIDO\') RETURNING "id", "vehicleId", "customerId", "status", "initialComplaint", "createdAt"', [vehicle.id, customer.id, receptionistId, dto.initialComplaint])).rows[0];
      await client.query('COMMIT');
      return order;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

export class ConflictError extends Error {}
