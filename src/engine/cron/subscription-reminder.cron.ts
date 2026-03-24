import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationService } from '../alerts/notification.service.js';
import { SubscriptionStatus } from '@prisma/client';
import { isAdminEmail } from '../../common/admin/admin.utils.js';

const REMINDER_DAYS = [7, 3, 1] as const;

@Injectable()
export class SubscriptionReminderCron {
  private readonly logger = new Logger(SubscriptionReminderCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Run every day at 9 AM to send trial expiry reminders.
   * Sends at 7 days, 3 days, and 1 day before trial ends.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleTrialReminders() {
    this.logger.log('Running trial expiry reminder job...');

    const now = new Date();

    for (const days of REMINDER_DAYS) {
      await this.sendRemindersForDay(days, now);
    }

    this.logger.log('Trial expiry reminder job complete.');
  }

  private async sendRemindersForDay(days: number, now: Date) {
    // Target: users whose trial ends exactly `days` from now (±12 hours to catch the day)
    const windowStart = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndAt: {
          gt: windowStart,
          lte: windowEnd,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        trialEndAt: true,
      },
    });

    for (const user of users) {
      // Skip admin accounts
      if (isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL') || '')) {
        continue;
      }

      // Check if we already sent this reminder
      const alreadySent = await this.prisma.subscriptionReminder.findFirst({
        where: {
          userId: user.id,
          daysBefore: days,
          channel: 'EMAIL',
        },
      });

      if (alreadySent) {
        continue;
      }

      // Send email reminder
      await this.sendEmailReminder(user.email, days, user.trialEndAt);

      // Record that we sent it
      await this.prisma.subscriptionReminder.create({
        data: {
          userId: user.id,
          remindAt: new Date(user.trialEndAt.getTime() - days * 24 * 60 * 60 * 1000),
          daysBefore: days,
          channel: 'EMAIL',
        },
      });

      // Create in-app notification
      await this.prisma.inAppNotification.create({
        data: {
          userId: user.id,
          type: 'TRIAL_EXPIRING',
          title: `Trial ends in ${days} day${days === 1 ? '' : 's'}`,
          message: `Your 14-day trial ends on ${user.trialEndAt.toLocaleDateString()}. Upgrade now to keep your monitors running without interruption.`,
          read: false,
        },
      });

      this.logger.log(`Sent ${days}-day trial reminder to ${user.email}`);
    }
  }

  private async sendEmailReminder(
    email: string,
    days: number,
    trialEndAt: Date,
  ) {
    const formattedDate = trialEndAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    try {
      await this.notificationService.sendTrialReminderEmail(email, days, formattedDate);
      this.logger.debug(`Email reminder sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email reminder to ${email}`, error);
    }
  }
}
