import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { AssignedOrdersModule } from './modules/work-orders/assigned-orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import Joi from 'joi';
import { QuotesModule } from './modules/quotes/quotes.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({ DATABASE_URL: Joi.string().required(), JWT_SECRET: Joi.string().min(32).required() }) }), JwtModule.register({}), PrismaModule, AssignedOrdersModule, AuthModule, QuotesModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
