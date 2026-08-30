import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { QuotesController } from './quotes.controller';

describe('QuotesController', () => {
  it('declares only the authorized HU-12 roles', () => {
    expect(new Reflector().get(ROLES_KEY, QuotesController)).toEqual([
      UserRole.RECEPTIONIST,
      UserRole.WORKSHOP_LEAD,
      UserRole.ADMIN,
    ]);
  });
});
