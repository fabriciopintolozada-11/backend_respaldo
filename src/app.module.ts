import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthRoutesModule } from './routes/health.routes';
import { RequestLoggingMiddleware } from './middlewares/request-logging.middleware';
import { DatabaseModule } from './database/database.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';

@Module({
  imports: [DatabaseModule, HealthRoutesModule, WorkOrdersModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
