import { apiClient, type ApiResponse } from '../../../shared/api/api-client';
import { mockDb } from '../../../shared/api/mock-db';
import type { Budget } from '../../../shared/types/openapi';

export const budgetsService = {
  async getAll(): Promise<ApiResponse<Budget[]>> {
    return apiClient.get(() => mockDb.getBudgets());
  },

  async getByWorkOrderId(workOrderId: string): Promise<ApiResponse<Budget | null>> {
    return apiClient.get(() => {
      const budgets = mockDb.getBudgets();
      return budgets.find((b) => b.workOrderId === workOrderId || b.otCode === workOrderId) || null;
    });
  },

  async createBudget(payload: {
    workOrderId: string;
    otCode: string;
    vehiclePlate: string;
    clientName: string;
    clientDocument: string;
    laborSubtotalBOB: number;
    partsSubtotalBOB: number;
    discountBOB?: number;
    isAdditionalWork?: boolean;
  }): Promise<ApiResponse<Budget>> {
    return apiClient.post((data) => {
      const budgets = mockDb.getBudgets();
      const discount = data.discountBOB || 0;
      const totalBOB = Math.max(0, data.laborSubtotalBOB + data.partsSubtotalBOB - discount);

      const newBudget: Budget = {
        id: `bud-${Date.now().toString().slice(-4)}`,
        workOrderId: data.workOrderId,
        otCode: data.otCode,
        vehiclePlate: data.vehiclePlate,
        clientName: data.clientName,
        clientDocument: data.clientDocument,
        createdAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        laborSubtotalBOB: data.laborSubtotalBOB,
        partsSubtotalBOB: data.partsSubtotalBOB,
        discountBOB: discount,
        totalBOB,
        status: 'ENVIADO_CLIENTE',
        isAdditionalWorkBudget: data.isAdditionalWork || false,
      };

      budgets.unshift(newBudget);
      mockDb.saveBudgets(budgets);
      return newBudget;
    }, payload);
  },

  async recordClientApproval(
    budgetId: string,
    approvalToken?: string
  ): Promise<ApiResponse<Budget>> {
    return apiClient.post((_) => {
      const budgets = mockDb.getBudgets();
      const idx = budgets.findIndex((b) => b.id === budgetId);
      if (idx === -1) throw new Error('Presupuesto no encontrado');

      // RN-02: Aprobación explícita del cliente
      const updated: Budget = {
        ...budgets[idx],
        status: 'APROBADO',
        approvalDate: new Date().toISOString(),
        approvalToken: approvalToken || `AUTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      };

      budgets[idx] = updated;
      mockDb.saveBudgets(budgets);

      // Auto update the linked Work Order to APROBADA
      const orders = mockDb.getWorkOrders();
      const oIdx = orders.findIndex((o) => o.id === updated.workOrderId || o.code === updated.otCode);
      if (oIdx >= 0 && orders[oIdx].status === 'PRESUPUESTADA') {
        orders[oIdx] = {
          ...orders[oIdx],
          status: 'APROBADA',
          clientApprovedAt: updated.approvalDate,
          clientApprovalMethod: 'PORTAL_WEB',
          statusHistory: [
            {
              status: 'APROBADA',
              timestamp: new Date().toISOString(),
              changedBy: 'Cliente (Aprobación explícita RN-02)',
              reason: `Presupuesto ${updated.totalBOB} BOB aprobado con token ${updated.approvalToken}`,
            },
            ...orders[oIdx].statusHistory,
          ],
        };
        mockDb.saveWorkOrders(orders);
      }

      return updated;
    }, {});
  },
};
