import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AdminGuard } from '../../common/admin/admin.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/index.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('search')
  async searchByEmail(@Query('email') email: string) {
    return this.adminService.searchByEmail(email);
  }

  @Get('support-snapshot')
  async getSupportSnapshot(@Query('email') email: string) {
    return this.adminService.getSupportSnapshot(email);
  }

  @Post('grants')
  async createGrant(
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      email: string;
      plan: SubscriptionPlan;
      activationMode: 'override_now' | 'activate_after_current_access';
      startAt?: string;
      endAt?: string;
      enterpriseMode?: 'STANDARD' | 'PAYG';
      note?: string;
      reason?: string;
    },
  ) {
    return this.adminService.createGrant(
      { id: actor.id, email: actor.email },
      body,
    );
  }

  @Post('grants/:id/revoke')
  async revokeGrant(
    @Param('id') grantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.revokeGrant(grantId, { id: actor.id, email: actor.email }, reason);
  }

  @Get('grants')
  async listGrants(@Query('state') state?: string) {
    return this.adminService.listGrants(state);
  }

  @Get('pending-records')
  async listPendingInviteRecords() {
    return this.adminService.listPendingInviteRecords();
  }

  @Post('grants/:id/resend')
  async resendGrantEmail(@Param('id') grantId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.adminService.resendGrantEmail(grantId, { id: actor.id, email: actor.email });
  }

  @Get('payg')
  async getPaygEstimate(@Query('email') email: string) {
    return this.adminService.getPaygEstimateHistory(email);
  }

  @Get('users/overview')
  async listActiveUsersAndRecentSignups() {
    return this.adminService.listActiveUsersAndRecentSignups();
  }

  @Post('users/:id/archive')
  async softDeleteUser(
    @Param('id') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.softDeleteUser({ id: actor.id, email: actor.email }, userId, reason);
  }

  @Post('users/:id/remove-operational-data')
  async removeUserOwnedOperationalData(
    @Param('id') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.adminService.removeUserOwnedOperationalData({
      id: actor.id,
      email: actor.email,
    }, userId);
  }
}
