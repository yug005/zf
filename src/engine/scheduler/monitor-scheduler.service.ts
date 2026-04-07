import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MonitorCheckProducer } from '../producer/monitor-check.producer.js';
import type { MonitorCheckJobData } from '../constants.js';
import { SubscriptionAccessService } from '../../modules/billing/subscription-access.service.js';
import { SubscriptionStatus } from '@prisma/client';
import { MonitorSecretService } from '../../modules/monitor/monitor-secret.service.js';

/**
 * Scheduler service — periodically polls for active monitors
 * that are due for a check and enqueues them into BullMQ.
 *
 * Design decisions:
 *   - Uses a polling approach (setInterval) instead of BullMQ repeatable jobs.
 *     Reason: repeatable jobs are per-monitor and don't scale well to millions
 *     of monitors (each creates its own Redis key). Polling is O(1) Redis overhead.
 *   - Only enqueues monitors whose `lastCheckedAt + intervalSeconds < now()`.
 *   - Batches the query: fetches monitors in pages of 500.
 *   - Uses `updatedAt` optimistic locking to prevent double-enqueue in
 *     multi-instance deployments (distributed lock could be added later).
 */
@Injectable()
export class MonitorSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorSchedulerService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /** How often the scheduler polls for due monitors (ms) */
  private readonly pollIntervalMs: number;

  /** Batch size for fetching due monitors */
  private readonly batchSize = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: MonitorCheckProducer,
    private readonly configService: ConfigService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
    private readonly monitorSecretService: MonitorSecretService,
  ) {
    this.pollIntervalMs = this.configService.get<number>(
      'MONITOR_SCHEDULER_INTERVAL_MS',
      1_000,
    );
  }

  onModuleInit() {
    this.logger.log(
      `Starting monitor scheduler (poll every ${this.pollIntervalMs}ms)`,
    );
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);

    // Run immediately on startup
    void this.tick();
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('Monitor scheduler stopped');
  }

  /**
   * Single scheduler tick:
   *   1. Find all active monitors that are due for a check
   *   2. Enqueue them in bulk
   *   3. Update their lastCheckedAt to prevent re-enqueue
   */
  private async tick(): Promise<void> {
    // Prevent overlapping ticks
    if (this.isRunning) {
      this.logger.debug('Scheduler tick skipped — previous tick still running');
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();
      await this.subscriptionAccessService.expireTrials(now);
      let totalEnqueued = 0;
      let hasMore = true;
      let skip = 0;

      while (hasMore) {
        // Fetch a batch of active monitors, then filter the due ones in memory.
        const monitors = await this.prisma.monitor.findMany({
          where: {
            isActive: true,
            status: { not: 'PAUSED' },
            project: {
              user: {
                OR: [
                  { subscriptionStatus: SubscriptionStatus.ACTIVE },
                  {
                    subscriptionStatus: SubscriptionStatus.TRIALING,
                    trialEndAt: { gt: now },
                  },
                ],
              },
            },
          },
          select: {
            id: true,
            type: true,
            url: true,
            httpMethod: true,
            headers: true,
            body: true,
            timeoutMs: true,
            expectedStatus: true,
            retries: true,
            intervalSeconds: true,
            lastCheckedAt: true,
            authConfig: true,
            validationConfig: true,
            alertConfig: true,
            probeRegions: true,
            project: {
              select: {
                userId: true,
              },
            },
          },
          take: this.batchSize,
          skip,
          orderBy: { lastCheckedAt: 'asc' }, // Nulls first, then oldest first
        });

        if (monitors.length === 0) {
          hasMore = false;
          break;
        }

        // Filter to only those actually due
        const jobsToEnqueue: MonitorCheckJobData[] = [];
        const monitorIdsToMark: string[] = [];

        for (const monitor of monitors) {
          const isDue = this.isMonitorDue(monitor.lastCheckedAt, monitor.intervalSeconds, now);

          if (isDue) {
            let actualBody = monitor.body;
            let keywordConfig = undefined;
            const validationConfig = (monitor.validationConfig as Record<string, any> | null) ?? undefined;

            if (actualBody && typeof actualBody === 'object' && !Array.isArray(actualBody) && 'keywordConfig' in actualBody) {
              keywordConfig = (actualBody as any).keywordConfig;
              actualBody = (actualBody as any).httpBody;
            }

            if (!keywordConfig && validationConfig?.keyword) {
              keywordConfig = validationConfig.keyword;
            }

            const authConfig = await this.buildResolvedAuthConfig(
              monitor.project.userId,
              (monitor.authConfig as Record<string, any> | null) ?? undefined,
            );
            const probeRegions = Array.isArray(monitor.probeRegions) && monitor.probeRegions.length
              ? (monitor.probeRegions as string[])
              : ['default'];

            for (const region of probeRegions) {
              jobsToEnqueue.push({
                monitorId: monitor.id,
                type: monitor.type,
                url: monitor.url,
                method: monitor.httpMethod,
                headers: (monitor.headers as Record<string, string>) ?? undefined,
                body: actualBody ?? undefined,
                keywordConfig,
                validationConfig: validationConfig ?? undefined,
                authConfig,
                timeoutMs: monitor.timeoutMs,
                expectedStatus: monitor.expectedStatus ?? validationConfig?.expectedStatus ?? undefined,
                retries: monitor.retries,
                alertConfig: (monitor.alertConfig as Record<string, any>) ?? undefined,
                region,
              });
            }
            monitorIdsToMark.push(monitor.id);
          }
        }

        if (jobsToEnqueue.length > 0) {
          // Enqueue in bulk
          await this.producer.enqueueBulk(jobsToEnqueue);

          // Mark as "enqueued" by touching lastCheckedAt
          // This prevents re-enqueue on the next tick
          await this.prisma.monitor.updateMany({
            where: { id: { in: monitorIdsToMark } },
            data: { lastCheckedAt: now },
          });

          totalEnqueued += jobsToEnqueue.length;
        }

        // Advance pagination. If we got fewer than batchSize, we're done.
        skip += monitors.length;
        hasMore = monitors.length === this.batchSize;
      }

      if (totalEnqueued > 0) {
        this.logger.log(`Scheduler tick: enqueued ${totalEnqueued} monitor checks`);
      }
    } catch (error) {
      this.logger.error(
        'Scheduler tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Determine if a monitor is due for its next check.
   */
  private isMonitorDue(
    lastCheckedAt: Date | null,
    intervalSeconds: number,
    now: Date,
  ): boolean {
    if (!lastCheckedAt) return true; // Never checked → due immediately

    const nextCheckAt = new Date(lastCheckedAt.getTime() + intervalSeconds * 1000);
    return now >= nextCheckAt;
  }

  private async buildResolvedAuthConfig(
    userId: string,
    authConfig?: Record<string, any>,
  ): Promise<MonitorCheckJobData['authConfig'] | undefined> {
    if (!authConfig?.type || authConfig.type === 'NONE') {
      return undefined;
    }

    if (authConfig.type === 'BASIC') {
      return {
        type: 'BASIC',
        username: (await this.monitorSecretService.resolveSecretValue(userId, authConfig.usernameSecretId)) ?? undefined,
        password: (await this.monitorSecretService.resolveSecretValue(userId, authConfig.passwordSecretId)) ?? undefined,
      };
    }

    if (authConfig.type === 'MULTI_STEP') {
      return {
        type: 'MULTI_STEP',
        headerName: authConfig.headerName,
        multiStep: authConfig.multiStep,
      };
    }

    return {
      type: authConfig.type,
      headerName: authConfig.headerName,
      secretValue: (await this.monitorSecretService.resolveSecretValue(userId, authConfig.secretId)) ?? undefined,
    };
  }
}
