import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { RequestLoggingMiddleware } from './presentation/middlewares/request-logging.middleware';
import { DatabaseModule } from './infraestructure/database/database.module';
import { HealthRoutesModule } from './presentation/routes/health.routes';
import { WorkOrdersModule } from './presentation/work-orders/work-orders.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssignedOrdersModule } from './modules/work-orders/assigned-orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [DatabaseModule, PrismaModule, HealthRoutesModule, WorkOrdersModule, AssignedOrdersModule, AuthModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
