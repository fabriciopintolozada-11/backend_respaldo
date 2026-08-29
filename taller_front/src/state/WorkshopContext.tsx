import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { resetStorageToSeed } from '../services/mock-db';
import { workshopService, type DiagnosticPayload } from '../services/workshop-service';
import type {
  Bay,
  BayStatus,
  InventoryItem,
  Mechanic,
  WorkOrder,
  WorkOrderStatus,
  WorkshopMetrics,
} from '../types/workshop';

interface WorkshopContextValue {
  bays: Bay[];
  workOrders: WorkOrder[];
  mechanics: Mechanic[];
  inventory: InventoryItem[];
  metrics: WorkshopMetrics | null;
  refresh: () => void;
  assignBayAndMechanic: (
    orderId: string,
    bayId: number,
    primaryMechanicId: string,
    assistantMechanicId?: string,
  ) => WorkOrder;
  updateBayStatus: (bayId: number, status: BayStatus, notes?: string) => Bay;
  updateStatus: (orderId: string, newStatus: WorkOrderStatus, changedBy: string, reason?: string) => WorkOrder;
  startDiagnostic: (orderId: string, changedBy: string) => WorkOrder;
  saveDiagnosticDraft: (
    orderId: string,
    payload: { diagnosticReport?: string; mechanicNotes?: string },
    changedBy: string,
  ) => WorkOrder;
  completeDiagnostic: (orderId: string, payload: DiagnosticPayload, changedBy: string) => WorkOrder;
  toggleLaborCompletion: (orderId: string, laborId: string) => WorkOrder;
  confirmPartInstalled: (orderId: string, partItemId: string) => WorkOrder;
  resetData: () => void;
}

const WorkshopContext = createContext<WorkshopContextValue | undefined>(undefined);

export function WorkshopProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo<WorkshopContextValue>(() => {
    void version;
    const sync = <T,>(result: T): T => {
      setVersion((v) => v + 1);
      return result;
    };

    return {
      bays: workshopService.getAllBays(),
      workOrders: workshopService.getAllWorkOrders(),
      mechanics: workshopService.getAllMechanics(),
      inventory: workshopService.getAllInventory(),
      metrics: workshopService.getMetrics(),
      refresh,
      assignBayAndMechanic: (orderId, bayId, primaryMechanicId, assistantMechanicId) =>
        sync(workshopService.assignBayAndMechanic(orderId, bayId, primaryMechanicId, assistantMechanicId)),
      updateBayStatus: (bayId, status, notes) => sync(workshopService.updateBayStatus(bayId, status, notes)),
      updateStatus: (orderId, newStatus, changedBy, reason) =>
        sync(workshopService.updateStatus(orderId, newStatus, changedBy, reason)),
      startDiagnostic: (orderId, changedBy) => sync(workshopService.startDiagnostic(orderId, changedBy)),
      saveDiagnosticDraft: (orderId, payload, changedBy) =>
        sync(workshopService.saveDiagnosticDraft(orderId, payload, changedBy)),
      completeDiagnostic: (orderId, payload, changedBy) =>
        sync(workshopService.completeDiagnostic(orderId, payload, changedBy)),
      toggleLaborCompletion: (orderId, laborId) =>
        sync(workshopService.toggleLaborCompletion(orderId, laborId)),
      confirmPartInstalled: (orderId, partItemId) =>
        sync(workshopService.confirmPartInstalled(orderId, partItemId)),
      resetData: () => {
        resetStorageToSeed();
        setVersion((v) => v + 1);
      },
    };
  }, [version, refresh]);

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

export function useWorkshop(): WorkshopContextValue {
  const context = useContext(WorkshopContext);
  if (!context) {
    throw new Error('useWorkshop debe ser utilizado dentro de un WorkshopProvider');
  }
  return context;
}