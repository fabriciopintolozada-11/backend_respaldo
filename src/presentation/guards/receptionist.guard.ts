import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ReceptionistGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.header('x-user-id');
    const role = request.header('x-user-role');
    if (!userId) throw new UnauthorizedException('Authentication is required');
    if (role !== 'RECEPTIONIST') throw new ForbiddenException('Receptionist role is required');
    request.user = { id: userId, role };
    return true;
  }
}
