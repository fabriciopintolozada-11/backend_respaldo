import { useMemo, useState } from 'react';
import { Package, Plus, Trash2, Wrench, X } from 'lucide-react';

import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import type { InventoryItem, Mechanic, WorkOrder } from '../../types/workshop';
import { HOURLY_RATE_BOB } from '../../services/workshop-service';
import type { DiagnosticPayload } from '../../services/workshop-service';

interface LaborRow {
  key: string;
  description: string;
  hours: number;
}

interface PartRow {
  partId: string;
  quantity: number;
}

export interface DiagnosticFormModalProps {
  order: WorkOrder;
  mechanics: Mechanic[];
  inventory: InventoryItem[];
  isOpen: boolean;
  changedBy: string;
  onClose: () => void;
  onSaveDraft: (payload: { diagnosticReport: string; mechanicNotes?: string }) => void;
  onComplete: (payload: DiagnosticPayload) => void;
}

let rowCounter = 0;
function nextRowKey(): string {
  rowCounter += 1;
  return `row-${Date.now()}-${rowCounter}`;
}

export function DiagnosticFormModal({
  order,
  mechanics,
  inventory,
  isOpen,
  changedBy,
  onClose,
  onSaveDraft,
  onComplete,
}: DiagnosticFormModalProps) {
  const [report, setReport] = useState(order.diagnosticReport ?? '');
  const [mechanicNotes, setMechanicNotes] = useState(order.mechanicNotes ?? '');
  const [laborRows, setLaborRows] = useState<LaborRow[]>([
    { key: nextRowKey(), description: '', hours: 2 },
  ]);
  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [inventory, search]);

  const totalLabor = laborRows.reduce((acc, row) => acc + (row.hours || 0) * HOURLY_RATE_BOB, 0);
  const totalParts = partRows.reduce((acc, row) => {
    const item = inventory.find((i) => i.id === row.partId);
    return acc + (item?.unitPriceBOB ?? 0) * row.quantity;
  }, 0);

  const isRegistered = order.status === 'REGISTRADA';

  const handleAddPart = (item: InventoryItem) => {
    setError(null);
    setPartRows((prev) => {
      const existing = prev.find((p) => p.partId === item.id);
      if (existing) {
        if (existing.quantity + 1 > item.stockAvailable) {
          setError(`Stock insuficiente para ${item.name} (disponible: ${item.stockAvailable}).`);
          return prev;
        }
        return prev.map((p) => (p.partId === item.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      if (item.stockAvailable < 1) {
        setError(`Stock insuficiente para ${item.name}.`);
        return prev;
      }
      return [...prev, { partId: item.id, quantity: 1 }];
    });
  };

  const handleSubmit = () => {
    if (!report.trim()) {
      setError('El informe de diagnóstico técnico es obligatorio.');
      return;
    }
    const laborItems = laborRows
      .filter((r) => r.description.trim() && r.hours > 0)
      .map((r) => ({
        description: r.description.trim(),
        estimatedHours: r.hours,
        assignedMechanicId: changedBy.startsWith('MEC-') ? changedBy : order.primaryMechanicId,
      }));

    const partsItems = partRows
      .filter((p) => p.quantity > 0)
      .map((p) => ({ partId: p.partId, quantityRequired: p.quantity }));

    onComplete({
      diagnosticReport: report.trim(),
      mechanicNotes: mechanicNotes.trim() || undefined,
      laborItems,
      partsItems,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Diagnóstico Técnico Inicial — ${order.code}`}
      subtitle={`${order.vehicleBrand} ${order.vehicleModel} · ${order.vehiclePlate} · ${order.clientName}`}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-[#EF444410] border border-[#EF444430] text-xs text-[#EF4444] font-semibold">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="diagnostic-report"
            className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5"
          >
            Informe Técnico de Diagnóstico <span className="text-[#EF4444]">*</span>
          </label>
          <textarea
            id="diagnostic-report"
            rows={4}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Ej: Amortiguadores delanteros con fuga de aceite. Desgaste severo en pastillas de freno..."
            className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] p-3 text-sm text-[#E0E2E6] placeholder:text-[#8E949F]/60 focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316]"
          />
        </div>

        <div>
          <label
            htmlFor="mechanic-notes"
            className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5"
          >
            Notas Técnicas del Mecánico (Opcional)
          </label>
          <textarea
            id="mechanic-notes"
            rows={2}
            value={mechanicNotes}
            onChange={(e) => setMechanicNotes(e.target.value)}
            placeholder="Observaciones de taller, torque, normas aplicadas..."
            className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] p-3 text-sm text-[#E0E2E6] placeholder:text-[#8E949F]/60 focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F] flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-[#F97316]" />
              Mano de Obra Estimada
              <span className="text-[#8E949F]/70 normal-case">· {HOURLY_RATE_BOB} Bs./h</span>
            </h4>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setLaborRows((prev) => [...prev, { key: nextRowKey(), description: '', hours: 2 }])}
            >
              Agregar Tarea
            </Button>
          </div>

          <div className="space-y-2">
            {laborRows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <input
                  value={row.description}
                  onChange={(e) =>
                    setLaborRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, description: e.target.value } : r)),
                    )
                  }
                  placeholder="Descripción de la operación (Ej: Cambio de pastillas de freno)"
                  className="flex-1 rounded-xl border border-[#2D3139] bg-[#0F1115] px-3.5 py-2 text-sm text-[#E0E2E6] placeholder:text-[#8E949F]/60 focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] min-h-[44px]"
                />
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={row.hours}
                  onChange={(e) =>
                    setLaborRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, hours: Number(e.target.value) } : r)),
                    )
                  }
                  aria-label="Horas estimadas"
                  className="w-24 text-center"
                />
                <span className="text-xs font-mono text-[#8E949F] w-24 text-right">
                  {(row.hours || 0) * HOURLY_RATE_BOB} BOB
                </span>
                <button
                  type="button"
                  onClick={() => setLaborRows((prev) => prev.filter((r) => r.key !== row.key))}
                  className="p-2 rounded-lg text-[#8E949F] hover:text-[#EF4444] hover:bg-[#EF444410] transition-colors"
                  aria-label="Quitar tarea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F] flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#F97316]" />
              Repuestos Preliminares Requeridos (Inventario Mock)
            </h4>
            <span className="text-[10px] text-[#8E949F]">Selección desde catálogo · Reserva RN-07</span>
          </div>

          <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar repuesto por nombre, código, marca o categoría..."
              aria-label="Buscar repuestos del inventario"
            />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
              {filteredInventory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddPart(item)}
                  className="text-left p-3 rounded-xl border border-[#2D3139] bg-[#0F1115] hover:border-[#F97316]/60 hover:bg-[#F9731608] transition-all flex items-center justify-between gap-2 min-h-[52px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-[#F97316]">{item.code}</span>
                      <span className="text-xs font-bold text-white truncate">{item.name}</span>
                    </div>
                    <p className="text-[10px] text-[#8E949F] mt-0.5">
                      Stock: {item.stockAvailable} · {item.unitPriceBOB} Bs. c/u
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-[#F97316] shrink-0" />
                </button>
              ))}
              {filteredInventory.length === 0 && (
                <p className="col-span-full text-xs text-[#8E949F] italic p-3">Sin resultados para la búsqueda.</p>
              )}
            </div>
          </div>

          {partRows.length > 0 && (
            <div className="space-y-2">
              {partRows.map((row) => {
                const item = inventory.find((i) => i.id === row.partId);
                if (!item) return null;
                return (
                  <div
                    key={row.partId}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[#F9731630] bg-[#F9731608]"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] font-bold text-[#F97316]">{item.code}</span>
                      <span className="text-xs font-semibold text-white ml-2">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={item.stockAvailable}
                        value={row.quantity}
                        onChange={(e) =>
                          setPartRows((prev) =>
                            prev.map((p) =>
                              p.partId === row.partId ? { ...p, quantity: Number(e.target.value) } : p,
                            ),
                          )
                        }
                        aria-label={`Cantidad de ${item.name}`}
                        className="w-16 rounded-lg border border-[#2D3139] bg-[#0F1115] px-2 py-1.5 text-sm text-center text-[#E0E2E6] focus:outline-none focus:border-[#F97316]"
                      />
                      <span className="text-xs font-mono text-[#F97316] w-20 text-right">
                        {(item.unitPriceBOB * row.quantity).toLocaleString('es-BO')} BOB
                      </span>
                      <button
                        type="button"
                        onClick={() => setPartRows((prev) => prev.filter((p) => p.partId !== row.partId))}
                        className="p-2 rounded-lg text-[#8E949F] hover:text-[#EF4444] hover:bg-[#EF444410] transition-colors"
                        aria-label={`Quitar ${item.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
            <span className="text-[10px] uppercase tracking-wider text-[#8E949F] block">Mano de Obra</span>
            <span className="font-mono font-bold text-white text-sm">{totalLabor.toLocaleString('es-BO')} BOB</span>
          </div>
          <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
            <span className="text-[10px] uppercase tracking-wider text-[#8E949F] block">Repuestos</span>
            <span className="font-mono font-bold text-white text-sm">{totalParts.toLocaleString('es-BO')} BOB</span>
          </div>
          <div className="p-3 rounded-xl bg-[#F9731610] border border-[#F9731630]">
            <span className="text-[10px] uppercase tracking-wider text-[#F97316] block">Total Estimado</span>
            <span className="font-mono font-bold text-[#F97316] text-sm">
              {(totalLabor + totalParts).toLocaleString('es-BO')} BOB
            </span>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row justify-between gap-3 border-t border-[#2D3139]">
          <div className="flex flex-wrap gap-2">
            {mechanics.map((m) => (
              <span
                key={m.id}
                className="text-[10px] font-semibold text-[#8E949F] bg-[#1C2028] border border-[#2D3139] px-2 py-1 rounded-lg"
              >
                {m.name} · {m.specialty}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => onSaveDraft({ diagnosticReport: report.trim(), mechanicNotes: mechanicNotes.trim() || undefined })}
            >
              {isRegistered ? 'Iniciar Diagnóstico' : 'Guardar Borrador'}
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              Completar Diagnóstico
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}