import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { JwtPayload, AuthenticatedUser } from '../interfaces/index.js';
import { isAdminEmail } from '../../../common/admin/admin.utils.js';

const REFRESH_COOKIE = 'zf_refresh_token';

function extractRefreshToken(req: Request): string | null {
  const rawCookie = req.headers.cookie;
  if (rawCookie) {
    for (const part of rawCookie.split(';')) {
      const [name, ...valueParts] = part.trim().split('=');
      if (name === REFRESH_COOKIE) {
        return decodeURIComponent(valueParts.join('='));
      }
    }
  }

  if (typeof req.body?.refreshToken === 'string') {
    return req.body.refreshToken;
  }

  return null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: Request) => extractRefreshToken(req)]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser & { refreshToken: string }> {
    const refreshToken = extractRefreshToken(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        isVerified: true,
        sessionVersion: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    const isAdmin = isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'));
    if (!user.isVerified && !isAdmin) {
      throw new UnauthorizedException('Email verification required');
    }

    if (payload.sv !== user.sessionVersion) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    return {
      id: user.id,
      email: user.email,
      isAdmin,
      sessionVersion: user.sessionVersion,
      refreshToken,
    };
  }
}
