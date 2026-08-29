jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/user.repository';
import { UserRole } from '../../common/enums/user-role.enum';

describe('AuthService (US-00)', () => {
  let service: AuthService;
  const repository = {
    findByUsername: jest.fn(),
    findActiveById: jest.fn(),
  };
  const jwt = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const config = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  };

  const user = {
    id: '00000000-0000-4000-8000-000000000010',
    username: 'recep01',
    fullName: 'Recepcionista Uno',
    role: UserRole.RECEPTIONIST,
    isActive: true,
    passwordHash: 'hashed-password',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    config.getOrThrow.mockImplementation((key: string) =>
      key === 'JWT_SECRET' ? 'access-secret-123'.padEnd(32, 'x') : 'refresh-secret-123'.padEnd(32, 'x'),
    );
    config.get.mockImplementation((key: string) => (key === 'JWT_EXPIRES_IN' ? '15m' : '7d'));
    jwt.signAsync.mockResolvedValue('signed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: repository },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('returns an access + refresh token pair for valid credentials (US-00)', async () => {
    repository.findByUsername.mockResolvedValue(user);

    const result = await service.login({ username: 'recep01', password: 'Fratelli2026!' });

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(result.id).toBe(user.id);
    expect(result.role).toBe(UserRole.RECEPTIONIST);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns 401 for an unknown or inactive user without leaking which case (US-00)', async () => {
    repository.findByUsername.mockResolvedValue(null);

    await expect(service.login({ username: 'nobody', password: 'x' })).rejects.toThrow(UnauthorizedException);

    repository.findByUsername.mockResolvedValue({ ...user, isActive: false });
    await expect(service.login({ username: 'recep01', password: 'x' })).rejects.toThrow(UnauthorizedException);
  });

  it('returns 401 when the password is incorrect (US-00)', async () => {
    repository.findByUsername.mockResolvedValue(user);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(service.login({ username: 'recep01', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
  });

  it('issues a new token pair from a valid refresh token (US-00)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: user.id });
    repository.findActiveById.mockResolvedValue(user);

    const result = await service.refresh({ refreshToken: 'valid-refresh' });

    expect(jwt.verifyAsync).toHaveBeenCalled();
    expect(result.id).toBe(user.id);
    expect(result.accessToken).toBe('signed-token');
  });

  it('returns 401 for an invalid refresh token (US-00)', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(service.refresh({ refreshToken: 'bad' })).rejects.toThrow(UnauthorizedException);
  });

  it('returns the profile of an active user without the hash (US-00)', async () => {
    repository.findActiveById.mockResolvedValue(user);

    const result = await service.getProfile(user.id);

    expect(result.id).toBe(user.id);
    expect(result.role).toBe(UserRole.RECEPTIONIST);
    expect(result).not.toHaveProperty('passwordHash');
  });
});
