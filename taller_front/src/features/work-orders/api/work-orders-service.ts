import { apiClient, type ApiResponse, isBackendMode } from '../../../shared/api/api-client';
import { mockDb } from '../../../shared/api/mock-db';
import type { WorkOrder, WorkOrderStatus, StatusHistoryEntry, WorkOrderLaborItem, WorkOrderPartItem } from '../../../shared/types/openapi';
import type { AssignedWorkOrder, AssignedWorkOrderDetail, ListResponse, VehicleStatus, WorkOrderListItem } from '../../../shared/api/schema.gen';

const VALID_STATE_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  REGISTRADA: ['DIAGNOSTICADA', 'CANCELADA'],
  DIAGNOSTICADA: ['PRESUPUESTADA', 'CANCELADA'],
  PRESUPUESTADA: ['APROBADA', 'CANCELADA'],
  APROBADA: ['EN_PROGRESO', 'EN_ESPERA_REPUESTO', 'CANCELADA'],
  EN_PROGRESO: ['EN_ESPERA_REPUESTO', 'FINALIZADA', 'CANCELADA'],
  EN_ESPERA_REPUESTO: ['EN_PROGRESO', 'FINALIZADA', 'CANCELADA'],
  FINALIZADA: ['ENTREGADA'],
  ENTREGADA: [],
  CANCELADA: [],
};

const mapListItem = (item: WorkOrderListItem): WorkOrder => ({
  id: item.id, code: `OT-${item.id.slice(0, 8).toUpperCase()}`, vehiclePlate: item.plate, vehicleBrand: item.vehicleBrand,
  vehicleModel: item.vehicleModel, vehicleYear: item.vehicleYear, clientName: item.customerName,
  clientDocument: item.customerIdentification, clientPhone: '', status: item.status as WorkOrderStatus,
  entryDate: item.createdAt, entryReason: item.initialComplaint, laborItems: [], partsItems: [],
  totalLaborBOB: 0, totalPartsBOB: 0, totalGeneralBOB: 0, lastClientContactDate: item.createdAt.slice(0, 10),
  daysWithoutClientResponse: 0, hasPendingAdditionalWork: false, isSuspendedForAdditionalWork: false,
  primaryMechanicId: item.mechanicId ?? undefined, statusHistory: [],
});

const mapAssignedItem = (item: AssignedWorkOrder | AssignedWorkOrderDetail): WorkOrder => {
  const vehicle = 'vehicle' in item ? item.vehicle : undefined;
  return {
    id: item.id, code: `OT-${item.id.slice(0, 8).toUpperCase()}`, vehiclePlate: vehicle?.plate ?? item.plate, vehicleBrand: vehicle?.brand ?? '',
    vehicleModel: vehicle?.model ?? '', vehicleYear: vehicle?.year ?? new Date().getFullYear(), clientName: '',
    clientDocument: '', clientPhone: '', status: item.status as WorkOrderStatus,
    entryDate: item.assignedAt ?? new Date().toISOString(), entryReason: item.initialComplaint,
    laborItems: [], partsItems: [], totalLaborBOB: 0, totalPartsBOB: 0, totalGeneralBOB: 0,
    lastClientContactDate: new Date().toISOString().slice(0, 10), daysWithoutClientResponse: 0,
    hasPendingAdditionalWork: false, isSuspendedForAdditionalWork: false, statusHistory: [],
  };
};

const mapPublicStatus = (status: VehicleStatus): WorkOrder => ({
  id: status.workOrderId, code: `OT-${status.workOrderId.slice(0, 8).toUpperCase()}`, vehiclePlate: status.plate,
  vehicleBrand: status.vehicle.brand, vehicleModel: status.vehicle.model, vehicleYear: status.vehicle.year,
  clientName: status.customerName, clientDocument: '', clientPhone: '', status: status.status as WorkOrderStatus,
  entryDate: status.createdAt, entryReason: status.initialComplaint, laborItems: [], partsItems: [],
  totalLaborBOB: 0, totalPartsBOB: 0, totalGeneralBOB: 0, lastClientContactDate: status.createdAt.slice(0, 10),
  daysWithoutClientResponse: 0, hasPendingAdditionalWork: false, isSuspendedForAdditionalWork: false,
  statusHistory: [],
});

