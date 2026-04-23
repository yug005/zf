import { Controller, Get, Req } from '@nestjs/common';
import { EntitlementService } from './entitlement.service.js';

@Controller('security/entitlement')
export class EntitlementController {
  constructor(private readonly entitlementService: EntitlementService) {}

  @Get()
  getEntitlement(@Req() req: any) {
    return this.entitlementService.getEntitlementDetails(req.user.id, Boolean(req.user.isAdmin));
  }
}
