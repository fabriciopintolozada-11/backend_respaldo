import { mockDb } from './mock-db';
import type {
  Bay,
  BayStatus,
  Mechanic,
  StatusHistoryEntry,
  WorkOrder,
  WorkOrderLaborItem,
  WorkOrderPartItem,
  WorkOrderStatus,
  WorkshopMetrics,
} from '../types/workshop';

export const HOURLY_RATE_BOB = 120;

const VALID_STATE_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  REGISTRADA: ['EN_DIAGNOSTICO', 'CANCELADA'],
  EN_DIAGNOSTICO: ['DIAGNOSTICADA', 'CANCELADA'],
  DIAGNOSTICADA: ['PRESUPUESTADA', 'CANCELADA'],
  PRESUPUESTADA: ['APROBADA', 'CANCELADA'],
  APROBADA: ['EN_PROGRESO', 'EN_ESPERA_REPUESTO', 'CANCELADA'],
  EN_PROGRESO: ['EN_ESPERA_REPUESTO', 'FINALIZADA', 'CANCELADA'],
  EN_ESPERA_REPUESTO: ['EN_PROGRESO', 'FINALIZADA', 'CANCELADA'],
  FINALIZADA: ['ENTREGADA'],
  ENTREGADA: [],
  CANCELADA: [],
};

export interface DiagnosticPayload {
  diagnosticReport: string;
  mechanicNotes?: string;
  laborItems: Array<{
    description: string;
    estimatedHours: number;
    assignedMechanicId?: string;
  }>;
  partsItems: Array<{
    partId: string;
    quantityRequired: number;
  }>;
}

function resolveOrderKey(orderId: string): WorkOrder | null {
  const orders = mockDb.getWorkOrders();
  return orders.find((o) => o.id === orderId || o.code === orderId) || null;
}

function persistOrder(updated: WorkOrder): WorkOrder {
  const orders = mockDb.getWorkOrders();
  const idx = orders.findIndex((o) => o.id === updated.id);
  orders[idx] = updated;
  mockDb.saveWorkOrders(orders);
  return updated;
}

