import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { StringValue } from 'ms';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserRepository } from './repositories/user.repository';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';

// US-00 / BE-27: JWT access + refresh tokens signed via Passport JWT library,
// keys and expirations are configurable via environment variables.
const INVALID_CREDENTIALS = 'Credenciales de acceso incorrectas o usuario inactivo';

export interface AuthUser {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: UserRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.repository.findByUsername(dto.username.trim());
    if (!user || !user.isActive) {
      // US-00: unified message hides whether the account exists or is inactive.
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthResponseDto> {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.repository.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuario no encontrado o inactivo');
    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.repository.findActiveById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado o inactivo');
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role as UserRole,
      isActive: user.isActive,
    };
  }

  private async buildAuthResponse(user: { id: string; fullName: string; username: string; role: string }): Promise<AuthResponseDto> {
    const accessSecret = this.config.getOrThrow<string>('JWT_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpires = (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as StringValue;
    const refreshExpires = (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as StringValue;

    const accessToken = await this.jwt.signAsync(
      { role: user.role },
      { secret: accessSecret, expiresIn: accessExpires, subject: user.id },
    );
    const refreshToken = await this.jwt.signAsync(
      {},
      { secret: refreshSecret, expiresIn: refreshExpires, subject: user.id },
    );

    return {
      accessToken,
      refreshToken,
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role as UserRole,
    };
  }
}
