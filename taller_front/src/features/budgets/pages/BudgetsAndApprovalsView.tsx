import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  PlusCircle,
  ShieldAlert,
  Printer,
  Copy,
  ExternalLink,
  DollarSign,
  UserCheck,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Badge } from '../../../shared/components/Badge';
import { Modal } from '../../../shared/components/Modal';
import { LoadingSkeleton } from '../../../shared/components/LoadingSkeleton';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useToast } from '../../../shared/components/ToastContext';
import { budgetsService } from '../api/budgets-service';
import { workOrdersService } from '../../work-orders/api/work-orders-service';
import type { Budget, WorkOrder } from '../../../shared/types/openapi';

export const BudgetsAndApprovalsView: React.FC<{
  onSelectOrder?: (orderId: string) => void;
}> = ({ onSelectOrder }) => {
  const toast = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Approval Modal (RN-02)
  const [budgetToApprove, setBudgetToApprove] = useState<Budget | null>(null);
  const [approvalMethod, setApprovalMethod] = useState<'PORTAL_WEB' | 'WHATSAPP_CONFIRMADO' | 'FIRMA_DIGITAL'>('PORTAL_WEB');
  const [approvalToken, setApprovalToken] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bRes, oRes] = await Promise.all([
        budgetsService.getAll(),
        workOrdersService.getAll(),
      ]);
      setBudgets(bRes.data);
      setWorkOrders(oRes.data);
    } catch {
      toast.danger('Error al cargar presupuestos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBudgets = budgets.filter((b) => {
    return (
      b.otCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleApproveBudget = async () => {
    if (!budgetToApprove) return;
    setIsApproving(true);
    try {
      await budgetsService.recordClientApproval(budgetToApprove.id, approvalToken || undefined);
      toast.success(
        'Presupuesto Aprobado Explícitamente (RN-02)',
        `Orden vinculada pasó a estado APROBADA. Se habilitó el inicio de trabajos en bahía.`
      );
      setBudgetToApprove(null);
      await loadData();
    } catch {
      toast.danger('No se pudo registrar la aprobación');
    } finally {
      setIsApproving(false);
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
              <FileCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Presupuestos & Aprobaciones de Clientes (RN-02, RN-03)
            </h1>
          </div>
          <p className="text-xs text-[#8E949F] mt-1.5">
            Flujo de cotizaciones formales en BOB, registro de autorización explícita y control de trabajos extras.
          </p>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card variant="flat" padding="sm" className="flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-white">Regla RN-02 (Aprobación Previa):</span>
            <p className="text-[#8E949F] mt-0.5">
              Ningún vehículo puede ingresar a bahía ni consumir repuestos sin el consentimiento explícito del cliente
              (vía portal, WhatsApp o firma presencial).
            </p>
          </div>
        </Card>

        <Card variant="flat" padding="sm" className="flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-white">Regla RN-03 (Suspensión por Adicionales):</span>
            <p className="text-[#8E949F] mt-0.5">
              Si se detectan fallas no contempladas en el diagnóstico inicial, la labor se congela de inmediato hasta que
              el cliente apruebe el anexo presupuestario.
            </p>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <Card variant="flat" padding="md">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E949F]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, código de OT o nombre de cliente..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2D3139] bg-[#0F1115] text-white text-xs sm:text-sm min-h-[44px] focus:outline-none focus:border-[#F97316]"
          />
        </div>
      </Card>

      {/* Budgets List */}
      {filteredBudgets.length === 0 ? (
        <EmptyState
          icon={<FileCheck className="w-8 h-8 text-[#8E949F]" />}
          title="No hay presupuestos registrados"
          description="Genera diagnósticos en las órdenes de trabajo para emitir cotizaciones a los clientes."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBudgets.map((b) => {
            const isApproved = b.status === 'APROBADO';
            const isExpired = b.status === 'EXPIRADO';
            const isAdditional = b.isAdditionalWorkBudget;

            return (
              <Card
                key={b.id}
                variant={isAdditional ? 'warning' : isApproved ? 'default' : 'accent'}
                padding="md"
                className="flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#2D3139]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-2 py-0.5 rounded-md">
                          {b.otCode}
                        </span>
                        <span className="font-mono font-extrabold text-sm text-white">
                          {b.vehiclePlate}
                        </span>
                      </div>
                      <h3 className="font-bold text-xs text-white mt-1">
                        Cliente: {b.clientName}
                      </h3>
                      <p className="text-[11px] text-[#8E949F]">Documento: {b.clientDocument}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isApproved ? (
                        <Badge variant="success" size="sm">
                          Aprobado ✓ (RN-02)
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="danger" size="sm">
                          Expirado (&gt;15d RN-06)
                        </Badge>
                      ) : (
                        <Badge variant="amber" size="sm">
                          Enviado al Cliente
                        </Badge>
                      )}
                      {isAdditional && (
                        <span className="text-[10px] font-mono font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-1.5 py-0.5 rounded">
                          Anexo RN-03
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Details in BOB */}
                  <div className="py-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#8E949F]">
                      <span>Mano de Obra Calculada:</span>
                      <span className="font-mono font-semibold text-white">{b.laborSubtotalBOB} BOB</span>
                    </div>
                    <div className="flex justify-between text-[#8E949F]">
                      <span>Repuestos & Materiales:</span>
                      <span className="font-mono font-semibold text-white">{b.partsSubtotalBOB} BOB</span>
                    </div>
                    {b.discountBOB > 0 && (
                      <div className="flex justify-between text-[#22C55E] font-semibold">
                        <span>Descuento Aplicado:</span>
                        <span className="font-mono">-{b.discountBOB} BOB</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#2D3139] flex justify-between items-center text-xs font-bold">
                      <span className="text-white">Total Cotizado:</span>
                      <span className="text-base font-mono font-extrabold text-[#F97316]">
                        {b.totalBOB.toLocaleString('es-BO')} BOB
                      </span>
                    </div>

                    {b.approvalDate && (
                      <div className="mt-2 p-2 rounded-lg bg-[#22C55E10] border border-[#22C55E30] text-[10px] text-[#22C55E]">
                        Aprobado el {new Date(b.approvalDate).toLocaleString('es-BO')} (Token:{' '}
                        <strong className="font-mono">{b.approvalToken || 'CONF-OK'}</strong>)
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-[#2D3139] flex items-center justify-between gap-2">
                  {onSelectOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectOrder(b.workOrderId)}
                      className="text-xs"
                    >
                      Ver OT Vinculada
                    </Button>
                  )}

                  {!isApproved && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setBudgetToApprove(b);
                        setApprovalToken(`AUTH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
                      }}
                      className="text-xs"
                    >
                      Registrar Aprobación (RN-02)
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approval Confirmation Modal (RN-02) */}
      <Modal
        isOpen={!!budgetToApprove}
        onClose={() => setBudgetToApprove(null)}
        title={`Registrar Aprobación de Cliente - ${budgetToApprove?.otCode}`}
        subtitle="Regla RN-02: Aprobación formal requerida para liberar el vehículo a bahía y reservar repuestos"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#1C2028] border border-[#2D3139] text-xs space-y-1">
            <p className="text-[#8E949F]">
              Cliente: <strong className="text-white">{budgetToApprove?.clientName}</strong> ({budgetToApprove?.clientDocument})
            </p>
            <p className="text-[#8E949F]">
              Vehículo: <strong className="font-mono text-white">{budgetToApprove?.vehiclePlate}</strong>
            </p>
            <p className="text-[#8E949F]">
              Monto Total a Aprobar: <strong className="font-mono text-[#F97316]">{budgetToApprove?.totalBOB} BOB</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5">Canal de Confirmación:</label>
            <select
              value={approvalMethod}
              onChange={(e) => setApprovalMethod(e.target.value as any)}
              className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] p-2.5 text-xs text-white focus:outline-none focus:border-[#F97316]"
            >
              <option value="PORTAL_WEB">Portal Web de Consulta Pública (RN-17)</option>
              <option value="WHATSAPP_CONFIRMADO">Mensaje de Confirmación por WhatsApp</option>
              <option value="FIRMA_DIGITAL">Firma Presencial en Tablet de Recepción</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1">Código / Token de Validación:</label>
            <input
              type="text"
              value={approvalToken}
              onChange={(e) => setApprovalToken(e.target.value)}
              className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
            <Button variant="outline" onClick={() => setBudgetToApprove(null)}>
              Cancelar
            </Button>
            <Button
              variant="success"
              isLoading={isApproving}
              onClick={handleApproveBudget}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirmar Aprobación (RN-02)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
