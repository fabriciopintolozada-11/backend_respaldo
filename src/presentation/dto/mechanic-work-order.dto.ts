export class MechanicWorkOrderDto {
  id!: string;
  vehicleId!: string;
  plate!: string;
  status!: string;
  initialComplaint!: string;
  assignedAt!: Date | null;
}
