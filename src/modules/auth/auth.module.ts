import { Module } from '@nestjs/common';
import { VehicleStatusController } from './vehicle-status.controller';
import { VehicleStatusService } from './vehicle-status.service';
import { VehicleStatusRepository } from './repositories/vehicle-status.repository';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/user.repository';
import { JwtModule } from '@nestjs/jwt';

// BE-02: auth module owns internal authentication (US-00), the public client
// query (RN-17) and JWT strategy.
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [VehicleStatusController, AuthController],
  providers: [VehicleStatusService, VehicleStatusRepository, JwtStrategy, AuthService, UserRepository],
})
export class AuthModule {}
