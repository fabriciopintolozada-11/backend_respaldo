import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ── US-00: Usuarios demo (upsert — no borra nada) ────────────────────────
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
  return users;
}

// ── HU-07: Catálogo de repuestos con stock (upsert — no borra nada) ──────
async function createSpareParts() {
  const parts = [
    { code: 'REP-SUS-001', name: 'Amortiguador Delantero a Gas KYB Excel-G', category: 'SUSPENSION', unitPrice: 850.00, physicalStock: 10, reservedStock: 2, availableStock: 8 },
    { code: 'REP-FRE-001', name: 'Pastillas de Freno Cerámicas Delanteras Brembo', category: 'FRENOS', unitPrice: 320.00, physicalStock: 15, reservedStock: 1, availableStock: 14 },
    { code: 'REP-FLT-001', name: 'Filtro de Aceite Blindado Mann-Filter W 68/3', category: 'FILTROS_FLUIDOS', unitPrice: 85.00, physicalStock: 20, reservedStock: 1, availableStock: 19 },
    { code: 'REP-TRA-001', name: 'Kit de Embrague Completo Valeo', category: 'TRANSMISION', unitPrice: 1200.00, physicalStock: 5, reservedStock: 1, availableStock: 4 },
    { code: 'REP-TRA-002', name: 'Aceite de Transmisión Manual 75W-90 Motul 1L', category: 'FILTROS_FLUIDOS', unitPrice: 95.00, physicalStock: 25, reservedStock: 3, availableStock: 22 },
  ];

  const created = await Promise.all(
    parts.map((p) => prisma.sparePart.upsert({
      where: { code: p.code },
      update: { physicalStock: p.physicalStock, reservedStock: p.reservedStock, availableStock: p.availableStock },
      create: p,
    })),
  );
  return created;
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  // 1. Usuarios (upsert — safe)
  await createUsers();
  const mechanicA = '11111111-1111-4111-8111-111111111111'; // mech01
  const mechanicB = '22222222-2222-4222-8222-222222222222'; // mech02
  const receptionistId = '00000000-0000-4000-8000-000000000010'; // recep01

  // 2. Mecánicos (upsert via createMany con skipDuplicates)
  await prisma.mechanic.createMany({
    data: [{ id: mechanicA }, { id: mechanicB }],
    skipDuplicates: true,
  });

  // 3. Repuestos (upsert — safe)
  const spareParts = await createSpareParts();

  // 4. Clientes (upsert por identification)
  const customerData = [
    { identification: 'CI-1000000', name: 'Juan Pérez', phone: '710000000' },
    { identification: 'CI-1000001', name: 'María López', phone: '710000001' },
    { identification: 'CI-1000002', name: 'Carlos García', phone: '710000002' },
    { identification: 'CI-1000003', name: 'Ana Martínez', phone: '710000003' },
  ];

  const customers = await Promise.all(
    customerData.map((c) =>
      prisma.customer.upsert({
        where: { identification: c.identification },
        update: { name: c.name, phone: c.phone },
        create: c,
      }),
    ),
  );

  // 5. Vehículos (upsert por plate)
  const vehicleData = [
    { plate: '4589-KXA', brand: 'Toyota', model: 'Hilux', year: 2022 },
    { plate: '3210-BCD', brand: 'Mazda', model: 'CX-5', year: 2021 },
    { plate: '7745-XYZ', brand: 'Ford', model: 'Ranger', year: 2020 },
    { plate: '1122-QWE', brand: 'Chevrolet', model: 'Spark', year: 2023 },
  ];

  const vehicles = await Promise.all(
    vehicleData.map((v, i) =>
      prisma.vehicle.upsert({
        where: { plate: v.plate },
        update: { brand: v.brand, model: v.model, year: v.year, customerId: customers[i].id },
        create: { customerId: customers[i].id, plate: v.plate, brand: v.brand, model: v.model, year: v.year, isFullyElectric: false },
      }),
    ),
  );

  // 6. Órdenes de trabajo (buscar por vehicleId + status o crear si no existen)
  const wo1 = await prisma.workOrder.findFirst({
    where: { vehicleId: vehicles[0].id, status: 'APROBADO' },
  });
  const workOrder1 = wo1 ?? await prisma.workOrder.create({
    data: {
      vehicleId: vehicles[0].id,
      customerId: customers[0].id,
      receptionistId,
      initialComplaint: 'Ruido extraño al frenar, pastillas desgastadas y amortiguadores con fuga',
      status: 'APROBADO',
      mechanicId: mechanicA,
      assignedAt: new Date('2026-09-01T08:00:00Z'),
    },
  });

  const wo2 = await prisma.workOrder.findFirst({
    where: { vehicleId: vehicles[1].id, status: 'EN_REPARACION' },
  });
  const workOrder2 = wo2 ?? await prisma.workOrder.create({
    data: {
      vehicleId: vehicles[1].id,
      customerId: customers[1].id,
      receptionistId,
      initialComplaint: 'Embrague patina, cambio de Kit de embrague y aceite de transmisión',
      status: 'EN_REPARACION',
      mechanicId: mechanicA,
      assignedAt: new Date('2026-09-02T09:00:00Z'),
    },
  });

  const wo3 = await prisma.workOrder.findFirst({
    where: { vehicleId: vehicles[2].id, status: 'RECIBIDO' },
  });
  const workOrder3 = wo3 ?? await prisma.workOrder.create({
    data: {
      vehicleId: vehicles[2].id,
      customerId: customers[2].id,
      receptionistId,
      initialComplaint: 'Mantenimiento preventivo 50,000 km',
      status: 'RECIBIDO',
    },
  });

  const wo4 = await prisma.workOrder.findFirst({
    where: { vehicleId: vehicles[3].id, status: 'ASIGNADA' },
  });
  const workOrder4 = wo4 ?? await prisma.workOrder.create({
    data: {
      vehicleId: vehicles[3].id,
      customerId: customers[3].id,
      receptionistId,
      initialComplaint: 'Cambio de filtro de aceite urgente',
      status: 'ASIGNADA',
      mechanicId: mechanicB,
      assignedAt: new Date('2026-09-03T10:00:00Z'),
    },
  });

  const workOrders = [workOrder1, workOrder2, workOrder3, workOrder4];

  // 7. Diagnósticos (solo si no existen para esa OT)
  const existingDiag1 = await prisma.diagnostic.findUnique({ where: { workOrderId: workOrders[0].id } });
  if (!existingDiag1) {
    await prisma.diagnostic.create({
      data: {
        workOrderId: workOrders[0].id,
        description: 'Se detectó desgaste avanzado en pastillas delanteras y fuga de aceite en amortiguadores delanteros.',
        suggestedTasks: ['Reemplazar pastillas delanteras', 'Reemplazar amortiguadores delanteros'],
        suggestedPartIds: [spareParts[0].id, spareParts[1].id],
        estimatedHours: 4.5,
      },
    });
  }

  const existingDiag2 = await prisma.diagnostic.findUnique({ where: { workOrderId: workOrders[1].id } });
  if (!existingDiag2) {
    await prisma.diagnostic.create({
      data: {
        workOrderId: workOrders[1].id,
        description: 'Embrague con desgaste severo, disco y prensa dañados. Aceite de transmisión degradado.',
        suggestedTasks: ['Reemplazar kit de embrague', 'Drenar y rellenar aceite de transmisión'],
        suggestedPartIds: [spareParts[3].id, spareParts[4].id],
        estimatedHours: 6.0,
      },
    });
  }

  // 8. Cotizaciones (solo si no existen para esa OT)
  const existingQuote1 = await prisma.quote.findUnique({ where: { workOrderId: workOrders[0].id } });
  const quote1 = existingQuote1 ?? await prisma.quote.create({
    data: {
      workOrderId: workOrders[0].id,
      laborItems: [],
      laborSubtotal: 0,
      total: 2020.00,
      partsSubtotal: 2020.00,
      currency: 'BOB',
    },
  });

  const existingQuote2 = await prisma.quote.findUnique({ where: { workOrderId: workOrders[1].id } });
  const quote2 = existingQuote2 ?? await prisma.quote.create({
    data: {
      workOrderId: workOrders[1].id,
      laborItems: [],
      laborSubtotal: 0,
      total: 1485.00,
      partsSubtotal: 1485.00,
      currency: 'BOB',
    },
  });

  // 9. QuoteParts RESERVED (solo si no existen — usa la unique constraint)
  const quotePartData = [
    { quoteId: quote1.id, sparePartId: spareParts[0].id, quantity: 2, unitPrice: 850.00, subtotal: 1700.00, status: 'RESERVED' },
    { quoteId: quote1.id, sparePartId: spareParts[1].id, quantity: 1, unitPrice: 320.00, subtotal: 320.00, status: 'RESERVED' },
    { quoteId: quote2.id, sparePartId: spareParts[3].id, quantity: 1, unitPrice: 1200.00, subtotal: 1200.00, status: 'RESERVED' },
    { quoteId: quote2.id, sparePartId: spareParts[4].id, quantity: 3, unitPrice: 95.00, subtotal: 285.00, status: 'RESERVED' },
  ];

  for (const qp of quotePartData) {
    const existing = await prisma.quotePart.findUnique({
      where: { quoteId_sparePartId: { quoteId: qp.quoteId, sparePartId: qp.sparePartId } },
    });
    if (!existing) {
      await prisma.quotePart.create({ data: qp });
    }
  }

  // 10. Aprobaciones de cotización (solo si no existen para esa quote)
  const leadUserId = '00000000-0000-4000-8000-000000000040'; // lead01

  const existingApproval1 = await prisma.quoteApproval.findFirst({ where: { quoteId: quote1.id } });
  if (!existingApproval1) {
    await prisma.quoteApproval.create({
      data: { quoteId: quote1.id, decision: 'APROBADA', channel: 'PORTAL_WEB', customerName: 'Juan Pérez', recordedBy: leadUserId },
    });
  }

  const existingApproval2 = await prisma.quoteApproval.findFirst({ where: { quoteId: quote2.id } });
  if (!existingApproval2) {
    await prisma.quoteApproval.create({
      data: { quoteId: quote2.id, decision: 'APROBADA', channel: 'WHATSAPP_CONFIRMADO', customerName: 'María López', recordedBy: leadUserId },
    });
  }

  // 11. Historial técnico (solo si no existe para ese vehículo)
  for (const v of vehicles) {
    const existing = await prisma.technicalHistory.findFirst({ where: { vehicleId: v.id } });
    if (!existing) {
      await prisma.technicalHistory.create({
        data: { vehicleId: v.id, description: 'Mantenimiento preventivo registrado previamente' },
      });
    }
  }

  console.log('✅ Seed completado (additive — sin borrar datos existentes):');
  console.log(`   - 5 usuarios (contraseña: Fratelli2026!)`);
  console.log(`   - ${customers.length} clientes`);
  console.log(`   - ${vehicles.length} vehículos`);
  console.log(`   - ${workOrders.length} órdenes de trabajo`);
  console.log(`   - ${spareParts.length} repuestos en catálogo`);
  console.log(`   - 4 QuoteParts con status RESERVED (para HU-07)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