export const workshopService = {
  getAllWorkOrders(): WorkOrder[] {
    return mockDb.getWorkOrders();
  },

  getWorkOrderById(orderId: string): WorkOrder | null {
    return resolveOrderKey(orderId);
  },

  getAllBays(): Bay[] {
    return mockDb.getBays();
  },

  getAllMechanics(): Mechanic[] {
    return mockDb.getMechanics();
  },

  getAllInventory() {
    return mockDb.getInventory();
  },

  getMetrics(): WorkshopMetrics {
    const bays = mockDb.getBays();
    const mechanics = mockDb.getMechanics();
    const orders = mockDb.getWorkOrders();

    const occupiedBays = bays.filter((b) => b.status === 'OCUPADA').length;
    const waitingPartsBays = bays.filter((b) => b.status === 'ESPERA_REPUESTO').length;
    const freeBays = bays.filter((b) => b.status === 'LIBRE').length;
    const activeWorkOrdersCount = orders.filter(
      (o) =>
        o.status === 'EN_PROGRESO' ||
        o.status === 'EN_ESPERA_REPUESTO' ||
        o.status === 'APROBADA' ||
        o.status === 'EN_DIAGNOSTICO',
    ).length;
    const enDiagnosticoCount = orders.filter((o) => o.status === 'EN_DIAGNOSTICO').length;
    const mechanicsActive = mechanics.filter((m) => m.currentBayId !== undefined).length;
    const rate = Math.round(((occupiedBays + waitingPartsBays) / bays.length) * 100);

    return {
      totalBays: bays.length,
      occupiedBays,
      waitingPartsBays,
      freeBays,
      bayOccupancyRatePercent: rate,
      activeWorkOrdersCount,
      mechanicsActive,
      totalMechanics: mechanics.length,
      enDiagnosticoCount,
    };
  },

  assignBayAndMechanic(
    orderId: string,
    bayId: number,
    primaryMechanicId: string,
    assistantMechanicId?: string,
  ): WorkOrder {
    const order = resolveOrderKey(orderId);
    if (!order) throw new Error('Orden de trabajo no encontrada');

    const bays = mockDb.getBays();
    const bayIdx = bays.findIndex((b) => b.id === bayId);
    if (bayIdx === -1) throw new Error('Bahía no válida');

    const targetBay = bays[bayIdx];
    if (targetBay.status === 'OCUPADA' && targetBay.currentWorkOrderId !== order.code) {
      throw new Error(`La ${targetBay.name} ya está ocupada por la OT ${targetBay.currentWorkOrderId}`);
    }

    const assigned = order.assignedBayId;
    if (assigned && assigned !== bayId) {
      const previousBay = bays.find((b) => b.id === assigned);
      if (previousBay && previousBay.currentWorkOrderId === order.code) {
        bays[assigned - 1] = {
          ...previousBay,
          status: 'LIBRE',
          currentWorkOrderId: undefined,
          currentVehiclePlate: undefined,
          currentVehicleModel: undefined,
          primaryMechanicId: undefined,
          assistantMechanicId: undefined,
        };
      }
    }

    bays[bayIdx] = {
      ...targetBay,
      status: order.status === 'EN_ESPERA_REPUESTO' ? 'ESPERA_REPUESTO' : 'OCUPADA',
      currentWorkOrderId: order.code,
      currentVehiclePlate: order.vehiclePlate,
      currentVehicleModel: `${order.vehicleBrand} ${order.vehicleModel}`,
      primaryMechanicId,
      assistantMechanicId,
      startedAt: new Date().toISOString(),
    };
    mockDb.saveBays(bays);

    const updatedOrder: WorkOrder = {
      ...order,
      assignedBayId: bayId,
      primaryMechanicId,
      assistantMechanicId,
    };

    this.updateMechanicCounts();

    return persistOrder(updatedOrder);
  },

  updateBayStatus(bayId: number, status: BayStatus, notes?: string): Bay {
    const bays = mockDb.getBays();
    const idx = bays.findIndex((b) => b.id === bayId);
    if (idx === -1) throw new Error('Bahía no encontrada');

    const updated: Bay = {
      ...bays[idx],
      status,
      notes: notes ?? bays[idx].notes,
    };

    if (status === 'LIBRE') {
      updated.currentWorkOrderId = undefined;
      updated.currentVehiclePlate = undefined;
      updated.currentVehicleModel = undefined;
      updated.primaryMechanicId = undefined;
      updated.assistantMechanicId = undefined;
    }

    bays[idx] = updated;
    mockDb.saveBays(bays);
    return updated;
  },

  updateStatus(orderId: string, newStatus: WorkOrderStatus, changedBy: string, reason?: string): WorkOrder {
    const order = resolveOrderKey(orderId);
    if (!order) throw new Error('Orden de trabajo no encontrada');

    const allowed = VALID_STATE_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Transición no permitida: no se puede cambiar de ${order.status} a ${newStatus}. Siguientes estados válidos: ${allowed.join(', ')}`,
      );
    }

    if (newStatus === 'EN_PROGRESO' && order.status !== 'APROBADA' && order.status !== 'EN_ESPERA_REPUESTO') {
      throw new Error('Regla RN-02: La orden debe ser aprobada explícitamente por el cliente antes de iniciar trabajos.');
    }

    if (newStatus === 'EN_PROGRESO' && order.isSuspendedForAdditionalWork) {
      throw new Error(
        'Regla RN-03: La orden está suspendida debido a detección de trabajos adicionales pendientes de aprobación del cliente.',
      );
    }

    const historyEntry: StatusHistoryEntry = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      changedBy,
      reason,
    };

    const updatedOrder: WorkOrder = {
      ...order,
      status: newStatus,
      statusHistory: [historyEntry, ...order.statusHistory],
      completedAt: newStatus === 'FINALIZADA' ? new Date().toISOString() : order.completedAt,
      deliveredAt: newStatus === 'ENTREGADA' ? new Date().toISOString() : order.deliveredAt,
    };

    if ((newStatus === 'FINALIZADA' || newStatus === 'ENTREGADA' || newStatus === 'CANCELADA') && order.assignedBayId) {
      const bays = mockDb.getBays();
      const bayIdx = bays.findIndex((b) => b.id === order.assignedBayId);
      if (bayIdx >= 0 && bays[bayIdx].currentWorkOrderId === order.code) {
        bays[bayIdx] = {
          ...bays[bayIdx],
          status: 'LIBRE',
          currentWorkOrderId: undefined,
          currentVehiclePlate: undefined,
          currentVehicleModel: undefined,
          primaryMechanicId: undefined,
          assistantMechanicId: undefined,
        };
        mockDb.saveBays(bays);
      }
    }

    const persisted = persistOrder(updatedOrder);
    this.updateMechanicCounts();
    return persisted;
  },

  startDiagnostic(orderId: string, changedBy: string): WorkOrder {
    return this.updateStatus(orderId, 'EN_DIAGNOSTICO', changedBy, 'Inicio de diagnóstico técnico inicial (HU-02).');
  },

  saveDiagnosticDraft(
    orderId: string,
    payload: { diagnosticReport?: string; mechanicNotes?: string },
    changedBy: string,
  ): WorkOrder {
    const order = resolveOrderKey(orderId);
    if (!order) throw new Error('Orden de trabajo no encontrada');

    const status: WorkOrderStatus =
      order.status === 'REGISTRADA' || order.status === 'EN_DIAGNOSTICO'
        ? 'EN_DIAGNOSTICO'
        : order.status;

    const historyEntry: StatusHistoryEntry = {
      status,
      timestamp: new Date().toISOString(),
      changedBy,
      reason: 'Borrador de diagnóstico técnico guardado (HU-02).',
    };

    const updatedOrder: WorkOrder = {
      ...order,
      status,
      diagnosticReport: payload.diagnosticReport ?? order.diagnosticReport,
      mechanicNotes: payload.mechanicNotes ?? order.mechanicNotes,
      statusHistory:
        order.status === status ? order.statusHistory : [historyEntry, ...order.statusHistory],
    };

    return persistOrder(updatedOrder);
  },

  completeDiagnostic(orderId: string, payload: DiagnosticPayload, changedBy: string): WorkOrder {
    const order = resolveOrderKey(orderId);
    if (!order) throw new Error('Orden de trabajo no encontrada');

    if (!payload.diagnosticReport.trim()) {
      throw new Error('El informe de diagnóstico es obligatorio.');
    }

    const inventory = mockDb.getInventory();
    const newParts: WorkOrderPartItem[] = payload.partsItems.map((p, i) => {
      const inv = inventory.find((item) => item.id === p.partId || item.code === p.partId);
      if (!inv) throw new Error(`Repuesto ${p.partId} no encontrado en inventario.`);
      if (inv.stockAvailable < p.quantityRequired) {
        throw new Error(
          `Stock insuficiente para ${inv.name}. Disponible: ${inv.stockAvailable}, Requerido: ${p.quantityRequired}`,
        );
      }
      return {
        id: `pot-dg-${Date.now()}-${i}`,
        partId: inv.id,
        partCode: inv.code,
        description: inv.name,
        quantityRequired: p.quantityRequired,
        quantityUsed: 0,
        unitPriceBOB: inv.unitPriceBOB,
        totalBOB: inv.unitPriceBOB * p.quantityRequired,
        isReserved: true,
        isDeliveredToBay: false,
        status: 'RESERVADO',
      };
    });

    inventory.forEach((inv) => {
      const selected = payload.partsItems.find((p) => p.partId === inv.id || p.partId === inv.code);
      if (selected) {
        inv.stockReserved += selected.quantityRequired;
      }
    });
    mockDb.saveInventory(inventory);

    const newLabor: WorkOrderLaborItem[] = payload.laborItems.map((l, i) => ({
      id: `lab-dg-${Date.now()}-${i}`,
      description: l.description,
      estimatedHours: l.estimatedHours,
      hourlyRateBOB: HOURLY_RATE_BOB,
      totalBOB: Math.round(l.estimatedHours * HOURLY_RATE_BOB),
      isCompleted: false,
      assignedMechanicId: l.assignedMechanicId,
    }));

    const updatedLabor = [...order.laborItems, ...newLabor];
    const updatedParts = [...order.partsItems, ...newParts];
    const totalLabor = updatedLabor.reduce((acc, curr) => acc + curr.totalBOB, 0);
    const totalParts = updatedParts.reduce((acc, curr) => acc + curr.totalBOB, 0);

    const now = new Date().toISOString();
    const historyEntry: StatusHistoryEntry = {
      status: 'DIAGNOSTICADA',
      timestamp: now,
      changedBy,
      reason: 'Diagnóstico técnico inicial registrado (HU-02).',
    };

    const updatedOrder: WorkOrder = {
      ...order,
      status: 'DIAGNOSTICADA',
      diagnosticReport: payload.diagnosticReport,
      diagnosticDate: now,
      mechanicNotes: payload.mechanicNotes ?? order.mechanicNotes,
      laborItems: updatedLabor,
      partsItems: updatedParts,
      totalLaborBOB: totalLabor,
      totalPartsBOB: totalParts,
      totalGeneralBOB: totalLabor + totalParts,
      statusHistory: [historyEntry, ...order.statusHistory],
    };

    return persistOrder(updatedOrder);
  },

  toggleLaborCompletion(orderId: string, laborId: string): WorkOrder {
    const order = resolveOrderKey(orderId);
    if (!order) throw new Error('Orden no encontrada');

    const laborItems = order.laborItems.map((l) =>
      l.id === laborId ? { ...l, isCompleted: !l.isCompleted } : l,
    );

    return persistOrder({ ...order, laborItems });
  },

  confirmPartInstalled(orderId: string, partItemId: string): WorkOrder {
    const order = resolveOrderKey(orderId);
    if (!order) throw new Error('Orden no encontrada');

    const partItem = order.partsItems.find((p) => p.id === partItemId);
    if (!partItem) throw new Error('Repuesto en OT no encontrado');

    const inventory = mockDb.getInventory();
    const invIdx = inventory.findIndex((i) => i.id === partItem.partId || i.code === partItem.partCode);
    if (invIdx >= 0) {
      const inv = inventory[invIdx];
      inventory[invIdx] = {
        ...inv,
        stockAvailable: Math.max(0, inv.stockAvailable - partItem.quantityRequired),
        stockReserved: Math.max(0, inv.stockReserved - partItem.quantityRequired),
        lastMovementDate: new Date().toISOString().split('T')[0],
        daysWithoutMovement: 0,
      };
      mockDb.saveInventory(inventory);
    }

    const partsItems = order.partsItems.map((p) =>
      p.id === partItemId
        ? { ...p, quantityUsed: p.quantityRequired, status: 'INSTALADO' as const, isDeliveredToBay: true }
        : p,
    );

    return persistOrder({ ...order, partsItems });
  },

  updateMechanicCounts(): void {
    const bays = mockDb.getBays();
    const mechanics = mockDb.getMechanics().map((m) => {
      const bay = bays.find((b) => b.primaryMechanicId === m.id || b.assistantMechanicId === m.id);
      return {
        ...m,
        activeOtCount: bays.filter(
          (b) => b.primaryMechanicId === m.id || b.assistantMechanicId === m.id,
        ).length,
        currentBayId: bay?.id,
      };
    });
    mockDb.saveMechanics(mechanics);
  },
};