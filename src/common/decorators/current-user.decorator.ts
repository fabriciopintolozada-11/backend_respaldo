import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// US-00 / BE-19: exposes the authenticated user (id + role) read from the JWT
// payload, never accepted from the request body.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  return request.user;
});
