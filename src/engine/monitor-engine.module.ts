import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MONITOR_CHECK_QUEUE, ALERT_DELIVERY_QUEUE } from './constants.js';
import { MonitorCheckProducer } from './producer/monitor-check.producer.js';
import { MonitorCheckProcessor } from './processor/monitor-check.processor.js';
import { MonitorEngineService } from './monitor-engine.service.js';
import { MonitorSchedulerService } from './scheduler/monitor-scheduler.service.js';
import { AlertProducer } from './producer/alert.producer.js';
import { AlertProcessor } from './processor/alert.processor.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { LogCleanupCron } from './cron/log-cleanup.cron.js';
import { SubscriptionReminderCron } from './cron/subscription-reminder.cron.js';
import { BillingModule } from '../modules/billing/billing.module.js';

/**
 * MonitorEngineModule — the core monitoring execution pipeline.
 *
 * Architecture:
 *   Scheduler → Producer → Redis Queue → Worker/Processor → Engine Service → DB
 *
 *   [MonitorSchedulerService]   Polls DB for due monitors, enqueues jobs
 *         ↓
 *   [MonitorCheckProducer]      Adds jobs to BullMQ queue
 *         ↓
 *   [Redis: monitor-check-queue]
 *         ↓
 *   [MonitorCheckProcessor]     Consumes jobs, executes HTTP via executor
 *         ↓
 *   [MonitorEngineService]      Persists results, manages state + alerts
 */
@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: MONITOR_CHECK_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultJobOptions: {
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400, count: 5000 },
        },
      }),
    }),
    BullModule.registerQueueAsync({
      name: ALERT_DELIVERY_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultJobOptions: {
          removeOnComplete: { age: 86400, count: 500 },
          removeOnFail: { age: 604800, count: 1000 },
        },
      }),
    }),
    BillingModule,
    AlertsModule,
  ],
  providers: [
    MonitorEngineService,
    MonitorCheckProducer,
    MonitorCheckProcessor,
    MonitorSchedulerService,
    AlertProducer,
    AlertProcessor,
    LogCleanupCron,
    SubscriptionReminderCron,
  ],
  exports: [MonitorCheckProducer, MonitorEngineService, AlertProducer, AlertsModule],
})
export class MonitorEngineModule {}
