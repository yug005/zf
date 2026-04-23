import { Controller, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { CadenceService } from './cadence.service.js';

@Controller('security/targets')
export class CadenceController {
  constructor(private readonly cadenceService: CadenceService) {}

  @Post(':id/cadence')
  setCadence(
    @Req() req: any,
    @Param('id') targetId: string,
    @Body() body: { cadence: string; tier: string },
  ) {
    return this.cadenceService.setCadence(
      targetId,
      req.user.id,
      body.cadence,
      body.tier,
      Boolean(req.user.isAdmin),
    );
  }

  @Delete(':id/cadence')
  removeCadence(@Req() req: any, @Param('id') targetId: string) {
    return this.cadenceService.removeCadence(targetId, req.user.id);
  }
}
