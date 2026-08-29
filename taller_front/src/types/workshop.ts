/**
 * Tipos del dominio del Taller Mecánico "Los Fratelli".
 * Modelados a partir del diseño de referencia (HU-02: Gestión/Diagnóstico,
 * Asignación de Bahías y Asignación de OTs).
 *
 * Todos los importes monetarios se expresan en Bolivianos (BOB).
 */

export type WorkOrderStatus =
  | 'REGISTRADA'
  | 'EN_DIAGNOSTICO'
  | 'DIAGNOSTICADA'
  | 'PRESUPUESTADA'
  | 'APROBADA'
  | 'EN_PROGRESO'
  | 'EN_ESPERA_REPUESTO'
  | 'FINALIZADA'
  | 'ENTREGADA'
  | 'CANCELADA';

export type BayStatus = 'LIBRE' | 'OCUPADA' | 'ESPERA_REPUESTO' | 'MANTENIMIENTO';

export type BayType =
  | 'Elevador Hidráulico 4T'
  | 'Elevador 2 Columnas'
  | 'Fosa de Alineación'
  | 'Bahía Rápida / Escáner';

export type MechanicSpecialty =
  | 'Mecánica General'
  | 'Frenos y Suspensión'
  | 'Electricidad y Diagnóstico'
  | 'Transmisiones';

export type PartRotation = 'ALTA' | 'MEDIA' | 'BAJA' | 'SIN_ROTACION_ALERTA';

export type PartCategory =
  | 'MOTOR'
  | 'FRENOS'
  | 'SUSPENSION_DIRECCION'
  | 'TRANSMISION'
  | 'FILTROS_FLUIDOS'
  | 'ELECTRICO_LUCES'
  | 'CLIMATIZACION'
  | 'CARROCERIA_ACCESORIOS';

export interface Mechanic {
  id: string;
  name: string;
  nickname: string;
  specialty: MechanicSpecialty;
  activeOtCount: number;
  currentBayId?: number;
  phone: string;
}

export interface Bay {
  id: number; // 1 a 4
  code: string; // "BAHIA-01"
  name: string;
  type: BayType;
  status: BayStatus;
  currentWorkOrderId?: string;
  currentVehiclePlate?: string;
  currentVehicleModel?: string;
  primaryMechanicId?: string;
  assistantMechanicId?: string;
  startedAt?: string;
  estimatedCompletionAt?: string;
  notes?: string;
}

export interface WorkOrderLaborItem {
  id: string;
  description: string;
  estimatedHours: number;
  hourlyRateBOB: number;
  totalBOB: number;
  isCompleted: boolean;
  assignedMechanicId?: string;
}

export interface WorkOrderPartItem {
  id: string;
  partId: string;
  partCode: string;
  description: string;
  quantityRequired: number;
  quantityUsed: number;
  unitPriceBOB: number;
  totalBOB: number;
  isReserved: boolean;
  isDeliveredToBay: boolean;
  status: 'PENDIENTE' | 'RESERVADO' | 'INSTALADO' | 'EN_ESPERA_IMPORTACION';
}

export interface StatusHistoryEntry {
  status: WorkOrderStatus;
  timestamp: string;
  changedBy: string;
  reason?: string;
}

export interface WorkOrder {
  id: string;
  code: string; // "OT-2025-0101"
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  clientName: string;
  clientDocument: string;
  clientPhone: string;
  clientEmail?: string;
  status: WorkOrderStatus;
  assignedBayId?: number;
  primaryMechanicId?: string;
  assistantMechanicId?: string;
  entryDate: string;
  estimatedDeliveryDate?: string;
  completedAt?: string;
  deliveredAt?: string;
  entryReason: string;
  diagnosticReport?: string;
  diagnosticDate?: string;
  laborItems: WorkOrderLaborItem[];
  partsItems: WorkOrderPartItem[];
  totalLaborBOB: number;
  totalPartsBOB: number;
  totalGeneralBOB: number;
  clientApprovedAt?: string;
  clientApprovalMethod?: 'FIRMA_DIGITAL' | 'PORTAL_WEB' | 'WHATSAPP_CONFIRMADO' | 'PRESENCIAL';
  lastClientContactDate: string;
  daysWithoutClientResponse: number;
  hasPendingAdditionalWork: boolean;
  additionalWorkDescription?: string;
  additionalWorkCostBOB?: number;
  isSuspendedForAdditionalWork: boolean;
  statusHistory: StatusHistoryEntry[];
  mechanicNotes?: string;
  internalNotes?: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: PartCategory;
  brand: string;
  compatibleModels: string;
  stockAvailable: number;
  stockReserved: number;
  stockMinimum: number;
  unitCostBOB: number;
  unitPriceBOB: number;
  locationShelf: string;
  lastMovementDate: string;
  daysWithoutMovement: number;
  rotationCategory: PartRotation;
}

export interface WorkshopMetrics {
  totalBays: number;
  occupiedBays: number;
  waitingPartsBays: number;
  freeBays: number;
  bayOccupancyRatePercent: number;
  activeWorkOrdersCount: number;
  mechanicsActive: number;
  totalMechanics: number;
  enDiagnosticoCount: number;
}