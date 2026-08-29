import { Check, FileText } from 'lucide-react'
import type { CreatedWorkOrderResponse } from '../reception.types'

export function WorkOrderSuccess({ order, onNew }: {
  order: CreatedWorkOrderResponse
  onNew: () => void
}) {
  return (
    <section className="success-panel" aria-live="polite">
      <span className="success-icon"><Check size={28} /></span>
      <span className="eyebrow">Ingreso registrado</span>
      <h2>Orden de Trabajo creada</h2>
      <p>El vehículo quedó registrado con el estado inicial definido por el taller.</p>
      <div className="order-ticket">
        <FileText size={20} />
        <div>
          <span>Orden de Trabajo</span>
          <strong className="mono">{order.id}</strong>
        </div>
        <span className="status-pill is-open">{order.status}</span>
      </div>
      <dl className="success-details">
        <div><dt>Fecha de creación</dt><dd>{formatDate(order.created_at)}</dd></div>
        <div><dt>Reclamo inicial</dt><dd>{order.initial_complaint}</dd></div>
      </dl>
      <button className="button button-secondary" type="button" onClick={onNew}>
        Registrar otro ingreso
      </button>
    </section>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}
