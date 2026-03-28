import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class LogCleanupCron {
  private readonly logger = new Logger(LogCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run every night at midnight to delete CheckResults older than 30 days
   * to prevent the database from exhausting its disk space.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleLogCleanup() {
    this.logger.log('Started routine CheckResult cleanup cron job...');
    
    // Calculate date exactly 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const { count } = await this.prisma.checkResult.deleteMany({
        where: {
          checkedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(`Successfully purged ${count} expired CheckResult records from the database.`);
    } catch (error) {
      this.logger.error('Failed to execute CheckResult cleanup cron job', error);
    }
  }
}
