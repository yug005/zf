import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ApiKeyService } from '../../api-key/api-key.service.js';

/**
 * Hybrid AuthGuard that accepts either a valid JWT Bearer token
 * or an x-api-key HTTP Header containing a cryptographic token.
 */
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'] as string;

    // Fast-path for API Keys if the header is distinctly provided
    if (apiKeyHeader) {
      const user = await this.apiKeyService.validateRawKey(apiKeyHeader);
      if (!user) {
        throw new UnauthorizedException('Invalid or revoked API Key');
      }

      // Attach user to context bypassing JWT validation
      request.user = { id: user.id, email: user.email };
      return true;
    }

    // Default back to standard Passport JWT validation
    const result = await super.canActivate(context);
    return result as boolean;
  }
}
