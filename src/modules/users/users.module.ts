import { Module } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';

// BE-P02: users module owns the workshop user accounts. AuthModule consumes
// UserRepository from here for credential verification and JWT subject data.
@Module({
  providers: [UserRepository],
  exports: [UserRepository],
})
export class UsersModule {}