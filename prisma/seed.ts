import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import 'dotenv/config';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// US-00 / BE-T00.2: demo users for authentication (argon2 hashed passwords).
async function createUsers() {
  const password = 'Fratelli2026!';
  const hash = await argon2.hash(password);

  const users = [
    { id: '00000000-0000-4000-8000-000000000010', username: 'recep01', fullName: 'Recepcionista Uno', role: 'RECEPTIONIST' },
    { id: '11111111-1111-4111-8111-111111111111', username: 'mech01', fullName: 'Mecánico Uno', role: 'MECHANIC' },
    { id: '22222222-2222-4222-8222-222222222222', username: 'mech02', fullName: 'Mecánico Dos', role: 'MECHANIC' },
    { id: '00000000-0000-4000-8000-000000000040', username: 'lead01', fullName: 'Jefe de Taller', role: 'WORKSHOP_LEAD' },
    { id: '00000000-0000-4000-8000-000000000050', username: 'admin01', fullName: 'Administrador', role: 'ADMIN' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: { passwordHash: hash, fullName: user.fullName, role: user.role, isActive: true },
      create: { id: user.id, username: user.username, passwordHash: hash, fullName: user.fullName, role: user.role, isActive: true },
    });
  }
}

async function main() {
  await prisma.technicalHistory.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.mechanic.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  await createUsers();

  const customers = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      prisma.customer.create({
        data: {
          identification: `SEED-${String(index + 1).padStart(3, '0')}`,
          name: `Cliente de ejemplo ${index + 1}`,
          phone: `300555${String(index + 1).padStart(4, '0')}`,
        },
      }),
    ),
  );

  const vehicles = await Promise.all(
    customers.map((customer, index) =>
      prisma.vehicle.create({
        data: {
          customerId: customer.id,
          plate: `EX${String(index + 1).padStart(4, '0')}`,
          brand: ['Toyota', 'Mazda', 'Ford', 'Chevrolet', 'Renault'][index % 5],
          model: `Modelo ${index + 1}`,
          year: 2015 + (index % 10),
          isFullyElectric: false,
        },
      }),
    ),
  );

  // UUID v4 values are required by the assignment DTO validation.
  const mechanicA = '11111111-1111-4111-8111-111111111111';
  const mechanicB = '22222222-2222-4222-8222-222222222222';

  await prisma.mechanic.createMany({
    data: [{ id: mechanicA }, { id: mechanicB }],
  });

  const workOrders = await Promise.all(
    vehicles.map((vehicle, index) =>
      prisma.workOrder.create({
        data: {
          vehicleId: vehicle.id,
          customerId: customers[index].id,
          receptionistId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
          initialComplaint: `Revisión general de ejemplo ${index + 1}`,
          status: index % 3 === 2 ? 'RECIBIDO' : 'ASIGNADA',
          mechanicId: index % 3 === 0 ? mechanicA : index % 3 === 1 ? mechanicB : null,
          assignedAt: index % 3 === 2 ? null : new Date(),
        },
      }),
    ),
  );

  await Promise.all(
    vehicles.map((vehicle, index) =>
      prisma.technicalHistory.create({
        data: {
          vehicleId: vehicle.id,
          description: `Historial técnico de ejemplo ${index + 1}`,
        },
      }),
    ),
  );

  console.log(`Seed creado: ${customers.length} clientes, ${vehicles.length} vehículos, ${workOrders.length} órdenes y 10 historiales técnicos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
