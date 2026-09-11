import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PublicTrackingController } from './public-tracking.controller';
import { PublicTrackingService } from './public-tracking.service';
import { PublicTrackingRepository } from './repositories/public-tracking.repository';

@Module({
  imports: [PrismaModule],
  controllers: [PublicTrackingController],
  providers: [PublicTrackingService, PublicTrackingRepository],
})
export class PublicTrackingModule {}
