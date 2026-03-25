import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { ProjectModule } from './modules/project/project.module.js';
import { MonitorModule } from './modules/monitor/monitor.module.js';
import { CheckModule } from './modules/check/check.module.js';
import { AlertModule } from './modules/alert/alert.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { ApiKeyModule } from './modules/api-key/api-key.module.js';
import { NotificationModule } from './modules/notifications/notification.module.js';
import { IncidentModule } from './modules/incident/incident.module.js';
import { ChangeModule } from './modules/change/change.module.js';
import { MonitorEngineModule } from './engine/monitor-engine.module.js';
import { JwtAccessGuard } from './modules/auth/guards/jwt-access.guard.js';
import { StatusPagesModule } from './status-pages/status-pages.module';

@Module({
  imports: [
    // ─── Config (loads .env globally) ──────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // ─── Cron Scheduler ───────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Rate Limiter (Brute-Force & DDoS protection) ─────────
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // ─── BullMQ (Redis-backed queues) ─────────────────────────
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');
        const url = new URL(redisUrl);
        const isTls = url.protocol === 'rediss:';

        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            username: url.username || undefined,
            password: url.password || undefined,
            tls: isTls ? {} : undefined,
          },
        };
      },
    }),

    // ─── Core Modules ─────────────────────────────────────────
    PrismaModule,
    HealthModule,

    // ─── Monitoring Engine (scheduler + queue + worker) ───────
    MonitorEngineModule,

    // ─── Feature Modules ──────────────────────────────────────
    AuthModule,
    UserModule,
    ProjectModule,
    MonitorModule,
    CheckModule,
    AlertModule,
    IncidentModule,
    ChangeModule,
    BillingModule,
    ApiKeyModule,
    NotificationModule,
    StatusPagesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ─── Global Auth Guard (secure-by-default) ────────────────
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
  ],
})
export class AppModule {}
