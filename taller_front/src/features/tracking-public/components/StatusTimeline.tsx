import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_ORDER,
} from '../work-order-status';

export interface StatusTimelineProps {
  status: string;
}

export function StatusTimeline({ status }: StatusTimelineProps) {
  const currentIndex = WORK_ORDER_STATUS_ORDER.indexOf(
    status as (typeof WORK_ORDER_STATUS_ORDER)[number],
  );

  return (
    <ol className="status-timeline" aria-label="Etapas de la orden de trabajo">
      {WORK_ORDER_STATUS_ORDER.map((step, index) => {
        const isReached = currentIndex >= 0 && index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li
            key={step}
            className={isReached ? 'reached' : ''}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="status-timeline-dot" aria-hidden="true" />
            <span className="status-timeline-label">{WORK_ORDER_STATUS_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}