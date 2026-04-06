import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isAdminEmail } from '../../common/admin/admin.utils.js';
import { PLAN_LIMITS } from '../billing/constants.js';
import { ManualAccessService } from '../billing/manual-access.service.js';
import { SubscriptionAccessService } from '../billing/subscription-access.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthenticatedUser, JwtPayload, TokenPair } from './interfaces/index.js';

const BCRYPT_SALT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;

type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    isAdmin: boolean;
  };
  tokens?: TokenPair;
  requiresEmailVerification?: boolean;
  message?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
    private readonly manualAccessService: ManualAccessService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    this.validatePassword(dto.password);

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const isAdmin = this.isAdmin(email);
    const verificationToken = isAdmin ? null : this.createRawToken();
    const verificationHash = verificationToken
      ? await bcrypt.hash(verificationToken, BCRYPT_SALT_ROUNDS)
      : null;
    const trialWindow = this.subscriptionAccessService.buildTrialWindow();
    const adminPlan = PLAN_LIMITS[SubscriptionPlan.ENTERPRISE];
    const defaultPlan = PLAN_LIMITS[SubscriptionPlan.TRIAL];

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: dto.name,
        verificationTokenHash: verificationHash,
        isVerified: isAdmin,
        trialStartAt: trialWindow.trialStartAt,
        trialEndAt: trialWindow.trialEndAt,
        subscriptionPlan: isAdmin ? SubscriptionPlan.ENTERPRISE : SubscriptionPlan.TRIAL,
        subscriptionStatus: isAdmin ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING,
        monitorLimit: isAdmin ? adminPlan.maxMonitors : defaultPlan.maxMonitors,
      },
      select: {
        id: true,
        email: true,
        name: true,
        sessionVersion: true,
      },
    });

    await this.ensureDefaultProject(user.id);
    await this.manualAccessService.claimPendingGrantsForUser(user.id, user.email);

    if (!isAdmin && verificationToken) {
      await this.sendVerificationEmail(user.email, verificationToken);
      this.logger.log(`User registered and pending verification: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: false,
        },
        requiresEmailVerification: true,
        message: 'Please verify your email address to activate your 14-day trial.',
      };
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
    });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: true,
      },
      tokens,
    };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user || !user.isActive || user.isVerified || this.isAdmin(user.email)) {
      return {
        message: 'If that account still needs verification, a new email has been sent.',
      };
    }

    const verificationToken = this.createRawToken();
    const verificationHash = await bcrypt.hash(verificationToken, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash: verificationHash,
      },
    });

    await this.sendVerificationEmail(user.email, verificationToken);

    return {
      message: 'If that account still needs verification, a new email has been sent.',
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        isActive: true,
        isVerified: true,
        sessionVersion: true,
      },
    });

    if (!user) {
      await bcrypt.hash('dummy-password', BCRYPT_SALT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    const isPasswordValid =
      Boolean(user.password) && (await bcrypt.compare(dto.password, user.password));
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified && !this.isAdmin(user.email)) {
      throw new ForbiddenException(
        'Please verify your email address to log in. Check your inbox for the link.',
      );
    }

    await this.ensureDefaultProject(user.id);
    await this.manualAccessService.claimPendingGrantsForUser(user.id, user.email);

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
    });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: this.isAdmin(user.email),
      },
      tokens,
    };
  }

  async verifyEmail(
    email: string,
    token: string,
  ): Promise<{ success: boolean; alreadyVerified?: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new ForbiddenException('Invalid verification request.');
    }

    if (user.isVerified || !user.verificationTokenHash) {
      this.logger.log(`Verification link revisited for already verified account ${user.email}`);
      return { success: true, alreadyVerified: true };
    }

    const isValidToken = await bcrypt.compare(token, user.verificationTokenHash);
    if (!isValidToken) {
      throw new ForbiddenException('Invalid verification token.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationTokenHash: null,
      },
    });
    await this.manualAccessService.claimPendingGrantsForUser(user.id, user.email);

    this.logger.log(`Email verified successfully for ${user.email}`);
    return { success: true };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        isVerified: true,
        refreshTokenHash: true,
        sessionVersion: true,
      },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new ForbiddenException('Access denied or no active session');
    }

    if (!user.isVerified && !this.isAdmin(user.email)) {
      throw new ForbiddenException('Email verification is required before creating a session.');
    }

    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isTokenValid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokenHash: null,
          sessionVersion: { increment: 1 },
        },
      });
      throw new ForbiddenException('Session invalidated. Please log in again.');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
    });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpires: expiresAt,
      },
    });

    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const emailFrom =
      this.configService.get<string>('NO_REPLY_EMAIL_FROM') || 'noreply@zer0friction.in';

    if (resendKey) {
      const resend = new Resend(resendKey);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

      try {
        await resend.emails.send({
          from: `Zer0Friction <${emailFrom}>`,
          to: user.email,
          subject: 'Reset your password - Zer0Friction',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
                .header { background: #0f172a; padding: 32px; text-align: center; }
                .content { padding: 40px; color: #1e293b; line-height: 1.6; }
                .button { display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: 600; margin: 24px 0; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
                .footer { padding: 24px; background: #f1f5f9; text-align: center; font-size: 13px; color: #64748b; }
                .token-info { font-size: 12px; color: #94a3b8; margin-top: 16px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Zer0Friction</h1>
                </div>
                <div class="content">
                  <h2 style="margin-top: 0; color: #0f172a;">Password Reset Request</h2>
                  <p>We received a request to reset your Zer0Friction password. Click the button below to securely set a new one:</p>
                  <div style="text-align: center;">
                    <a href="${resetLink}" class="button">Reset Password</a>
                  </div>
                  <p style="margin-bottom: 0;">This secure link will expire in <strong>15 minutes</strong>.</p>
                  <p class="token-info">If you did not request this, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                  &copy; 2026 Zer0Friction. All rights reserved.<br>
                  Level up your infrastructure monitoring.
                </div>
              </div>
            </body>
            </html>
          `,
        });
        this.logger.log(`Sent reset email to ${user.email}`);
      } catch (error: unknown) {
        this.logger.error(
          `Failed to send reset email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      this.logger.warn(`No RESEND_API_KEY found. Generated reset token for testing only.`);
    }

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    this.validatePassword(newPassword);

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive || !user.resetTokenHash || !user.resetTokenExpires) {
      throw new ForbiddenException('Invalid or expired reset token');
    }

    if (new Date() > user.resetTokenExpires) {
      throw new ForbiddenException('Reset token has expired');
    }

    const isValidToken = await bcrypt.compare(token, user.resetTokenHash);
    if (!isValidToken) {
      throw new ForbiddenException('Invalid reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetTokenHash: null,
        resetTokenExpires: null,
        refreshTokenHash: null,
        sessionVersion: { increment: 1 },
      },
    });

    this.logger.log(`Password successfully reset for ${user.email}`);
    return { success: true };
  }

  async validateOAuthUser(
    profile: Record<string, unknown>,
    provider: 'google' | 'github',
  ): Promise<{ user: AuthResponse['user']; tokens: TokenPair }> {
    const email = String(profile.email || '').toLowerCase().trim();
    if (!email) {
      throw new ForbiddenException('OAuth provider did not return a verified email address.');
    }

    const name = typeof profile.name === 'string' ? profile.name : null;
    const avatarUrl = typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null;
    const providerIdField = provider === 'google' ? 'googleId' : 'githubId';
    const providerIdValue = String(profile[providerIdField] || '');
    const isAdmin = this.isAdmin(email);
    const trialWindow = this.subscriptionAccessService.buildTrialWindow();

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ [providerIdField]: providerIdValue }, { email }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        sessionVersion: true,
        googleId: true,
        githubId: true,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl,
          password: '',
          isVerified: true,
          [providerIdField]: providerIdValue,
          trialStartAt: trialWindow.trialStartAt,
          trialEndAt: trialWindow.trialEndAt,
          subscriptionPlan: isAdmin ? SubscriptionPlan.ENTERPRISE : SubscriptionPlan.TRIAL,
          subscriptionStatus: isAdmin ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING,
          monitorLimit: isAdmin
            ? PLAN_LIMITS[SubscriptionPlan.ENTERPRISE].maxMonitors
            : PLAN_LIMITS[SubscriptionPlan.TRIAL].maxMonitors,
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          sessionVersion: true,
          googleId: true,
          githubId: true,
        },
      });
      await this.ensureDefaultProject(user.id);
      await this.manualAccessService.claimPendingGrantsForUser(user.id, user.email);
    } else if (!user[providerIdField as keyof typeof user]) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          [providerIdField]: providerIdValue,
          avatarUrl: user.avatarUrl || avatarUrl,
          isVerified: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          sessionVersion: true,
          googleId: true,
          githubId: true,
        },
      });
    }

    await this.manualAccessService.claimPendingGrantsForUser(user.id, user.email);

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
    });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin,
      },
      tokens,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        sessionVersion: { increment: 1 },
      },
    });
    this.logger.log(`User logged out: ${userId}`);
  }

  async getProfile(userId: string) {
    const access = await this.subscriptionAccessService.syncUserStateById(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      ...user,
      subscriptionPlan: access.subscriptionPlan,
      subscriptionStatus: access.subscriptionStatus,
      accessSource: access.accessSource,
      accessReason: access.accessReason,
      enterpriseAccessMode: access.enterpriseAccessMode,
      trialStartAt: access.trialStartAt,
      trialEndAt: access.trialEndAt,
      monitorLimit: access.monitorLimit,
      hasMonitoringAccess: access.hasMonitoringAccess,
      canCreateMonitors: access.canCreateMonitors,
      daysRemainingInTrial: access.daysRemainingInTrial,
      scheduledGrant: access.grantMetadata.scheduledGrant,
      isAdmin: access.isAdmin,
    };
  }

  private async sendVerificationEmail(email: string, token: string) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const emailFrom =
      this.configService.get<string>('NO_REPLY_EMAIL_FROM') || 'noreply@zer0friction.in';

    if (!resendKey) {
      return;
    }

    const resend = new Resend(resendKey);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const verifyLink = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    try {
      await resend.emails.send({
        from: `Zer0Friction <${emailFrom}>`,
        to: email,
        subject: 'Verify your email - Zer0Friction',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
              .header { background: #2563eb; padding: 32px; text-align: center; }
              .content { padding: 40px; color: #1e293b; line-height: 1.6; }
              .button { display: inline-block; padding: 14px 32px; background-color: #0f172a; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: 600; margin: 24px 0; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.2); }
              .footer { padding: 24px; background: #f1f5f9; text-align: center; font-size: 13px; color: #64748b; }
              .welcome-badge { display: inline-block; padding: 6px 12px; background: #dbeafe; color: #2563eb; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Zer0Friction</h1>
              </div>
              <div class="content">
                <div class="welcome-badge">Action Required</div>
                <h2 style="margin-top: 0; color: #0f172a;">Activate your 14-day trial</h2>
                <p>Verify your email address to unlock your trial workspace and start monitoring your infrastructure.</p>
                <div style="text-align: center;">
                  <a href="${verifyLink}" class="button">Verify Email Address</a>
                </div>
                <p style="margin-bottom: 0; font-size: 14px; color: #64748b;">If the button above doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; font-size: 12px; color: #3b82f6;">${verifyLink}</p>
              </div>
              <div class="footer">
                &copy; 2026 Zer0Friction. All rights reserved.<br>
                Security &amp; Uptime, simplified.
              </div>
            </div>
          </body>
          </html>
        `,
      });
      this.logger.log(`Sent verification email to ${email}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private createRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async generateTokens(payload: JwtPayload): Promise<TokenPair> {
    const tokenBody = { email: payload.email, sv: payload.sv };

    const accessToken = this.jwtService.sign(tokenBody, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
      subject: payload.sub,
    } as never);

    const refreshToken = this.jwtService.sign(tokenBody, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      subject: payload.sub,
    } as never);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  private async ensureDefaultProject(userId: string): Promise<void> {
    const slug = `workspace-${userId.slice(0, 8)}`;
    await this.prisma.project.upsert({
      where: { slug },
      update: {},
      create: {
        name: 'Primary Workspace',
        slug,
        description: 'Auto-created workspace for quick start.',
        userId,
      },
    });
  }

  private validatePassword(password: string): void {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new ForbiddenException(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
      );
    }

    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLetter || !hasNumber) {
      throw new ForbiddenException('Password must include at least one letter and one number.');
    }
  }

  private isAdmin(email: string): boolean {
    return isAdminEmail(email, this.configService.get<string>('ADMIN_EMAIL'));
  }
}
