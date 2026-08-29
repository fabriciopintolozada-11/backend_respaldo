// Los Fratelli - Taller Mecánico
// Mock backend con JSON Server para la HU-02 (Consultar estado del vehículo / RN-17).
// Expone el contrato BE-22: GET /api/v1/public/vehicle-status?plate=<placa>&identification=<documento>
const path = require('node:path');
const jsonServer = require('json-server');

const PORT = Number(process.env.MOCK_API_PORT ?? 3000);
const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults({ logger: true });

const READY_FOR_PICKUP_STATUSES = ['FINALIZADO', 'LISTO_ENTREGA'];

server.use(middlewares);

// RN-17 / BE-22: consulta pública sin autenticación usando placa + documento de identidad.
// Si no existe una OT vigente para esos datos responde 404 con el cuerpo de error estandarizado (BE-26).
server.get('/api/v1/public/vehicle-status', (req, res) => {
  const plate = String(req.query.plate ?? '').trim().toUpperCase();
  const identification = String(req.query.identification ?? '').trim();

  const { clients = [], vehicles = [], workOrders = [] } = router.db.getState();

  const vehicle = vehicles.find((v) => String(v.plate).trim().toUpperCase() === plate);
  const client = clients.find((c) => String(c.identification).trim() === identification);
  const workOrder = workOrders.find(
    (wo) => wo.vehicleId === vehicle?.id && wo.clientId === client?.id,
  );

  if (!workOrder) {
    return res.status(404).json({
      statusCode: 404,
      message: 'No valid work order found for the provided data',
      path: '/api/v1/public/vehicle-status',
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    workOrderId: workOrder.id,
    plate: vehicle.plate,
    vehicle: { brand: vehicle.brand, model: vehicle.model, year: vehicle.year },
    customerName: client.fullName,
    initialComplaint: workOrder.initialComplaint,
    createdAt: workOrder.createdAt,
    status: workOrder.status,
    stage: workOrder.stage,
    readyForPickup: READY_FOR_PICKUP_STATUSES.includes(workOrder.status),
  });
});

server.use(router);

server.listen(PORT, () => {
  console.log(`[mock-api] JSON Server (Los Fratelli) escuchando en http://localhost:${PORT}`);
  console.log(
    `[mock-api] Probar HU-02: http://localhost:${PORT}/api/v1/public/vehicle-status?plate=EX0001&identification=SEED-001`,
  );
});