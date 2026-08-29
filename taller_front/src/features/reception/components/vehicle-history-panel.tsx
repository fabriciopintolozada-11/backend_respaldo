import { BatteryWarning, CheckCircle2, Clock3, FileClock, Search, Wrench } from 'lucide-react'
import type { LookupState } from '../reception.types'

export function VehicleHistoryPanel({ lookup }: { lookup: LookupState }) {
  if (lookup.status === 'idle') {
    return (
      <div className="empty-state">
        <span className="empty-icon"><Search size={24} /></span>
        <h3>Expediente del vehículo</h3>
        <p>Ingresa una placa válida. La consulta se realizará automáticamente.</p>
      </div>
    )
  }

  if (lookup.status === 'loading') {
    return (
      <div className="empty-state" role="status">
        <span className="spinner" />
        <h3>Buscando expediente</h3>
        <p>Consultando la placa en el taller...</p>
      </div>
    )
  }

  if (lookup.status === 'new') {
    return (
      <div className="lookup-notice is-new" role="status">
        <CheckCircle2 size={22} />
        <div>
          <strong>Vehículo nuevo</strong>
          <p>No existe un expediente para esta placa. Completa todos los datos para registrarlo.</p>
        </div>
      </div>
    )
  }

  if (lookup.status === 'error') {
    return (
      <div className="lookup-notice is-error" role="alert">
        <FileClock size={22} />
        <div>
          <strong>No se pudo consultar el expediente</strong>
          <p>{lookup.message}</p>
        </div>
      </div>
    )
  }

  const { data } = lookup
  return (
    <div className="history-content" aria-live="polite">
      <div className="record-header">
        <div>
          <span className="eyebrow">Expediente encontrado</span>
          <h3>{data.plate}</h3>
        </div>
        <span className={`status-pill ${data.is_fully_electric ? 'is-electric' : 'is-accepted'}`}>
          {data.is_fully_electric ? <BatteryWarning size={15} /> : <CheckCircle2 size={15} />}
          {data.is_fully_electric ? '100% eléctrico' : 'Recepción permitida'}
        </span>
      </div>

      <dl className="record-details">
        <div><dt>Cliente registrado</dt><dd>{data.customer_name}</dd></div>
        <div><dt>ID de expediente</dt><dd className="mono truncate">{data.id}</dd></div>
      </dl>

      <div className="history-heading">
        <span><Wrench size={17} /> Historial técnico</span>
        <strong>{data.history.length} {data.history.length === 1 ? 'registro' : 'registros'}</strong>
      </div>

      {data.history.length === 0 ? (
        <p className="history-empty">Este vehículo todavía no tiene registros técnicos.</p>
      ) : (
        <ol className="timeline">
          {data.history.map((item) => (
            <li key={item.id}>
              <span className="timeline-dot" />
              <div>
                <p>{item.description}</p>
                <time dateTime={item.createdAt}>
                  <Clock3 size={14} /> {formatDate(item.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
