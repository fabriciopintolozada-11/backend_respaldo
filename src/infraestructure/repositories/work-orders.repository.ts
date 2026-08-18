import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { RegisterVehicleEntryDto } from '../../presentation/dto/register-vehicle-entry.dto';
import { AssignWorkOrderResponseDto } from '../../presentation/dto/assign-work-order.dto';

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
      let vehicle = (await client.query('SELECT "id", "customerId", "isFullyElectric" FROM "Vehicle" WHERE "plate" = $1 FOR UPDATE', [dto.plate])).rows[0];
      if (vehicle && vehicle.isFullyElectric) throw new ConflictError('Fully electric vehicles are not accepted');
      if (vehicle && vehicle.customerId !== customer.id) throw new ConflictError('Vehicle is registered to another customer');
      if (!vehicle) vehicle = (await client.query('INSERT INTO "Vehicle" ("customerId", "plate", "brand", "model", "year", "isFullyElectric") VALUES ($1,$2,$3,$4,$5,$6) RETURNING "id"', [customer.id, dto.plate, dto.vehicle.brand, dto.vehicle.model, dto.vehicle.year, dto.vehicle.isFullyElectric])).rows[0];
      if (dto.vehicle.isFullyElectric) throw new ConflictError('Fully electric vehicles are not accepted');
       const order = (await client.query('INSERT INTO "WorkOrder" ("vehicleId", "customerId", "receptionistId", "initialComplaint", "status") VALUES ($1,$2,$3,$4,\'RECIBIDO\') RETURNING "id", "vehicleId", "customerId", "status", "initialComplaint", "createdAt"', [vehicle.id, customer.id, receptionistId, dto.initialComplaint])).rows[0];
      await client.query('COMMIT');
      return order;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async assign(workOrderId: string, mechanicId: string): Promise<AssignWorkOrderResponseDto> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const workOrder = (
        await client.query<{ id: string; mechanicId: string | null; status: string }>(
          'SELECT "id", "mechanicId", "status" FROM "WorkOrder" WHERE "id" = $1 FOR UPDATE',
          [workOrderId],
        )
      ).rows[0];

      if (!workOrder) throw new WorkOrderNotFoundError('Work order not found');
      if (workOrder.mechanicId) throw new WorkOrderAlreadyAssignedError('Work order is already assigned');
      if (workOrder.status !== 'RECIBIDO') {
        throw new WorkOrderNotAssignableError('Work order is not in an assignable state');
      }

      const mechanic = (
        await client.query<{ id: string; isActive: boolean }>(
          'SELECT "id", "isActive" FROM "Mechanic" WHERE "id" = $1 FOR SHARE',
          [mechanicId],
        )
      ).rows[0];

      if (!mechanic) throw new MechanicNotFoundError('Mechanic not found');
      if (!mechanic.isActive) throw new MechanicUnavailableError('Mechanic cannot receive work orders');

      const assignedOrder = (
        await client.query<AssignWorkOrderResponseDto>(
          `UPDATE "WorkOrder"
           SET "mechanicId" = $2, "assignedAt" = CURRENT_TIMESTAMP, "status" = 'ASIGNADA',
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $1
           RETURNING "id", "mechanicId" AS "mecanicoId", "status", "updatedAt"`,
          [workOrderId, mechanicId],
        )
      ).rows[0];

      if (!assignedOrder) throw new WorkOrderNotFoundError('Work order not found');
      await client.query('COMMIT');
      return assignedOrder;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the business error when the transaction cannot be rolled back.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

export class ConflictError extends Error {}
export class WorkOrderNotFoundError extends Error {}
export class WorkOrderNotAssignableError extends Error {}
export class WorkOrderAlreadyAssignedError extends Error {}
export class MechanicNotFoundError extends Error {}
export class MechanicUnavailableError extends Error {}
