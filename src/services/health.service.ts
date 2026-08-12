import { Injectable } from '@nestjs/common';
import { HealthRepository, HealthStatus } from '../repositories/health.repository';

@Injectable()
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  getStatus(): HealthStatus {
    return this.healthRepository.getStatus();
  }
}
