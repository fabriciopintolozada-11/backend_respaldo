import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/user.repository';
import { RevokedRefreshTokenRepository } from './repositories/revoked-refresh-token.repository';
import { JwtModule } from '@nestjs/jwt';

// BE-02: auth module owns internal authentication (US-00), JWT strategy.
// The public customer tracking query (RN-17) lives in PublicTrackingModule.
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, UserRepository, RevokedRefreshTokenRepository],
})
export class AuthModule {}
