import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from '@prisma/client';
import axios from 'axios';
import { Resend } from 'resend';
import { PLAN_DEFINITIONS } from '../../modules/billing/constants.js';
import type { AlertDeliveryJobData } from '../constants.js';

type EmailCta = {
  label: string;
  href: string;
};

type ShellOptions = {
  pretitle: string;
  title: string;
  summary: string;
  accent: string;
  badge: string;
  cta?: EmailCta;
  sections?: string[];
  footer: string;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private resend: Resend | null = null;
  private readonly emailFrom: string | null;
  private readonly slackWebhookUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.emailFrom =
      this.configService.get<string>('ALERT_EMAIL_FROM') ||
      this.configService.get<string>('NO_REPLY_EMAIL_FROM') ||
      'noreply@zer0friction.in';
    this.slackWebhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL', '');

    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
    } else {
      this.logger.warn('RESEND_API_KEY is not set. Email notifications are disabled.');
    }

    if (!this.slackWebhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL is not set. Slack notifications are disabled.');
    }
  }

  async sendNotifications(data: AlertDeliveryJobData): Promise<void> {
    const promises: Promise<void | unknown>[] = [];

    if (this.resend && this.emailFrom) {
      promises.push(this.sendAlertEmail(data));
    }

    if (this.slackWebhookUrl) {
      promises.push(this.sendSlack(data));
    }

    if (promises.length === 0) {
      this.logger.debug(`No notification channels configured for alert ${data.alertId}`);
      return;
    }

    const results = await Promise.allSettled(promises);
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(`Failed to send some notifications: ${JSON.stringify(failures)}`);
      throw new Error(`Notification delivery failed for ${failures.length} channels.`);
    }
  }

  async sendTrialReminderEmail(
    email: string,
    daysRemaining: number,
    trialEndDate: string,
  ): Promise<void> {
    const accent = daysRemaining === 1 ? '#dc2626' : daysRemaining <= 3 ? '#d97706' : '#4f46e5';
    const subject =
      daysRemaining === 1
        ? 'Last day of your Zer0Friction trial'
        : `Your Zer0Friction trial ends in ${daysRemaining} days`;

    await this.sendEmail(
      email,
      subject,
      this.buildShell({
        pretitle: 'Trial reminder',
        title: `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        summary: `Your 14-day trial ends on ${trialEndDate}. Upgrade now to keep monitoring, alerts, and new monitor creation active without interruption.`,
        accent,
        badge: daysRemaining === 1 ? 'Final day' : `${daysRemaining} days left`,
        cta: {
          label: 'Choose a plan',
          href: this.buildAppUrl('/billing'),
        },
        sections: [
          this.buildFactCard(
            'What stays visible',
            ['Dashboard and analytics', 'History and alert logs', 'Monitor configuration', 'Account settings'],
            '#0f766e',
            '#ecfeff',
          ),
          this.buildFactCard(
            'What pauses after expiry',
            ['Active checks', 'New monitor creation', 'Alert delivery', 'Fresh uptime calculations'],
            '#b45309',
            '#fffbeb',
          ),
          this.buildPlanStrip(),
        ],
        footer: 'You are receiving this because your Zer0Friction trial is active.',
      }),
    );

    this.logger.log(`Trial reminder email sent to ${email} (${daysRemaining} days before trial)`);
  }

  async sendTrialExpiredEmail(email: string, trialEndDate: string): Promise<void> {
    await this.sendEmail(
      email,
      'Your Zer0Friction trial has expired',
      this.buildShell({
        pretitle: 'Trial expired',
        title: 'Monitoring is now paused',
        summary: `Your 14-day trial ended on ${trialEndDate}. We kept your dashboard, history, and settings intact, but active checks and new monitor creation are now paused until you upgrade.`,
        accent: '#dc2626',
        badge: 'Action needed',
        cta: {
          label: 'Upgrade and resume',
          href: this.buildAppUrl('/billing'),
        },
        sections: [
          this.buildFactCard(
            'Still available',
            ['Dashboard access', 'Historical uptime and incidents', 'Project and monitor settings', 'Billing and account pages'],
            '#166534',
            '#f0fdf4',
          ),
          this.buildFactCard(
            'Currently paused',
            ['Scheduled monitoring', 'New monitor creation', 'Alert notifications', 'Live uptime calculations'],
            '#991b1b',
            '#fef2f2',
          ),
        ],
        footer: 'Upgrade anytime to restore monitoring immediately.',
      }),
    );

    this.logger.log(`Trial expired email sent to ${email}`);
  }

  async sendSubscriptionActivatedEmail(
    email: string,
    planName: string,
    nextStep?: string,
  ): Promise<void> {
    const summary = nextStep
      ? `${planName} is now active. ${nextStep}`
      : `${planName} is now active. Your monitors can run again, alerts stay live, and you can keep building inside your workspace.`;

    await this.sendEmail(
      email,
      `Your Zer0Friction ${planName} plan is active`,
      this.buildShell({
        pretitle: 'Subscription active',
        title: `${planName} is live`,
        summary,
        accent: '#059669',
        badge: 'Payment confirmed',
        cta: {
          label: 'Open dashboard',
          href: this.buildAppUrl('/dashboard'),
        },
        sections: [
          this.buildFactCard(
            'What is unlocked now',
            ['Monitoring is active', 'Alert delivery is enabled', 'Plan limits are applied instantly', 'Billing state is synced to your account'],
            '#065f46',
            '#ecfdf5',
          ),
        ],
        footer: 'Thanks for choosing Zer0Friction.',
      }),
    );

    this.logger.log(`Subscription activated email sent to ${email}`);
  }

  async sendSubscriptionCancelledEmail(email: string, planName: string): Promise<void> {
    await this.sendEmail(
      email,
      `Your Zer0Friction ${planName} plan has been cancelled`,
      this.buildShell({
        pretitle: 'Subscription cancelled',
        title: `${planName} has been cancelled`,
        summary:
          'Your paid plan has been cancelled. We preserved your dashboard, history, and settings, but active checks and new monitor creation are paused until you reactivate a plan.',
        accent: '#c2410c',
        badge: 'Cancelled',
        cta: {
          label: 'Reactivate plan',
          href: this.buildAppUrl('/billing'),
        },
        sections: [
          this.buildFactCard(
            'What stays available',
            ['Dashboard and historical data', 'Monitor settings', 'Alert history', 'Billing page access'],
            '#166534',
            '#f0fdf4',
          ),
          this.buildFactCard(
            'What is paused',
            ['Scheduled checks', 'New monitors', 'Email and Slack alerts', 'Live uptime updates'],
            '#9a3412',
            '#fff7ed',
          ),
        ],
        footer: 'You can reactivate anytime from billing.',
      }),
    );

    this.logger.log(`Subscription cancelled email sent to ${email}`);
  }

  async sendPaymentFailureEmail(
    email: string,
    planName: string,
    retryDate?: string,
    finalFailure = false,
  ): Promise<void> {
    const subject = finalFailure
      ? `We could not renew your Zer0Friction ${planName} plan`
      : `Payment issue on your Zer0Friction ${planName} renewal`;

    const summary = finalFailure
      ? `We could not renew your ${planName} subscription after repeated attempts. Monitoring may now be paused until you update billing and reactivate the plan.`
      : retryDate
        ? `Your latest renewal attempt for ${planName} did not go through. Razorpay may retry automatically, but we recommend updating billing details before ${retryDate} to avoid interruption.`
        : `Your latest renewal attempt for ${planName} did not go through. Please review billing details now to avoid monitoring interruption.`;

    await this.sendEmail(
      email,
      subject,
      this.buildShell({
        pretitle: 'Billing issue',
        title: finalFailure ? 'Renewal failed' : 'Action needed on billing',
        summary,
        accent: '#d97706',
        badge: finalFailure ? 'Retries exhausted' : 'Payment failed',
        cta: {
          label: finalFailure ? 'Fix billing and reactivate' : 'Update billing details',
          href: this.buildAppUrl('/billing'),
        },
        sections: [
          this.buildFactCard(
            'Recommended next steps',
            finalFailure
              ? ['Open billing', 'Check payment method', 'Start a fresh subscription if needed', 'Confirm monitoring resumes']
              : ['Open billing', 'Verify payment method', 'Watch for the next retry', 'Confirm plan remains active'],
            '#92400e',
            '#fffbeb',
          ),
        ],
        footer: 'If Razorpay also sends customer payment notifications, those can arrive alongside this product email.',
      }),
    );

    this.logger.log(`Payment failure email sent to ${email}`);
  }

  private async sendAlertEmail(data: AlertDeliveryJobData): Promise<void> {
    const isTriggered = data.type === 'TRIGGERED';
    const subject = `${isTriggered ? 'Monitor down' : 'Monitor recovered'}: ${data.monitorName}`;
    const accent = isTriggered ? '#dc2626' : '#059669';
    const summary = isTriggered
      ? `${data.monitorName} is reporting failures. Review the latest incident details and investigate the target endpoint.`
      : `${data.monitorName} has recovered and is responding again.`;

    await this.sendEmail(
      data.metadata?.recipientEmail || 'admin@example.com',
      subject,
      this.buildShell({
        pretitle: 'Monitor alert',
        title: isTriggered ? `${data.monitorName} is down` : `${data.monitorName} recovered`,
        summary,
        accent,
        badge: isTriggered ? 'Triggered' : 'Resolved',
        cta: {
          label: 'Open dashboard',
          href: this.buildAppUrl('/dashboard'),
        },
        sections: [
          this.buildMetricPanel([
            ['Monitor', this.escapeHtml(data.monitorName)],
            ['URL', this.escapeHtml(data.monitorUrl)],
            ['Status', this.escapeHtml(data.type)],
            ['Time', this.escapeHtml(data.timestamp)],
          ]),
          `<div style="margin-top: 18px; padding: 18px 20px; border-radius: 18px; background: #0f172a; color: #e2e8f0;">
            <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px;">Latest message</div>
            <div style="font-size: 15px; line-height: 1.7;">${this.escapeHtml(data.message)}</div>
          </div>`,
        ],
        footer: 'This alert was generated by Zer0Friction monitoring.',
      }),
    );

    this.logger.log(
      `Email sent for alert ${data.alertId} to ${data.metadata?.recipientEmail || 'admin@example.com'}`,
    );
  }

  private async sendSlack(data: AlertDeliveryJobData): Promise<void> {
    const color = data.type === 'TRIGGERED' ? '#ef4444' : '#22c55e';
    const title = data.type === 'TRIGGERED' ? 'Monitor DOWN' : 'Monitor RECOVERED';

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `${title}: ${data.monitorName}` },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Status:* ${data.type}\n*URL:* ${data.monitorUrl}\n*Message:* ${data.message}`,
              },
            },
            {
              type: 'context',
              elements: [{ type: 'mrkdwn', text: `*Time:* ${data.timestamp}` }],
            },
          ],
        },
      ],
    };

    await axios.post(this.slackWebhookUrl!, payload, { timeout: 10_000 });
    this.logger.log(`Slack notification sent for alert ${data.alertId}`);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend || !this.emailFrom) {
      this.logger.warn(`Email skipped for ${to} because Resend is not configured.`);
      return;
    }

    await this.resend.emails.send({
      from: `Zer0Friction <${this.emailFrom}>`,
      to,
      subject,
      html,
    });
  }

  private buildShell(options: ShellOptions): string {
    const ctaHtml = options.cta
      ? `<a href="${options.cta.href}" style="display: inline-block; padding: 14px 24px; border-radius: 14px; background: ${options.accent}; color: #ffffff; font-weight: 700; text-decoration: none; letter-spacing: -0.01em;">${this.escapeHtml(options.cta.label)}</a>`
      : '';

    const sections = options.sections?.join('') || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.escapeHtml(options.title)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f3f4f6; color: #0f172a; font-family: 'Segoe UI', Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: radial-gradient(circle at top, #e2e8f0 0%, #f8fafc 42%, #eef2ff 100%); padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 640px;">
          <tr>
            <td style="padding: 0 0 12px 0; text-align: left; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; font-weight: 700;">
              Zer0Friction
            </td>
          </tr>
          <tr>
            <td style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 28px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);">
              <div style="padding: 32px 32px 12px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, ${options.accent}14 100%);">
                <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: ${options.accent}14; border: 1px solid ${options.accent}33; color: ${options.accent}; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">
                  ${this.escapeHtml(options.badge)}
                </div>
                <div style="margin-top: 20px; font-size: 12px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;">
                  ${this.escapeHtml(options.pretitle)}
                </div>
                <h1 style="margin: 12px 0 0; font-size: 34px; line-height: 1.1; letter-spacing: -0.03em; color: #0f172a;">
                  ${this.escapeHtml(options.title)}
                </h1>
                <p style="margin: 16px 0 0; font-size: 16px; line-height: 1.8; color: #334155;">
                  ${this.escapeHtml(options.summary)}
                </p>
                ${ctaHtml ? `<div style="margin-top: 24px;">${ctaHtml}</div>` : ''}
              </div>
              <div style="padding: 12px 32px 8px;">
                ${sections}
              </div>
              <div style="padding: 0 32px 32px; color: #64748b; font-size: 13px; line-height: 1.7;">
                ${this.escapeHtml(options.footer)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildFactCard(
    title: string,
    items: string[],
    headingColor: string,
    background: string,
  ): string {
    return `<div style="margin-top: 18px; padding: 20px; border-radius: 20px; background: ${background}; border: 1px solid #e5e7eb;">
      <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: ${headingColor}; font-weight: 700; margin-bottom: 10px;">${this.escapeHtml(title)}</div>
      ${items
        .map(
          (item) =>
            `<div style="padding: 8px 0; font-size: 15px; line-height: 1.6; color: #0f172a;">${this.escapeHtml(item)}</div>`,
        )
        .join('')}
    </div>`;
  }

  private buildMetricPanel(rows: Array<[string, string]>): string {
    return `<div style="margin-top: 18px; padding: 18px 20px; border-radius: 20px; background: #f8fafc; border: 1px solid #e2e8f0;">
      ${rows
        .map(
          ([label, value]) =>
            `<div style="display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;">${label}</span>
              <span style="font-size: 14px; color: #0f172a; text-align: right; word-break: break-word;">${value}</span>
            </div>`,
        )
        .join('')}
    </div>`.replace(/border-bottom: 1px solid #e2e8f0;"><span/g, 'border-bottom: 1px solid #e2e8f0;"><span');
  }

  private buildPlanStrip(): string {
    const plans: SubscriptionPlan[] = [SubscriptionPlan.LITE, SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS];

    return `<div style="margin-top: 18px; padding: 20px; border-radius: 22px; background: #0f172a; color: #ffffff;">
      <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 14px;">Popular plans</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${plans
            .map((plan) => {
              const details = PLAN_DEFINITIONS[plan];
              return `<td style="padding-right: 10px; vertical-align: top;">
                <div style="padding: 16px; border-radius: 18px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);">
                  <div style="font-size: 12px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.06em;">${this.escapeHtml(details.name)}</div>
                  <div style="margin-top: 6px; font-size: 26px; font-weight: 800; letter-spacing: -0.03em;">&#8377;${details.price}</div>
                  <div style="margin-top: 8px; font-size: 13px; color: #94a3b8;">${details.maxMonitors} monitors</div>
                </div>
              </td>`;
            })
            .join('')}
        </tr>
      </table>
    </div>`;
  }

  private buildAppUrl(path: string): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    return `${frontendUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
