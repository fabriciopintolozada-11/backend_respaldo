import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { DEFAULT_LABOR_HOURLY_RATE } from '../quotes/quotes.service';

// BE-P02: typed access to workshop configuration. The official hourly labor
// rate is read from the environment once (BE-12.5) so business rules never
// depend on the frontend or raw env keys.
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  getLaborHourlyRate(): Prisma.Decimal {
    return new Prisma.Decimal(
      this.configService.get<string>('LABOR_HOURLY_RATE') ?? DEFAULT_LABOR_HOURLY_RATE,
    );
  }
}