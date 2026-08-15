import { Module } from '@nestjs/common';
import { VehicleStatusController } from './vehicle-status.controller';
import { VehicleStatusService } from './vehicle-status.service';
import { VehicleStatusRepository } from './repositories/vehicle-status.repository';

// BE-02: auth module owns internal authentication and the public client query
// (RN-17). For this refactor only the public vehicle status flow lives here.
@Module({
  controllers: [VehicleStatusController],
  providers: [VehicleStatusService, VehicleStatusRepository],
})
export class AuthModule {}
