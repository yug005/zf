import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';
import type { AuthenticatedUser } from './interfaces/index.js';

const ACCESS_COOKIE = 'zf_access_token';
const REFRESH_COOKIE = 'zf_refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    if (result.tokens) {
      this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    }
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    if (result.tokens) {
      this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    }
    return result;
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as AuthenticatedUser & { refreshToken: string };
    const tokens = await this.authService.refreshTokens(user.id, user.refreshToken);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { success: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendVerificationEmail(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Body('email') email: string,
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(email, token, newPassword);
  }

  @Public()
  @Get('verify-email')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verifyEmail(@Query('email') email: string, @Query('token') token: string) {
    return this.authService.verifyEmail(email, token);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() _req: Request) {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const { tokens } = await this.authService.validateOAuthUser(
      req.user as Record<string, unknown>,
      'google',
    );
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    return res.redirect(`${frontendUrl}/auth-success`);
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth(@Req() _req: Request) {}

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const { tokens } = await this.authService.validateOAuthUser(
      req.user as Record<string, unknown>,
      'github',
    );
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    return res.redirect(`${frontendUrl}/auth-success`);
  }

  @Public()
  @Post('clear-session')
  @HttpCode(HttpStatus.OK)
  async clearSession(@Res({ passthrough: true }) res: Response, @Headers('origin') _origin?: string) {
    this.clearAuthCookies(res);
    return { success: true };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      domain: cookieDomain,
      path: '/',
    };

    res.cookie(ACCESS_COOKIE, accessToken, {
      ...cookieOptions,
      maxAge: this.parseDurationToMs(
        this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
        15 * 60 * 1000,
      ),
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...cookieOptions,
      maxAge: this.parseDurationToMs(
        this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
        7 * 24 * 60 * 60 * 1000,
      ),
    });
  }

  private clearAuthCookies(res: Response): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;

    res.clearCookie(ACCESS_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      domain: cookieDomain,
      path: '/',
    });
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      domain: cookieDomain,
      path: '/',
    });
  }

  private parseDurationToMs(duration: string, fallbackMs: number): number {
    const match = duration.match(/^(\d+)([smhd])$/i);
    if (!match) {
      return fallbackMs;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const unitMultiplier: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * unitMultiplier[unit];
  }
}
