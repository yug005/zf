import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { JwtPayload, AuthenticatedUser } from '../interfaces/index.js';
import { isAdminEmail } from '../../../common/admin/admin.utils.js';

const ACCESS_COOKIE = 'zf_access_token';

function extractCookieToken(req: Request): string | null {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) {
    return null;
  }

  for (const part of rawCookie.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === ACCESS_COOKIE) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => extractCookieToken(req),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
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

    return { id: user.id, email: user.email, isAdmin, sessionVersion: user.sessionVersion };
  }
}
