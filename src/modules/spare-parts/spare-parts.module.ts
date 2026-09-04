import { Module } from '@nestjs/common';
import { SparePartsController } from './spare-parts.controller';
import { SparePartsService } from './spare-parts.service';
import { SparePartRepository } from './repositories/spare-part.repository';

@Module({
  controllers: [SparePartsController],
  providers: [SparePartsService, SparePartRepository],
})
export class SparePartsModule {}
