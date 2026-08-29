import { apiClient, type ApiResponse } from '../../../shared/api/api-client';
import { mockDb } from '../../../shared/api/mock-db';
import type { BillingAccount } from '../../../shared/types/openapi';

export type { BillingAccount };

export const billingService = {
  async getAll(): Promise<ApiResponse<BillingAccount[]>> {
    return apiClient.get(() => mockDb.getBilling());
  },

  async getByWorkOrderId(workOrderId: string): Promise<ApiResponse<BillingAccount | null>> {
    return apiClient.get(() => {
      const billings = mockDb.getBilling();
      return billings.find((b) => b.workOrderId === workOrderId) || null;
    });
  },

  async generateInvoiceOrReceipt(payload: {
    workOrderId: string;
    clientName: string;
    clientNitCI: string;
    clientPhone: string;
    vehiclePlate: string;
    vehicleDescription: string;
    laborTotalBOB: number;
    partsTotalBOB: number;
    discountBOB?: number;
    receiptType: 'FACTURA' | 'RECIBO_OFICIAL';
  }): Promise<ApiResponse<BillingAccount>> {
    return apiClient.post((data) => {
      const billings = mockDb.getBilling();
      const discount = data.discountBOB || 0;
      const subtotal = data.laborTotalBOB + data.partsTotalBOB - discount;
      const tax = data.receiptType === 'FACTURA' ? Math.round(subtotal * 0.13 * 100) / 100 : 0;
      const totalAmount = data.receiptType === 'FACTURA' ? subtotal : subtotal;

      const prefix = data.receiptType === 'FACTURA' ? 'FAC' : 'REC';
      const nextNum = (billings.length + 91).toString().padStart(4, '0');
      const invoiceCode = `${prefix}-${new Date().getFullYear()}-${nextNum}`;

      const newBill: BillingAccount = {
        id: `bill-${Date.now().toString().slice(-4)}`,
        workOrderId: data.workOrderId,
        invoiceCode,
        issueDate: new Date().toISOString().split('T')[0],
        clientName: data.clientName,
        clientNitCI: data.clientNitCI,
        clientPhone: data.clientPhone,
        vehiclePlate: data.vehiclePlate,
        vehicleDescription: data.vehicleDescription,
        laborTotalBOB: data.laborTotalBOB,
        partsTotalBOB: data.partsTotalBOB,
        discountBOB: discount,
        taxAmountBOB: tax,
        totalAmountBOB: totalAmount,
        paymentStatus: 'PENDIENTE',
        advancePaymentBOB: 0,
        balanceDueBOB: totalAmount,
        receiptType: data.receiptType,
      };

      billings.unshift(newBill);
      mockDb.saveBilling(billings);
      return newBill;
    }, payload);
  },

  async settleAccount(
    billingId: string,
    options: {
      paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA_QR' | 'TARJETA_DEBITO_CREDITO' | 'EFECTIVO_BOB' | 'TARJETA_CREDITO_DEBITO';
      transactionReference?: string;
      documentType?: 'FACTURA' | 'RECIBO_OFICIAL' | 'FACTURA_COMPUTARIZADA';
      nit?: string;
      businessName?: string;
    }
  ): Promise<ApiResponse<BillingAccount>> {
    const normalizedMethod =
      options.paymentMethod === 'EFECTIVO_BOB'
        ? 'EFECTIVO'
        : options.paymentMethod === 'TARJETA_CREDITO_DEBITO'
        ? 'TARJETA_DEBITO_CREDITO'
        : options.paymentMethod;

    return apiClient.post((_) => {
      const billings = mockDb.getBilling();
      const idx = billings.findIndex((b) => b.id === billingId);
      if (idx === -1) throw new Error('Cuenta de liquidación no encontrada');

      const bill = billings[idx];
      const updated: BillingAccount = {
        ...bill,
        advancePaymentBOB: bill.totalAmountBOB,
        balanceDueBOB: 0,
        paymentStatus: 'CANCELADO_TOTAL',
        paymentMethod: normalizedMethod as any,
        paidAt: new Date().toISOString(),
        clientNitCI: options.nit || bill.clientNitCI,
        clientName: options.businessName || bill.clientName,
        receiptType: options.documentType === 'RECIBO_OFICIAL' ? 'RECIBO_OFICIAL' : 'FACTURA',
      };

      billings[idx] = updated;
      mockDb.saveBilling(billings);

      // Transition OT to ENTREGADA
      const orders = mockDb.getWorkOrders();
      const oIdx = orders.findIndex((o) => o.id === bill.workOrderId);
      if (oIdx >= 0) {
        orders[oIdx] = {
          ...orders[oIdx],
          status: 'ENTREGADA',
          deliveredAt: new Date().toISOString(),
          statusHistory: [
            {
              status: 'ENTREGADA',
              timestamp: new Date().toISOString(),
              changedBy: 'Caja / Liquidación (RN-21, RN-22)',
              reason: `Liquidación formal completada. Pago total de ${bill.totalAmountBOB} BOB recibido.`,
            },
            ...orders[oIdx].statusHistory,
          ],
        };
        mockDb.saveWorkOrders(orders);
      }

      return updated;
    }, {});
  },

  async registerPayment(
    billingId: string,
    amountBOB: number,
    paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA_QR' | 'TARJETA_DEBITO_CREDITO'
  ): Promise<ApiResponse<BillingAccount>> {
    return apiClient.post((_) => {
      const billings = mockDb.getBilling();
      const idx = billings.findIndex((b) => b.id === billingId);
      if (idx === -1) throw new Error('Cuenta de liquidación no encontrada');

      const bill = billings[idx];
      const newAdvance = (bill.advancePaymentBOB || 0) + amountBOB;
      const newBalance = Math.max(0, bill.totalAmountBOB - newAdvance);

      const isFullyPaid = newBalance <= 0;

      const updated: BillingAccount = {
        ...bill,
        advancePaymentBOB: newAdvance,
        balanceDueBOB: newBalance,
        paymentStatus: isFullyPaid ? 'CANCELADO_TOTAL' : 'ANTICIPO',
        paymentMethod,
        paidAt: isFullyPaid ? new Date().toISOString() : bill.paidAt,
      };

      billings[idx] = updated;
      mockDb.saveBilling(billings);

      // If fully paid, mark corresponding work order as ENTREGADA
      if (isFullyPaid) {
        const orders = mockDb.getWorkOrders();
        const oIdx = orders.findIndex((o) => o.id === bill.workOrderId);
        if (oIdx >= 0 && orders[oIdx].status === 'FINALIZADA') {
          orders[oIdx] = {
            ...orders[oIdx],
            status: 'ENTREGADA',
            deliveredAt: new Date().toISOString(),
            statusHistory: [
              {
                status: 'ENTREGADA',
                timestamp: new Date().toISOString(),
                changedBy: 'Caja / Liquidación (RN-21, RN-22)',
                reason: `Liquidación completada. Pago total de ${bill.totalAmountBOB} BOB recibido. Vehículo retirado por cliente.`,
              },
              ...orders[oIdx].statusHistory,
            ],
          };
          mockDb.saveWorkOrders(orders);
        }
      }

      return updated;
    }, {});
  },
};
