import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../enums/user-role.enum';

// Temporary stand-in until BE-27 real JWT authentication is implemented.
// Resolves the current user from development headers and attaches it to the
// request so RolesGuard (BE-29) can authorize the route.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.header('x-user-id');
    const role = request.header('x-user-role');

    if (!userId || !this.isKnownRole(role)) {
      throw new UnauthorizedException('Authentication is required');
    }

    request.user = { id: userId, role };
    return true;
  }

  private isKnownRole(role: string | undefined): role is UserRole {
    return !!role && Object.values(UserRole).includes(role as UserRole);
  }
}
