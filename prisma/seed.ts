import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.technicalHistory.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();

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

  const mechanicA = '11111111-1111-1111-1111-111111111111';
  const mechanicB = '22222222-2222-2222-2222-222222222222';

  const workOrders = await Promise.all(
    vehicles.map((vehicle, index) =>
      prisma.workOrder.create({
        data: {
          vehicleId: vehicle.id,
          customerId: customers[index].id,
          receptionistId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
          initialComplaint: `Revisión general de ejemplo ${index + 1}`,
          status: 'RECIBIDO',
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
