import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class HealthRepository {
  getStatus(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
