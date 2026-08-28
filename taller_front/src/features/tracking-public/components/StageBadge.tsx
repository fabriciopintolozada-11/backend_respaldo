import { WORK_ORDER_STATUS_LABELS } from '../work-order-status';

export interface StageBadgeProps {
  status: string;
  stage: string;
}

export function StageBadge({ status, stage }: StageBadgeProps) {
  const label = WORK_ORDER_STATUS_LABELS[status] ?? stage;
  return <span className="stage-badge">{label}</span>;
}