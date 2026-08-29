import { CheckCircle2, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { WorkOrderStatus } from '../../types/workshop';

const STEPS: { status: WorkOrderStatus; label: string; stepNumber: number }[] = [
  { status: 'REGISTRADA', label: '1. Registrada', stepNumber: 1 },
  { status: 'EN_DIAGNOSTICO', label: '2. En Diagnóstico', stepNumber: 2 },
  { status: 'DIAGNOSTICADA', label: '3. Diagnóstico Completado', stepNumber: 3 },
  { status: 'PRESUPUESTADA', label: '4. Presupuestada', stepNumber: 4 },
  { status: 'APROBADA', label: '5. Aprobada x Cliente', stepNumber: 5 },
  { status: 'EN_PROGRESO', label: '6. En Progreso', stepNumber: 6 },
  { status: 'EN_ESPERA_REPUESTO', label: '7. Espera Repuesto', stepNumber: 7 },
  { status: 'FINALIZADA', label: '8. Finalizada', stepNumber: 8 },
  { status: 'ENTREGADA', label: '9. Entregada', stepNumber: 9 },
];

export interface StatusPipelineProps<S extends string> {
  currentStatus: S;
  isSuspendedForAdditionalWork?: boolean;
  daysWithoutClientResponse?: number;
  onSelectNextStatus?: (status: S) => void;
  interactive?: boolean;
  className?: string;
}

export function StatusPipeline<S extends string>({
  currentStatus,
  isSuspendedForAdditionalWork = false,
  daysWithoutClientResponse = 0,
  onSelectNextStatus,
  interactive = false,
  className = '',
}: StatusPipelineProps<S>) {
  const currentStepIdx = STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className={`w-full ${className}`}>
      {isSuspendedForAdditionalWork && (
        <div className="mb-3 p-3 rounded-xl bg-[#F59E0B10] border border-[#F59E0B30] text-[#F59E0B] flex items-start gap-2.5 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Regla RN-03 Aplicada:</span> Trabajo en bahía suspendido temporalmente por
            detección de daños adicionales. Requiere autorización explícita del cliente para continuar.
          </div>
        </div>
      )}

      {daysWithoutClientResponse >= 15 && currentStatus === 'PRESUPUESTADA' && (
        <div className="mb-3 p-3 rounded-xl bg-[#EF444410] border border-[#EF444430] text-[#EF4444] flex items-start gap-2.5 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Alerta RN-06 ({daysWithoutClientResponse} días sin respuesta):</span> La orden
            superó los 15 días tras el envío del presupuesto. Notificar al cliente sobre cargos de custodia y parqueo.
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto pb-2">
        <div className="flex items-center min-w-[760px] justify-between relative py-2">
          <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-1 bg-[#2D3139] -z-0" />
          {STEPS.map((step, idx) => {
            const isCompleted = currentStepIdx > idx;
            const isCurrent = step.status === currentStatus;
            const isClickable = interactive && onSelectNextStatus && Math.abs(currentStepIdx - idx) === 1;

            return (
              <div key={step.status} className="relative z-10 flex flex-col items-center group">
                <button
                  type="button"
                  disabled={!isClickable}
                  aria-label={step.label}
                  onClick={() => {
                    if (isClickable && onSelectNextStatus) onSelectNextStatus(step.status as S);
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                    isCurrent
                      ? 'bg-[#F97316] text-white ring-4 ring-[#F9731630] scale-110'
                      : isCompleted
                        ? 'bg-[#22C55E] text-white'
                        : 'bg-[#1C2028] border-2 border-[#2D3139] text-[#8E949F]'
                  } ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-[#F97316]' : 'cursor-default'}`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isCurrent ? <Clock className="w-5 h-5 animate-pulse" /> : <span>{step.stepNumber}</span>}
                </button>
                <span
                  className={`mt-2 text-xs text-center font-medium whitespace-nowrap px-1 ${
                    isCurrent ? 'text-[#F97316] font-bold' : isCompleted ? 'text-[#22C55E]' : 'text-[#8E949F]'
                  }`}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="text-[10px] text-[#F97316] font-bold uppercase tracking-wider mt-0.5">Estado Actual</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}