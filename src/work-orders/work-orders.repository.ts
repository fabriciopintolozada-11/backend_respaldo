import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { RegisterVehicleEntryDto } from './dto/register-vehicle-entry.dto';

@Injectable()
export class WorkOrdersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async getHistory(plate: string) {
    const result = await this.pool.query(`SELECT v.id, v.plate, v.is_fully_electric, c.id customer_id, c.name customer_name,
      COALESCE(json_agg(json_build_object('id', h.id, 'description', h.description, 'createdAt', h.created_at)
      ORDER BY h.created_at DESC) FILTER (WHERE h.id IS NOT NULL), '[]') history
      FROM vehicles v JOIN customers c ON c.id = v.customer_id LEFT JOIN technical_history h ON h.vehicle_id = v.id
      WHERE v.plate = $1 GROUP BY v.id, c.id`, [plate]);
    if (!result.rows[0]) throw new NotFoundException('Vehicle not found');
    return result.rows[0];
  }

  async create(dto: RegisterVehicleEntryDto, receptionistId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let customer = (await client.query('SELECT id FROM customers WHERE identification = $1 FOR UPDATE', [dto.customer.identification])).rows[0];
      if (!customer) customer = (await client.query('INSERT INTO customers (identification, name, phone) VALUES ($1,$2,$3) RETURNING id', [dto.customer.identification, dto.customer.name, dto.customer.phone ?? null])).rows[0];
      let vehicle = (await client.query('SELECT id, is_fully_electric FROM vehicles WHERE plate = $1 FOR UPDATE', [dto.plate])).rows[0];
      if (vehicle && vehicle.is_fully_electric) throw new ConflictError('Fully electric vehicles are not accepted');
      if (!vehicle) vehicle = (await client.query('INSERT INTO vehicles (customer_id, plate, brand, model, year, is_fully_electric) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [customer.id, dto.plate, dto.vehicle.brand, dto.vehicle.model, dto.vehicle.year, dto.vehicle.isFullyElectric])).rows[0];
      if (dto.vehicle.isFullyElectric) throw new ConflictError('Fully electric vehicles are not accepted');
      const order = (await client.query('INSERT INTO work_orders (vehicle_id, customer_id, receptionist_id, initial_complaint, status) VALUES ($1,$2,$3,$4,\'OPEN\') RETURNING id, vehicle_id, customer_id, status, initial_complaint, created_at', [vehicle.id, customer.id, receptionistId, dto.initialComplaint])).rows[0];
      await client.query('COMMIT');
      return order;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

export class ConflictError extends Error {}
