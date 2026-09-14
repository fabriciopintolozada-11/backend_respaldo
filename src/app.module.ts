import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { AssignedOrdersModule } from './modules/work-orders/assigned-orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import Joi from 'joi';
import { QuotesModule } from './modules/quotes/quotes.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WorkBaysModule } from './modules/work-bays/work-bays.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { UsersModule } from './modules/users/users.module';
import { AppConfigModule } from './modules/config/config.module';
import { PublicTrackingModule } from './modules/public-tracking/public-tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true, 
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        // BE-E14: explicit token lifetimes, no silent default.
        JWT_EXPIRES_IN: Joi.string().pattern(/^\d+\s*[smhd]$/).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().pattern(/^\d+\s*[smhd]$/).required(),
      }) 
    }), 
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),
    JwtModule.register({}), 
    PrismaModule, 
    AppConfigModule,
    UsersModule,
    AssignedOrdersModule, 
    AuthModule, 
    QuotesModule, 
    InventoryModule,
    WorkBaysModule,
    VehiclesModule,
    SettlementsModule,
    PublicTrackingModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // BE-E08: global auth + RBAC. @Public() marks public endpoints (login,
    // refresh, public-tracking, swagger).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
