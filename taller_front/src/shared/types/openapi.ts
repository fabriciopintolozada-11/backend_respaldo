/**
 * OpenAPI-derived TypeScript Definitions
 * System: Taller Mecánico "Los Fratelli" - Gestión de Taller de Vehículos Livianos
 */

export type FuelType = 'GASOLINA' | 'DIESEL' | 'HIBRIDO' | 'ELECTRICO';

export type WorkOrderStatus =
  | 'REGISTRADA'
  | 'DIAGNOSTICADA'
  | 'PRESUPUESTADA'
  | 'APROBADA'
  | 'EN_PROGRESO'
  | 'EN_ESPERA_REPUESTO'
  | 'FINALIZADA'
  | 'ENTREGADA'
  | 'CANCELADA';

export type BayStatus = 'LIBRE' | 'OCUPADA' | 'ESPERA_REPUESTO' | 'MANTENIMIENTO';

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

export type UserRole = 'RECEPCION' | 'JEFE_TALLER' | 'MECANICO' | 'ADMIN' | 'CLIENTE_PUBLICO';

export interface Vehicle {
  id: string;
  plate: string; // e.g. "4589-KXA"
  brand: string;
  model: string;
  year: number;
  fuelType: FuelType;
  color: string;
  vin?: string;
  mileage: number;
  clientName: string;
  clientDocument: string; // CI or NIT
  clientPhone: string;
  clientEmail?: string;
  lastServiceDate?: string;
  totalPreviousVisits: number;
  inspectionChecklist?: {
    fuelLevel: 'VACIO' | '1/4' | '1/2' | '3/4' | 'LLENO';
    spareTire: boolean;
    jackAndTools: boolean;
    documentsInCar: boolean;
    scratchesOrDents: string[];
    valuableBelongings: string;
  };
}

export interface Mechanic {
  id: string;
  name: string;
  nickname: string;
  specialty: 'Mecánica General' | 'Frenos y Suspensión' | 'Electricidad y Diagnóstico' | 'Transmisiones';
  activeOtCount: number;
  currentBayId?: number;
  phone: string;
  avatarUrl?: string;
}

export interface Bay {
  id: number; // 1 to 4
  code: string; // "BAHIA-01"
  name: string; // e.g., "Bahía 1 - Elevador Principal"
  type: 'Elevador Hidráulico 4T' | 'Elevador 2 Columnas' | 'Fosa de Alineación' | 'Bahía Rápida / Escáner';
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
  hourlyRateBOB: number; // In Bolivianos (hidden for mechanics)
  totalBOB: number; // In Bolivianos (hidden for mechanics)
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
  unitPriceBOB: number; // Hidden for mechanic RN-16
  totalBOB: number; // Hidden for mechanic RN-16
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
  entryReason: string; // Síntomas reportados por cliente
  diagnosticReport?: string;
  laborItems: WorkOrderLaborItem[];
  partsItems: WorkOrderPartItem[];
  totalLaborBOB: number;
  totalPartsBOB: number;
  totalGeneralBOB: number;
  clientApprovedAt?: string;
  clientApprovalMethod?: 'FIRMA_DIGITAL' | 'PORTAL_WEB' | 'WHATSAPP_CONFIRMADO' | 'PRESENCIAL';
  lastClientContactDate: string;
  daysWithoutClientResponse: number; // For RN-06 alert (> 15 days)
  hasPendingAdditionalWork: boolean; // RN-03
  additionalWorkDescription?: string;
  additionalWorkCostBOB?: number;
  isSuspendedForAdditionalWork: boolean; // RN-03
  statusHistory: StatusHistoryEntry[];
  mechanicNotes?: string;
  internalNotes?: string;
}

export interface InventoryItem {
  id: string;
  code: string; // e.g. "REP-FLT-004"
  name: string;
  category: PartCategory;
  brand: string;
  compatibleModels: string;
  stockAvailable: number;
  stockReserved: number;
  stockMinimum: number;
  unitCostBOB: number;
  unitPriceBOB: number;
  locationShelf: string; // e.g., "Estante B-03"
  lastMovementDate: string;
  daysWithoutMovement: number; // For RN-10 (> 60 days alert)
  rotationCategory: PartRotation;
}

export interface Budget {
  id: string;
  workOrderId: string;
  otCode: string;
  vehiclePlate: string;
  clientName: string;
  clientDocument: string;
  createdAt: string;
  validUntil: string;
  laborSubtotalBOB: number;
  partsSubtotalBOB: number;
  discountBOB: number;
  totalBOB: number;
  status: 'BORRADOR' | 'ENVIADO_CLIENTE' | 'APROBADO' | 'RECHAZADO' | 'EXPIRADO';
  approvalDate?: string;
  approvalToken?: string;
  isAdditionalWorkBudget?: boolean;
}

export interface BillingAccount {
  id: string;
  workOrderId: string;
  invoiceCode: string; // "FAC-2025-0043" or "REC-2025-0043"
  issueDate: string;
  clientName: string;
  clientNitCI: string;
  clientPhone: string;
  vehiclePlate: string;
  vehicleDescription: string;
  laborTotalBOB: number;
  partsTotalBOB: number;
  discountBOB: number;
  taxAmountBOB: number; // IVA if invoice
  totalAmountBOB: number;
  paymentStatus: 'PENDIENTE' | 'ANTICIPO' | 'CANCELADO_TOTAL';
  advancePaymentBOB: number;
  balanceDueBOB: number;
  paymentMethod?: 'EFECTIVO' | 'TRANSFERENCIA_QR' | 'TARJETA_DEBITO_CREDITO';
  paidAt?: string;
  receiptType: 'FACTURA' | 'RECIBO_OFICIAL';
  otCode?: string;
  invoiceNumber?: string;
  isSettled?: boolean;
  settledAt?: string;
  totalLaborBOB?: number;
  totalPartsBOB?: number;
  taxesBOB?: number;
  totalGeneralBOB?: number;
  clientDocument?: string;
  createdAt?: string;
  sinControlCode?: string;
}
