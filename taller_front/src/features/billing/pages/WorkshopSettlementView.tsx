import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Receipt,
  FileCheck,
  CreditCard,
  QrCode,
  Printer,
  CheckCircle2,
  AlertCircle,
  Car,
  User,
  Clock,
  ShieldCheck,
  Search,
  PlusCircle,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Badge } from '../../../shared/components/Badge';
import { MetricCard } from '../../../shared/components/MetricCard';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { LoadingSkeleton } from '../../../shared/components/LoadingSkeleton';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useToast } from '../../../shared/components/ToastContext';
import { billingService, type BillingAccount } from '../api/billing-service';
import { workOrdersService } from '../../work-orders/api/work-orders-service';
import type { WorkOrder } from '../../../shared/types/openapi';

export const WorkshopSettlementView: React.FC<{
  initialOrderId?: string;
  onSelectOrder?: (orderId: string) => void;
}> = ({ initialOrderId, onSelectOrder }) => {
  const toast = useToast();
  const [bills, setBills] = useState<BillingAccount[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Settlement / Payment modal
  const [selectedBillForPay, setSelectedBillForPay] = useState<BillingAccount | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO_BOB' | 'TRANSFERENCIA_QR' | 'TARJETA_CREDITO_DEBITO'>('TRANSFERENCIA_QR');
  const [transactionRef, setTransactionRef] = useState('');
  const [documentType, setDocumentType] = useState<'FACTURA_COMPUTARIZADA' | 'RECIBO_OFICIAL'>('FACTURA_COMPUTARIZADA');
  const [nitFactura, setNitFactura] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Printable Invoice Modal
  const [billToPrint, setBillToPrint] = useState<BillingAccount | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [billsRes, ordersRes] = await Promise.all([
        billingService.getAll(),
        workOrdersService.getAll(),
      ]);
      setBills(billsRes.data);
      setWorkOrders(ordersRes.data);
    } catch {
      toast.danger('Error al cargar liquidaciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter bills
  const filteredBills = bills.filter((b) => {
    return (
      b.workOrderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalCollectedBOB = bills
    .filter((b) => b.paymentStatus === 'CANCELADO_TOTAL')
    .reduce((acc, curr) => acc + curr.totalAmountBOB, 0);

  const totalPendingBOB = bills
    .filter((b) => b.paymentStatus !== 'CANCELADO_TOTAL')
    .reduce((acc, curr) => acc + curr.totalAmountBOB, 0);

  const handleProcessPayment = async () => {
    if (!selectedBillForPay) return;
    setIsProcessingPayment(true);
    try {
      await billingService.settleAccount(selectedBillForPay.id, {
        paymentMethod,
        transactionReference: transactionRef || undefined,
        documentType,
        nit: nitFactura || selectedBillForPay.clientNitCI,
        businessName: razonSocial || selectedBillForPay.clientName,
      });

      toast.success(
        'Cuenta Liquidada y Vehículo Entregado (RN-21, RN-22)',
        `Se emitió ${documentType === 'FACTURA_COMPUTARIZADA' ? 'Factura Computarizada' : 'Recibo'} por ${selectedBillForPay.totalAmountBOB} BOB.`
      );
      setSelectedBillForPay(null);
      await loadData();
    } catch (err) {
      toast.danger('Error al procesar la liquidación');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton rows={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F9731615] border border-[#F9731630] flex items-center justify-center text-[#F97316]">
              <DollarSign className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Liquidación & Caja del Taller (RN-21, RN-22)
            </h1>
          </div>
          <p className="text-xs text-[#8E949F] mt-1.5">
            Cuentas por cobrar en Bolivianos (BOB), facturación electrónica SIN, pagos QR y acta de entrega de vehículos.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          title="Recaudación Cobrada"
          value={`${totalCollectedBOB.toLocaleString('es-BO')} BOB`}
          subtitle="Cuentas liquidadas con factura/recibo"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <MetricCard
          title="Por Cobrar (Pendiente)"
          value={`${totalPendingBOB.toLocaleString('es-BO')} BOB`}
          subtitle="Vehículos finalizados por entregar"
          variant={totalPendingBOB > 0 ? 'warning' : 'default'}
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Liquidaciones"
          value={bills.length}
          subtitle="Histórico de facturación del taller"
          icon={<Receipt className="w-5 h-5" />}
        />
      </div>

      {/* Search Bar */}
      <Card variant="flat" padding="md">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E949F]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar liquidación por código de OT, placa o cliente..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2D3139] bg-[#0F1115] text-white text-xs sm:text-sm min-h-[44px] focus:outline-none focus:border-[#F97316]"
          />
        </div>
      </Card>

      {/* Accounts List */}
      {filteredBills.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-8 h-8 text-[#8E949F]" />}
          title="No hay liquidaciones pendientes"
          description="Las cuentas se crean automáticamente al finalizar una orden de trabajo (RN-21)."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBills.map((b) => {
            const isPaid = b.paymentStatus === 'CANCELADO_TOTAL';

            return (
              <Card
                key={b.id}
                variant={isPaid ? 'default' : 'warning'}
                padding="md"
                className="flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#2D3139]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-2 py-0.5 rounded-md">
                          {b.workOrderId}
                        </span>
                        <span className="font-mono font-extrabold text-sm text-white">
                          {b.vehiclePlate}
                        </span>
                      </div>
                      <h3 className="font-bold text-xs text-white mt-1">
                        {b.clientName}
                      </h3>
                      <p className="text-[11px] text-[#8E949F]">CI/NIT: {b.clientNitCI}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isPaid ? (
                        <Badge variant="success" size="sm">
                          Cobrado & Entregado ✓
                        </Badge>
                      ) : (
                        <Badge variant="danger" size="sm">
                          Pendiente (RN-21)
                        </Badge>
                      )}
                      <span className="text-[10px] text-[#8E949F] font-mono">
                        {new Date(b.issueDate).toLocaleDateString('es-BO')}
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown (RN-21, RN-22) */}
                  <div className="py-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#8E949F]">
                      <span>Mano de Obra Certificada:</span>
                       <span className="font-mono text-white">{b.laborTotalBOB} BOB</span>
                    </div>
                    <div className="flex justify-between text-[#8E949F]">
                      <span>Repuestos Utilizados:</span>
                       <span className="font-mono text-white">{b.partsTotalBOB} BOB</span>
                    </div>
                    {b.taxAmountBOB > 0 && (
                      <div className="flex justify-between text-[#8E949F]">
                        <span>IVA (13% Ley 843):</span>
                        <span className="font-mono text-white">{b.taxAmountBOB} BOB</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#2D3139] flex justify-between items-center text-xs font-bold">
                      <span className="text-white">TOTAL GENERAL:</span>
                      <span className="text-base font-mono font-extrabold text-[#F97316]">
                        {b.totalAmountBOB.toLocaleString('es-BO')} BOB
                      </span>
                    </div>

                    {isPaid && (
                      <div className="mt-2 p-2 rounded-xl bg-[#22C55E10] border border-[#22C55E30] text-[10px] text-[#22C55E] space-y-0.5">
                        <p>
                          <strong>Documento:</strong> {b.invoiceCode || 'Recibo Oficial #094'} ({b.paymentMethod})
                        </p>
                        <p>
                          <strong>Cobrado:</strong>{' '}
                          {b.paidAt ? new Date(b.paidAt).toLocaleString('es-BO') : 'Completado'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-[#2D3139] flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Printer className="w-3.5 h-3.5" />}
                    onClick={() => setBillToPrint(b)}
                    className="text-xs"
                  >
                    Ver Factura / Recibo
                  </Button>

                  {!isPaid && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<DollarSign className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setSelectedBillForPay(b);
                        setNitFactura(b.clientNitCI);
                        setRazonSocial(b.clientName);
                      }}
                      className="text-xs"
                    >
                      Liquidar Cuenta (RN-21)
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Processing Modal (RN-21, RN-22) */}
      <Modal
        isOpen={!!selectedBillForPay}
        onClose={() => setSelectedBillForPay(null)}
        title={`Cobro & Liquidación - Orden ${selectedBillForPay?.workOrderId}`}
        subtitle="Regla RN-21: Registro formal de pago y entrega física del vehículo liviano"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#F9731610] border border-[#F9731630] text-[#E0E2E6] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E949F]">Monto Total a Cobrar:</span>
              <p className="text-xl font-extrabold font-mono text-[#F97316]">
                {selectedBillForPay?.totalAmountBOB.toLocaleString('es-BO')} BOB
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="font-mono font-bold block text-white">{selectedBillForPay?.vehiclePlate}</span>
              <span className="text-[#8E949F]">{selectedBillForPay?.clientName}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5">Método de Pago:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('TRANSFERENCIA_QR')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all min-h-[44px] flex flex-col items-center gap-1 cursor-pointer ${
                  paymentMethod === 'TRANSFERENCIA_QR'
                    ? 'border-[#F97316] bg-[#F9731615] text-[#F97316]'
                    : 'border-[#2D3139] bg-[#0F1115] text-[#8E949F] hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>QR Simple</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('EFECTIVO_BOB')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all min-h-[44px] flex flex-col items-center gap-1 cursor-pointer ${
                  paymentMethod === 'EFECTIVO_BOB'
                    ? 'border-[#F97316] bg-[#F9731615] text-[#F97316]'
                    : 'border-[#2D3139] bg-[#0F1115] text-[#8E949F] hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Efectivo BOB</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TARJETA_CREDITO_DEBITO')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all min-h-[44px] flex flex-col items-center gap-1 cursor-pointer ${
                  paymentMethod === 'TARJETA_CREDITO_DEBITO'
                    ? 'border-[#F97316] bg-[#F9731615] text-[#F97316]'
                    : 'border-[#2D3139] bg-[#0F1115] text-[#8E949F] hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>POS / Tarjeta</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5">Tipo de Comprobante:</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as any)}
                className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] p-2.5 text-xs text-white focus:outline-none focus:border-[#F97316]"
              >
                <option value="FACTURA_COMPUTARIZADA">Factura Computarizada SIN</option>
                <option value="RECIBO_OFICIAL">Recibo Oficial de Taller</option>
              </select>
            </div>

            <div>
              <Input
                label="Nro Transacción / Autorización POS"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Ej: QR-6948291 / POS-3829"
              />
            </div>

            <div>
              <Input
                label="NIT / CI para Factura"
                value={nitFactura}
                onChange={(e) => setNitFactura(e.target.value)}
                placeholder="Ej: 4892019014"
              />
            </div>

            <div>
              <Input
                label="Razón Social Facturación"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Ej: Marcelo Vargas"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
            <Button variant="outline" onClick={() => setSelectedBillForPay(null)}>
              Cancelar
            </Button>
            <Button
              variant="success"
              isLoading={isProcessingPayment}
              onClick={handleProcessPayment}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirmar Cobro & Entregar Vehículo (RN-21)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Official Invoice / Receipt Print Modal */}
      <Modal
        isOpen={!!billToPrint}
        onClose={() => setBillToPrint(null)}
        title="Comprobante Fiscal / Factura Computarizada (SIN)"
        maxWidth="lg"
      >
        {billToPrint && (
          <div className="space-y-4 text-[#E0E2E6]">
            {/* Header letterhead */}
            <div className="p-4 rounded-2xl bg-[#1C2028] border border-[#2D3139] text-center space-y-1">
              <h2 className="font-extrabold text-base text-white">TALLER MECÁNICO "LOS FRATELLI" S.R.L.</h2>
              <p className="text-xs text-[#8E949F]">
                NIT: 1028492023 • Autorización SIN: 294020194820
              </p>
              <p className="text-[10px] text-[#8E949F]">Casa Matriz: Av. Arce #2410, La Paz - Bolivia</p>
              <div className="pt-2 border-t border-[#2D3139] flex justify-between text-xs font-mono font-bold">
                <span className="text-[#F97316]">{billToPrint.invoiceCode || 'FACTURA N° 004829'}</span>
                <span className="text-[#8E949F]">FECHA: {new Date(billToPrint.issueDate).toLocaleDateString('es-BO')}</span>
              </div>
            </div>

            {/* Client info */}
            <div className="p-3 rounded-xl border border-[#2D3139] bg-[#1C2028] text-xs space-y-1">
              <p>
                <strong className="text-white">Señor(es):</strong> {billToPrint.clientName}
              </p>
              <p>
                <strong className="text-white">NIT/CI:</strong> {billToPrint.clientNitCI}
              </p>
              <p>
                <strong className="text-white">Vehículo:</strong> {billToPrint.vehiclePlate} (OT: {billToPrint.workOrderId})
              </p>
            </div>

            {/* Detail items */}
            <div className="text-xs space-y-2">
              <table className="w-full text-left border border-[#2D3139] rounded-xl overflow-hidden">
                <thead className="bg-[#1C2028] text-[#8E949F] text-[10px] uppercase font-bold">
                  <tr>
                    <th className="p-2.5">Concepto</th>
                    <th className="p-2.5 text-right">Subtotal (BOB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3139] font-mono text-xs">
                  <tr>
                    <td className="p-2.5 text-white">Servicios Técnicos y Mano de Obra en Bahía</td>
                    <td className="p-2.5 text-right text-[#F97316]">{billToPrint.laborTotalBOB} Bs.</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-white">Repuestos Originales e Insumos Instalados</td>
                    <td className="p-2.5 text-right text-[#F97316]">{billToPrint.partsTotalBOB} Bs.</td>
                  </tr>
                </tbody>
                <tfoot className="bg-[#1C2028] font-bold border-t border-[#2D3139]">
                  <tr>
                    <td className="p-2.5 text-right uppercase text-xs text-[#8E949F]">TOTAL PAGADO:</td>
                    <td className="p-2.5 text-right font-mono text-[#F97316] text-sm">
                      {billToPrint.totalAmountBOB} BOB
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* QR SIN Code Placeholder */}
            <div className="p-3 rounded-xl bg-[#1C2028] border border-dashed border-[#2D3139] flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white block">Código de Control SIN:</span>
                <span className="font-mono text-[11px] text-[#F97316]">
                  {billToPrint.sinControlCode || '4F-8A-29-B1-E3'}
                </span>
                <p className="text-[10px] text-[#8E949F] mt-1">
                  "ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY"
                </p>
              </div>
              <QrCode className="w-10 h-10 text-[#8E949F] shrink-0" />
            </div>

            <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
              <Button variant="outline" onClick={() => setBillToPrint(null)}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  window.print();
                  toast.info('Enviando a impresora');
                }}
              >
                Imprimir Factura
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
