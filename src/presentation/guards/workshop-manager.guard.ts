import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class WorkshopManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const userId = request.header('x-user-id') ?? bearerToken;
    const role = request.header('x-user-role');

    if (!userId || (authorization && !bearerToken)) {
      throw new UnauthorizedException('Authentication is required');
    }
    if (role !== 'JEFE_TALLER') {
      throw new ForbiddenException('Workshop manager role is required');
    }

    request.user = { id: userId, role };
    return true;
  }
}
