import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MonitorStatus, AlertStatus, AlertChannel, CheckStatus, IncidentStatus } from '@prisma/client';
import type { CheckExecutionResult } from './constants.js';
import { AlertProducer } from './producer/alert.producer.js';

type EngineMonitor = {
  id: string;
  name: string;
  url: string;
  status: MonitorStatus;
  consecutiveFailures: number;
  failureThreshold: number;
  project: { user: { email: string } };
};

/**
 * Core monitoring engine service.
 *
 * Responsibilities:
 *   1. Persist check results to the database
 *   2. Update monitor status (UP/DOWN) and consecutiveFailures counter
 *   3. Trigger alerts when failure threshold is crossed
 *   4. Auto-resolve alerts when a monitor recovers
 *   5. Enqueue notifications via AlertProducer
 *
 * This is the brain of the monitoring system — pure business logic.
 */
@Injectable()
export class MonitorEngineService {
  private readonly logger = new Logger(MonitorEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertProducer: AlertProducer,
  ) {}

  /**
   * Process a check execution result.
   * Called by the worker after the HTTP request completes (on final attempt).
   */
  async processCheckResult(
    monitorId: string,
    result: CheckExecutionResult,
  ): Promise<void> {
    const checkStatus = this.mapCheckStatus(result);

    // 1. Persist the check result
    await this.prisma.checkResult.create({
      data: {
        monitorId,
        status: checkStatus,
        statusCode: result.statusCode ?? null,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.errorMessage ?? null,
        checkedAt: new Date(),
      },
    });

    // 2. Load monitor for state transition logic
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        consecutiveFailures: true,
        failureThreshold: true,
        project: {
          select: {
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!monitor) {
      this.logger.warn(`Monitor ${monitorId} not found — skipping state update`);
      return;
    }

    if (result.success) {
      await this.handleSuccess(monitor);
    } else {
      await this.handleFailure(monitor, result);
    }
  }

  // ─── Success Handler ──────────────────────────────────────────

  /**
   * Handle a successful check:
   *   - Reset consecutive failures to 0
   *   - Set monitor status to UP
   *   - If the monitor was previously DOWN → auto-resolve open alerts
   */
  private async handleSuccess(monitor: EngineMonitor): Promise<void> {
    const wasDown = monitor.status === 'DOWN';

    // Update monitor state
    await this.prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        status: MonitorStatus.UP,
        consecutiveFailures: 0,
        lastCheckedAt: new Date(),
      },
    });

    // Auto-resolve open alerts if recovering from DOWN
    if (wasDown && monitor.consecutiveFailures > 0) {
      const resolved = await this.resolveOpenAlerts(monitor);
      await this.prisma.incident.updateMany({
        where: { monitorId: monitor.id, status: { not: IncidentStatus.RESOLVED } },
        data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() }
      });
      this.logger.log(
        `🟢 Monitor "${monitor.name}" recovered — resolved ${resolved} alert(s)`,
      );
    }
  }

  // ─── Failure Handler ──────────────────────────────────────────

  /**
   * Handle a failed check:
   *   - Increment consecutive failures
   *   - If threshold crossed → set monitor to DOWN + create alert
   *   - If already DOWN → just update the counter
   */
  private async handleFailure(
    monitor: EngineMonitor,
    result: CheckExecutionResult,
  ): Promise<void> {
    const newFailureCount = monitor.consecutiveFailures + 1;
    const thresholdCrossed = newFailureCount >= monitor.failureThreshold;
    const wasAlreadyDown = monitor.status === 'DOWN';

    // Update monitor state
    await this.prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        status: thresholdCrossed ? MonitorStatus.DOWN : MonitorStatus.DEGRADED,
        consecutiveFailures: newFailureCount,
        lastCheckedAt: new Date(),
      },
    });

    // Create alert ONLY on the transition to DOWN (not on every failure)
    if (thresholdCrossed && !wasAlreadyDown) {
      await this.createAlert(monitor, result, newFailureCount);
      await this.prisma.incident.create({
        data: {
          monitorId: monitor.id,
          status: IncidentStatus.INVESTIGATING,
          message: `Monitor "${monitor.name}" went DOWN. Last error: ${result.errorMessage ?? 'Unknown'}`,
        }
      });
      this.logger.warn(
        `🔴 Monitor "${monitor.name}" is DOWN — ${newFailureCount} consecutive failures (threshold: ${monitor.failureThreshold})`,
      );
    } else if (!thresholdCrossed) {
      this.logger.warn(
        `⚠️ Monitor "${monitor.name}" — failure ${newFailureCount}/${monitor.failureThreshold}: ${result.errorMessage}`,
      );
    }
  }

  // ─── Alert Management ────────────────────────────────────────

  /**
   * Create a TRIGGERED alert for a monitor that has crossed its failure threshold.
   */
  private async createAlert(
    monitor: EngineMonitor,
    result: CheckExecutionResult,
    failureCount: number,
  ): Promise<void> {
    const message = `Monitor "${monitor.name}" is DOWN after ${failureCount} consecutive failures. Last error: ${result.errorMessage ?? 'Unknown'}`;

    const alert = await this.prisma.alert.create({
      data: {
        monitorId: monitor.id,
        channel: AlertChannel.EMAIL,
        status: AlertStatus.TRIGGERED,
        message,
        metadata: {
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          errorMessage: result.errorMessage,
          failureCount,
          threshold: monitor.failureThreshold,
          triggeredAt: new Date().toISOString(),
        } as any,
      },
    });

    // Enqueue an alert delivery job
    await this.alertProducer.enqueueAlert({
      alertId: alert.id,
      monitorId: monitor.id,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      type: 'TRIGGERED',
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        recipientEmail: monitor.project.user.email,
        statusCode: result.statusCode,
      },
    });
  }

  /**
   * Auto-resolve all TRIGGERED alerts for a recovered monitor.
   */
  private async resolveOpenAlerts(monitor: EngineMonitor): Promise<number> {
    // We fetch the alerts to get their IDs, then update them and notify
    const openAlerts = await this.prisma.alert.findMany({
      where: {
        monitorId: monitor.id,
        status: AlertStatus.TRIGGERED,
      },
      select: { id: true },
    });

    if (openAlerts.length === 0) return 0;

    const alertIds = openAlerts.map(a => a.id);

    await this.prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    // Usually we just need one notification for the monitor recovering, 
    // even if there were multiple triggered alerts overlapping.
    const message = `Monitor "${monitor.name}" has RECOVERED.`;
    await this.alertProducer.enqueueAlert({
      alertId: alertIds[0], // pass the first resolved alert id
      monitorId: monitor.id,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      type: 'RESOLVED',
      message: message,
      timestamp: new Date().toISOString(),
      metadata: {
        recipientEmail: monitor.project.user.email,
        resolvedAlertCount: alertIds.length,
      },
    });

    return alertIds.length;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Map execution result to Prisma CheckStatus enum.
   */
  private mapCheckStatus(result: CheckExecutionResult): CheckStatus {
    if (result.success) return CheckStatus.SUCCESS;
    if (result.errorMessage?.includes('Timeout')) return CheckStatus.TIMEOUT;
    if (result.errorMessage?.includes('DNS') || result.errorMessage?.includes('Connection refused')) return CheckStatus.ERROR;
    return CheckStatus.FAILURE;
  }
}
