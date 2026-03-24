import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for the refresh token endpoint only.
 * Uses the 'jwt-refresh' strategy which expects the refresh token in the body.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
