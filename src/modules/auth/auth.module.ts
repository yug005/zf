import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AdminBootstrapService } from './admin-bootstrap.service.js';
import { JwtAccessStrategy, JwtRefreshStrategy } from './strategies/index.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { GithubStrategy } from './strategies/github.strategy.js';
import { JwtAccessGuard } from './guards/jwt-access.guard.js';
import { ApiKeyModule } from '../api-key/api-key.module.js';
import { BillingModule } from '../billing/billing.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.register({}), // Secrets are passed per-sign in AuthService
    ApiKeyModule,
    BillingModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminBootstrapService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    GithubStrategy,
    JwtAccessGuard,
  ],
  exports: [AuthService, JwtAccessGuard],
})
export class AuthModule {}