export const workOrdersService = {
  async getAll(): Promise<ApiResponse<WorkOrder[]>> {
    if (isBackendMode) {
      const response = await apiClient.getHttp<ListResponse<WorkOrderListItem>>('/work-orders?page=1&pageSize=100');
      return { ...response, data: response.data.data.map(mapListItem) };
    }
    return apiClient.get(() => mockDb.getWorkOrders());
  },

  async getAssigned(): Promise<ApiResponse<WorkOrder[]>> {
    if (isBackendMode) {
      const response = await apiClient.getHttp<ListResponse<AssignedWorkOrder>>('/work-orders/assigned?page=1&pageSize=100');
      return { ...response, data: response.data.data.map(mapAssignedItem) };
    }
    return apiClient.get(() => mockDb.getWorkOrders());
  },

  async getById(id: string): Promise<ApiResponse<WorkOrder | null>> {
    return apiClient.get(() => {
      const orders = mockDb.getWorkOrders();
      return orders.find((o) => o.id === id || o.code === id) || null;
    });
  },

  async getByPlateAndDocument(plate: string, document: string): Promise<ApiResponse<WorkOrder | null>> {
    if (isBackendMode) {
      const response = await apiClient.getHttp<VehicleStatus>(`/public/vehicle-status?plate=${encodeURIComponent(plate)}&identification=${encodeURIComponent(document)}`);
      return { ...response, data: mapPublicStatus(response.data) };
    }
    return apiClient.get(() => {
      const orders = mockDb.getWorkOrders();
      const normPlate = plate.trim().toUpperCase().replace(/\s+/g, '');
      const normDoc = document.trim().toUpperCase().replace(/\s+/g, '');

      const match = orders.find((o) => {
        const oPlate = o.vehiclePlate.toUpperCase().replace(/\s+/g, '');
        const oDoc = o.clientDocument.toUpperCase().replace(/\s+/g, '');
        return oPlate.includes(normPlate) && oDoc.includes(normDoc);
      });

      return match || null;
    });
  },

  async createVehicleEntry(payload: {
    plate: string;
    customer: { identification: string; name: string; phone: string };
    vehicle: { brand: string; model: string; year: number; isFullyElectric: boolean };
    initialComplaint: string;
  }): Promise<ApiResponse<WorkOrder>> {
    if (!isBackendMode) {
      return this.createOrder({
        vehiclePlate: payload.plate, vehicleBrand: payload.vehicle.brand, vehicleModel: payload.vehicle.model,
        vehicleYear: payload.vehicle.year, clientName: payload.customer.name, clientDocument: payload.customer.identification,
        clientPhone: payload.customer.phone, entryReason: payload.initialComplaint,
      });
    }
    const response = await apiClient.postHttp<typeof payload, {
      id: string; vehicleId: string; customerId: string; status: string; initialComplaint: string; createdAt: string;
    }>('/work-orders', payload);
    return { ...response, data: mapListItem({
      id: response.data.id, vehicleId: response.data.vehicleId, plate: payload.plate.toUpperCase(),
      vehicleBrand: payload.vehicle.brand, vehicleModel: payload.vehicle.model, vehicleYear: payload.vehicle.year,
      customerName: payload.customer.name, customerIdentification: payload.customer.identification,
      initialComplaint: response.data.initialComplaint, status: response.data.status, createdAt: response.data.createdAt,
      mechanicId: null,
    }) };
  },

  async createOrder(payload: {
    vehiclePlate: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleYear: number;
    clientName: string;
    clientDocument: string;
    clientPhone: string;
    clientEmail?: string;
    entryReason: string;
    estimatedDeliveryDate?: string;
  }): Promise<ApiResponse<WorkOrder>> {
    return apiClient.post((data) => {
      const orders = mockDb.getWorkOrders();
      const nextNum = (orders.length + 101).toString().padStart(4, '0');
      const code = `OT-${new Date().getFullYear()}-${nextNum}`;

      const newOrder: WorkOrder = {
        id: `ot-${Date.now().toString().slice(-4)}`,
        code,
        vehiclePlate: data.vehiclePlate.trim().toUpperCase(),
        vehicleBrand: data.vehicleBrand,
        vehicleModel: data.vehicleModel,
        vehicleYear: data.vehicleYear,
        clientName: data.clientName,
        clientDocument: data.clientDocument,
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail,
        status: 'REGISTRADA',
        entryDate: new Date().toISOString(),
        estimatedDeliveryDate: data.estimatedDeliveryDate,
        entryReason: data.entryReason,
        laborItems: [],
        partsItems: [],
        totalLaborBOB: 0,
        totalPartsBOB: 0,
        totalGeneralBOB: 0,
        lastClientContactDate: new Date().toISOString().split('T')[0],
        daysWithoutClientResponse: 0,
        hasPendingAdditionalWork: false,
        isSuspendedForAdditionalWork: false,
        statusHistory: [
          {
            status: 'REGISTRADA',
            timestamp: new Date().toISOString(),
            changedBy: 'Recepción - Formulario de Ingreso HU-01',
          },
        ],
      };

      orders.unshift(newOrder);
      mockDb.saveWorkOrders(orders);
      return newOrder;
    }, payload);
  },

  async updateStatus(
    orderId: string,
    newStatus: WorkOrderStatus,
    changedBy: string,
    reason?: string
  ): Promise<ApiResponse<WorkOrder>> {
    return apiClient.post((_) => {
      const orders = mockDb.getWorkOrders();
      const idx = orders.findIndex((o) => o.id === orderId || o.code === orderId);
      if (idx === -1) throw new Error('Orden de trabajo no encontrada');

      const order = orders[idx];

      // Validate transition
      const allowed = VALID_STATE_TRANSITIONS[order.status];
      if (!allowed.includes(newStatus)) {
        throw new Error(
          `Transición no permitida: no se puede cambiar de ${order.status} a ${newStatus}. Siguientes estados válidos: ${allowed.join(', ')}`
        );
      }

      // Check RN-02: Para pasar a EN_PROGRESO debe estar APROBADA
      if (newStatus === 'EN_PROGRESO' && order.status !== 'APROBADA' && order.status !== 'EN_ESPERA_REPUESTO') {
        throw new Error('Regla RN-02: La orden debe ser aprobada explícitamente por el cliente antes de iniciar trabajos.');
      }

      // Check RN-03: No puede avanzar si está suspendida por trabajos adicionales
      if (newStatus === 'EN_PROGRESO' && order.isSuspendedForAdditionalWork) {
        throw new Error(
          'Regla RN-03: La orden está suspendida debido a detección de trabajos adicionales pendientes de aprobación del cliente.'
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

      // Si pasa a finalizada o entregada y tenía bahía asignada, liberar la bahía
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
          };
          mockDb.saveBays(bays);
        }
      }

      orders[idx] = updatedOrder;
      mockDb.saveWorkOrders(orders);
      return updatedOrder;
    }, {});
  },

  async assignBayAndMechanic(
    orderId: string,
    bayId: number,
    primaryMechanicId: string,
    assistantMechanicId?: string
  ): Promise<ApiResponse<WorkOrder>> {
    if (isBackendMode) {
      const response = await apiClient.patchHttp<{ mecanicoId: string }, { id: string; mecanicoId: string; status: string; updatedAt: string }>(
        `/work-orders/${orderId}/assign-mechanic`,
        { mecanicoId: primaryMechanicId },
      );
      const order = await this.getById(response.data.id);
      return order.data
        ? { ...response, data: order.data }
        : { ...response, data: { ...mapListItem({
            id: response.data.id, vehicleId: '', plate: '', vehicleBrand: '', vehicleModel: '', vehicleYear: 0,
            customerName: '', customerIdentification: '', initialComplaint: '', status: response.data.status,
            createdAt: response.data.updatedAt, mechanicId: response.data.mecanicoId,
          }), primaryMechanicId: response.data.mecanicoId } };
    }
    return apiClient.post((_) => {
      const orders = mockDb.getWorkOrders();
      const idx = orders.findIndex((o) => o.id === orderId || o.code === orderId);
      if (idx === -1) throw new Error('Orden de trabajo no encontrada');

      const order = orders[idx];
      const bays = mockDb.getBays();
      const bayIdx = bays.findIndex((b) => b.id === bayId);
      if (bayIdx === -1) throw new Error('Bahía no válida');

      const mechanics = mockDb.getMechanics();
      const primaryMechanic = mechanics.find((m) => m.id === primaryMechanicId);
      if (!primaryMechanic) throw new Error('Mecánico principal no encontrado');
      if (assistantMechanicId && assistantMechanicId === primaryMechanicId) {
        throw new Error('El ayudante debe ser distinto al mecánico principal');
      }
      if (assistantMechanicId && !mechanics.some((m) => m.id === assistantMechanicId)) {
        throw new Error('Ayudante técnico no encontrado');
      }
      if (order.assignedBayId && order.assignedBayId !== bayId) {
        throw new Error(`La orden ya está asignada a la bahía ${order.assignedBayId}`);
      }

      const targetBay = bays[bayIdx];
      if (targetBay.status === 'OCUPADA' && targetBay.currentWorkOrderId !== order.code) {
        throw new Error(`La ${targetBay.name} ya está ocupada por la OT ${targetBay.currentWorkOrderId}`);
      }

      // Update Bay
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

      // Update Order
      const updatedOrder: WorkOrder = {
        ...order,
        assignedBayId: bayId,
        primaryMechanicId,
        assistantMechanicId,
      };

      orders[idx] = updatedOrder;
      mockDb.saveWorkOrders(orders);

      const affectedMechanicIds = new Set(
        [order.primaryMechanicId, order.assistantMechanicId, primaryMechanicId, assistantMechanicId].filter(
          (id): id is string => Boolean(id)
        )
      );
      mockDb.saveMechanics(
        mechanics.map((mechanic) => {
          if (!affectedMechanicIds.has(mechanic.id)) return mechanic;
          const activeOtCount = orders.filter(
            (candidate) =>
              ['REGISTRADA', 'DIAGNOSTICADA', 'PRESUPUESTADA', 'APROBADA', 'EN_PROGRESO', 'EN_ESPERA_REPUESTO'].includes(
                candidate.status
              ) &&
              (candidate.primaryMechanicId === mechanic.id || candidate.assistantMechanicId === mechanic.id)
          ).length;
          const currentAssignment = orders.find(
            (candidate) =>
              candidate.assignedBayId &&
              candidate.primaryMechanicId === mechanic.id &&
              ['APROBADA', 'EN_PROGRESO', 'EN_ESPERA_REPUESTO'].includes(candidate.status)
          );
          return {
            ...mechanic,
            activeOtCount,
            currentBayId: currentAssignment?.assignedBayId,
          };
        })
      );
      return updatedOrder;
    }, {});
  },

  async reportAdditionalWork(
    orderId: string,
    description: string,
    additionalCostBOB: number,
    additionalLaborItems: Omit<WorkOrderLaborItem, 'id' | 'isCompleted'>[],
    additionalParts: Omit<WorkOrderPartItem, 'id' | 'quantityUsed' | 'isReserved' | 'isDeliveredToBay' | 'status'>[]
  ): Promise<ApiResponse<WorkOrder>> {
    return apiClient.post((_) => {
      const orders = mockDb.getWorkOrders();
      const idx = orders.findIndex((o) => o.id === orderId || o.code === orderId);
      if (idx === -1) throw new Error('Orden no encontrada');

      const order = orders[idx];

      // Format new items
      const newLabor: WorkOrderLaborItem[] = additionalLaborItems.map((l, i) => ({
        ...l,
        id: `lab-add-${Date.now()}-${i}`,
        isCompleted: false,
      }));

      const newParts: WorkOrderPartItem[] = additionalParts.map((p, i) => ({
        ...p,
        id: `pot-add-${Date.now()}-${i}`,
        quantityUsed: 0,
        isReserved: true,
        isDeliveredToBay: false,
        status: 'PENDIENTE',
      }));

      const updatedLabor = [...order.laborItems, ...newLabor];
      const updatedParts = [...order.partsItems, ...newParts];

      const totalLabor = updatedLabor.reduce((acc, curr) => acc + curr.totalBOB, 0);
      const totalParts = updatedParts.reduce((acc, curr) => acc + curr.totalBOB, 0);

      // RN-03: Suspensión automática del trabajo
      const updatedOrder: WorkOrder = {
        ...order,
        hasPendingAdditionalWork: true,
        isSuspendedForAdditionalWork: true, // RN-03 flag
        additionalWorkDescription: description,
        additionalWorkCostBOB: additionalCostBOB,
        laborItems: updatedLabor,
        partsItems: updatedParts,
        totalLaborBOB: totalLabor,
        totalPartsBOB: totalParts,
        totalGeneralBOB: totalLabor + totalParts,
        statusHistory: [
          {
            status: order.status,
            timestamp: new Date().toISOString(),
            changedBy: 'Mecánico / Diagnóstico',
            reason: `[SUSPENSIÓN RN-03] Se detectó trabajo adicional: ${description}. Suspensión aplicada.`,
          },
          ...order.statusHistory,
        ],
      };

      orders[idx] = updatedOrder;
      mockDb.saveWorkOrders(orders);
      return updatedOrder;
    }, {});
  },

  async approveAdditionalWork(orderId: string, approvalMethod: 'PORTAL_WEB' | 'WHATSAPP_CONFIRMADO' | 'FIRMA_DIGITAL'): Promise<ApiResponse<WorkOrder>> {
    return apiClient.post((_) => {
      const orders = mockDb.getWorkOrders();
      const idx = orders.findIndex((o) => o.id === orderId || o.code === orderId);
      if (idx === -1) throw new Error('Orden no encontrada');

      const order = orders[idx];
      const updatedOrder: WorkOrder = {
        ...order,
        hasPendingAdditionalWork: false,
        isSuspendedForAdditionalWork: false, // RN-03 cleared!
        clientApprovedAt: new Date().toISOString(),
        clientApprovalMethod: approvalMethod,
        statusHistory: [
          {
            status: order.status,
            timestamp: new Date().toISOString(),
            changedBy: `Cliente (${approvalMethod})`,
            reason: 'Aprobación explícita de trabajos y repuestos adicionales (RN-02, RN-03). Se reanudan trabajos en bahía.',
          },
          ...order.statusHistory,
        ],
      };

      orders[idx] = updatedOrder;
      mockDb.saveWorkOrders(orders);
      return updatedOrder;
    }, {});
  },

  async toggleLaborCompletion(orderId: string, laborId: string): Promise<ApiResponse<WorkOrder>> {
    return apiClient.post((_) => {
      const orders = mockDb.getWorkOrders();
      const idx = orders.findIndex((o) => o.id === orderId || o.code === orderId);
      if (idx === -1) throw new Error('Orden no encontrada');

      const order = orders[idx];
      const laborItems = order.laborItems.map((l) => (l.id === laborId ? { ...l, isCompleted: !l.isCompleted } : l));

      const updatedOrder: WorkOrder = {
        ...order,
        laborItems,
      };

      orders[idx] = updatedOrder;
      mockDb.saveWorkOrders(orders);
      return updatedOrder;
    }, {});
  },

  async confirmPartInstalled(orderId: string, partItemId: string): Promise<ApiResponse<WorkOrder>> {
    return apiClient.post((_) => {
      const orders = mockDb.getWorkOrders();
      const idx = orders.findIndex((o) => o.id === orderId || o.code === orderId);
      if (idx === -1) throw new Error('Orden no encontrada');

      const order = orders[idx];
      const partItem = order.partsItems.find((p) => p.id === partItemId);
      if (!partItem) throw new Error('Repuesto en OT no encontrado');

      // RN-07, RN-08: Descontar de inventario y liberar reserva
      const inventory = mockDb.getInventory();
      const invIdx = inventory.findIndex((i) => i.id === partItem.partId || i.code === partItem.partCode);
      if (invIdx >= 0) {
        const inv = inventory[invIdx];
        const updatedInv = {
          ...inv,
          stockAvailable: Math.max(0, inv.stockAvailable - partItem.quantityRequired),
          stockReserved: Math.max(0, inv.stockReserved - partItem.quantityRequired),
          lastMovementDate: new Date().toISOString().split('T')[0],
          daysWithoutMovement: 0,
        };
        inventory[invIdx] = updatedInv;
        mockDb.saveInventory(inventory);
      }

      const updatedParts = order.partsItems.map((p) =>
        p.id === partItemId
          ? {
              ...p,
              quantityUsed: p.quantityRequired,
              status: 'INSTALADO' as const,
              isDeliveredToBay: true,
            }
          : p
      );

      const updatedOrder: WorkOrder = {
        ...order,
        partsItems: updatedParts,
      };

      orders[idx] = updatedOrder;
      mockDb.saveWorkOrders(orders);
      return updatedOrder;
    }, {});
  },

  async searchPublic(params: { plate: string; identification: string }): Promise<ApiResponse<WorkOrder[]>> {
    if (isBackendMode) {
      const response = await apiClient.getHttp<VehicleStatus>(`/public/vehicle-status?plate=${encodeURIComponent(params.plate)}&identification=${encodeURIComponent(params.identification)}`);
      return { ...response, data: [mapPublicStatus(response.data)] };
    }
    return apiClient.get(() => {
      const orders = mockDb.getWorkOrders();
      const normPlate = params.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normCode = params.identification.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

      return orders.filter((o) => {
        const oPlate = o.vehiclePlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const oCode = o.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

        const plateMatches = oPlate.includes(normPlate) || normPlate.includes(oPlate);
        if (normCode) {
          return plateMatches && (oCode.includes(normCode) || normCode.includes(oCode));
        }
        return plateMatches;
      });
    });
  },
};
