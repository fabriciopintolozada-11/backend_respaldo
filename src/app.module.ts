import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthRoutesModule } from './presentation/routes/health.routes';
import { RequestLoggingMiddleware } from './presentation/middlewares/request-logging.middleware';
import { DatabaseModule } from './infraestructure/database/database.module';
import { WorkOrdersModule } from './presentation/work-orders/work-orders.module';
import { AssignedOrdersModule } from './presentation/assigned-orders/assigned-orders.module';
import { VehicleStatusModule } from './presentation/vehicle-status/vehicle-status.module';

@Module({
  imports: [DatabaseModule, HealthRoutesModule, WorkOrdersModule, AssignedOrdersModule, VehicleStatusModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
