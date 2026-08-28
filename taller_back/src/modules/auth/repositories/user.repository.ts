import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// BE-08: PrismaService is only injected inside repositories. Semantic
// data-access methods for authentication users (US-00 / BE-T00.1).
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findActiveById(id: string) {
    return this.prisma.user.findFirst({ where: { id, isActive: true } });
  }
}
