import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { isAdminEmail } from './admin.utils.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: { email?: string } }>();
    const email = request.user?.email;

    if (!email || !isAdminEmail(email, this.configService.get<string>('ADMIN_EMAIL'))) {
      throw new ForbiddenException('Admin access is required.');
    }

    return true;
  }
}
