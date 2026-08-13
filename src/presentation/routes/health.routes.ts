import { Module } from '@nestjs/common';
import { HealthController } from '../controllers/health.controller';
import { HealthRepository } from '../../infraestructure/repositories/health.repository';
import { HealthService } from '../../application/services/health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthRepository, HealthService],
})
export class HealthRoutesModule {}
