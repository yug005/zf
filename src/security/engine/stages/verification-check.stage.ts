import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * VERIFICATION_CHECK — Stage 2
 * Re-verifies that the target still has valid ownership/verification
 * before proceeding with any active probing.
 *
 * Standard scans: require at least OWNERSHIP_CONFIRMED
 * Advanced scans: require DNS_VERIFIED or HTTP_VERIFIED
 */
@Injectable()
export class VerificationCheckStage {
  private readonly logger = new Logger(VerificationCheckStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    // Admin users bypass all domain verification requirements
    if (data.isAdmin) {
      this.logger.log(`Admin bypass: skipping verification check for scan ${data.scanId}`);
      return;
    }

    const target = await this.prisma.securityTarget.findUnique({
      where: { id: data.targetId },
      select: { verificationState: true },
    });

    if (!target) {
      throw new Error(`Target ${data.targetId} not found.`);
    }

    const state = target.verificationState;

    if (data.tier === 'STANDARD') {
      if (state === 'UNVERIFIED') {
        throw new Error('Standard scan requires at least ownership confirmation.');
      }
    }

    if (data.tier === 'ADVANCED' || data.tier === 'EMULATION' || data.tier === 'CONTINUOUS_VALIDATION') {
      if (state !== 'DNS_VERIFIED' && state !== 'HTTP_VERIFIED') {
        throw new Error('Advanced, emulation, and continuous validation scans require DNS or HTTP technical verification. Current state: ' + state);
      }
    }

    this.logger.log(`Verification check passed for scan ${data.scanId} (state: ${state})`);
  }
}
