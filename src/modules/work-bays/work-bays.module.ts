import { Module } from '@nestjs/common';
import { WorkBaysController } from './work-bays.controller';
import { WorkBaysService } from './work-bays.service';
import { WorkBayRepository } from './repositories/work-bay.repository';

// US-18 (BE-02): module owns the 4 physical workshop bays and the
// monitoring / assignment flows for the workshop lead.
@Module({
  controllers: [WorkBaysController],
  providers: [WorkBaysService, WorkBayRepository],
})
export class WorkBaysModule {}