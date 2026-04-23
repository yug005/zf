import { Controller, Post, Param, Body, Req } from '@nestjs/common';
import { VerificationService } from './verification.service.js';
import { CreateVerificationDto, CheckVerificationDto } from './dto/verification.dto.js';

@Controller('security/targets')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post(':id/verify')
  createChallenge(
    @Req() req: any,
    @Param('id') targetId: string,
    @Body() dto: CreateVerificationDto,
  ) {
    return this.verificationService.createChallenge(targetId, req.user.id, dto);
  }

  @Post(':id/verify/check')
  checkChallenge(
    @Req() req: any,
    @Param('id') targetId: string,
    @Body() dto: CheckVerificationDto,
  ) {
    return this.verificationService.checkChallenge(targetId, req.user.id, dto.verificationId);
  }
}
