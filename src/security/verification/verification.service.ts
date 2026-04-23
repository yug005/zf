import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../common/security/ssrf-guard.js';
import type { CreateVerificationDto } from './dto/verification.dto.js';

const CHALLENGE_PREFIX = 'zf-verify-';
const CHALLENGE_EXPIRY_HOURS = 72;
const DNS_TXT_PREFIX = 'zer0friction-verify=';
const HTTP_CHALLENGE_PATH = '/.well-known/zer0friction-verify.txt';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create Verification Challenge ─────────────────────────────

  async createChallenge(targetId: string, userId: string, dto: CreateVerificationDto) {
    // Verify target exists and belongs to user
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
    });
    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    const token = `${CHALLENGE_PREFIX}${randomUUID()}`;
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000);

    let challengeValue: string | null = null;

    if (dto.method === 'DNS_TXT') {
      challengeValue = `${DNS_TXT_PREFIX}${token}`;
    } else if (dto.method === 'HTTP_TOKEN') {
      challengeValue = token;
    }

    const verification = await this.prisma.securityVerification.create({
      data: {
        targetId,
        method: dto.method,
        token,
        challengeValue,
        expiresAt,
        verifiedScope: new URL(target.baseUrl).hostname,
      },
    });

    // If ownership declaration, auto-verify
    if (dto.method === 'OWNERSHIP_DECLARATION') {
      return this.completeOwnershipDeclaration(verification.id, targetId);
    }

    return {
      ...verification,
      instructions: this.getInstructions(dto.method, target.baseUrl, token, challengeValue),
    };
  }

  // ─── Check / Verify Challenge ──────────────────────────────────

  async checkChallenge(targetId: string, userId: string, verificationId?: string) {
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
    });
    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    // Find the latest pending verification
    const verification = await this.prisma.securityVerification.findFirst({
      where: {
        targetId,
        ...(verificationId ? { id: verificationId } : {}),
        state: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('No pending verification found for this target.');
    }

    // Check expiry
    if (verification.expiresAt && verification.expiresAt < new Date()) {
      await this.prisma.securityVerification.update({
        where: { id: verification.id },
        data: { state: 'EXPIRED' },
      });
      throw new BadRequestException('Verification challenge has expired. Please create a new one.');
    }

    if (verification.method === 'DNS_TXT') {
      return this.verifyDnsChallenge(verification, target);
    }

    if (verification.method === 'HTTP_TOKEN') {
      return this.verifyHttpChallenge(verification, target);
    }

    throw new BadRequestException('Unknown verification method.');
  }

  // ─── Internal —— Ownership Declaration ─────────────────────────

  private async completeOwnershipDeclaration(verificationId: string, targetId: string) {
    const verification = await this.prisma.securityVerification.update({
      where: { id: verificationId },
      data: {
        state: 'VERIFIED',
        completedAt: new Date(),
      },
    });

    await this.prisma.securityTarget.update({
      where: { id: targetId },
      data: { verificationState: 'OWNERSHIP_CONFIRMED' },
    });

    return verification;
  }

  // ─── Internal —— DNS TXT Verification ──────────────────────────

  private async verifyDnsChallenge(
    verification: { id: string; token: string; challengeValue: string | null },
    target: { id: string; baseUrl: string },
  ) {
    const hostname = new URL(target.baseUrl).hostname;
    
    // Generate all parent domains to check. For api.staging.zer0friction.in, it will check:
    // 1. api.staging.zer0friction.in
    // 2. staging.zer0friction.in
    // 3. zer0friction.in
    const parts = hostname.split('.');
    const domainsToCheck: string[] = [];
    
    for (let i = 0; i < parts.length - 1; i++) {
        domainsToCheck.push(parts.slice(i).join('.'));
    }
    if (domainsToCheck.length === 0) domainsToCheck.push(hostname);

    const expectedValue = `${DNS_TXT_PREFIX}${verification.token}`;
    let isVerified = false;

    // Check from most specific to root domain
    for (const domain of domainsToCheck) {
      try {
        const records = await dns.promises.resolveTxt(domain);
        const flatRecords = records.map((chunks) => chunks.join(''));

        if (flatRecords.includes(expectedValue)) {
          isVerified = true;
          this.logger.log(`DNS verified for target ${target.baseUrl} using TXT on ${domain}`);
          break;
        }
      } catch (error) {
        // Domain might not have TXT records or doesn't exist, ignore and check next parent
      }
    }

    if (isVerified) {
      const updated = await this.prisma.securityVerification.update({
        where: { id: verification.id },
        data: { state: 'VERIFIED', completedAt: new Date() },
      });

      await this.prisma.securityTarget.update({
        where: { id: target.id },
        data: { verificationState: 'DNS_VERIFIED' },
      });

      return updated;
    }

    this.logger.warn(`DNS verification failed for ${hostname}. Checked chains: ${domainsToCheck.join(', ')}`);
    return {
      ...(await this.prisma.securityVerification.findUnique({ where: { id: verification.id } })),
      message: `DNS TXT record not found on any domain level (${domainsToCheck.join(' OR ')}). Please ensure it is added to your root domain and has propagated.`,
      expectedRecord: expectedValue,
      hostname,
    };
  }

  // ─── Internal —— HTTP Token Verification ───────────────────────

  private async verifyHttpChallenge(
    verification: { id: string; token: string },
    target: { id: string; baseUrl: string },
  ) {
    // SECURITY FIX: Rebuild URL strictly from protocol and host.
    // This prevents attackers from putting open-redirect paths in their baseUrl
    // (e.g. http://victim.com/redirect?url=attacker.com) to bypass validation.
    const targetUrl = new URL(target.baseUrl);
    const challengeUrl = `${targetUrl.protocol}//${targetUrl.host}${HTTP_CHALLENGE_PATH}`;

    try {
      const parsedUrl = new URL(challengeUrl);
      await assertSafeTarget(parsedUrl);

      const response = await axios.get(challengeUrl, {
        timeout: 10_000,
        maxRedirects: 3,
        validateStatus: () => true,
        responseType: 'text',
        lookup: buildSafeLookup() as never,
      });

      if (response.status === 200 && String(response.data).trim().includes(verification.token)) {
        const updated = await this.prisma.securityVerification.update({
          where: { id: verification.id },
          data: { state: 'VERIFIED', completedAt: new Date() },
        });

        await this.prisma.securityTarget.update({
          where: { id: target.id },
          data: { verificationState: 'HTTP_VERIFIED' },
        });

        return updated;
      }

      return {
        ...(await this.prisma.securityVerification.findUnique({ where: { id: verification.id } })),
        message: `Token not found at ${challengeUrl}. Please ensure the file contains: ${verification.token}`,
        challengeUrl,
      };
    } catch (error) {
      this.logger.warn(`HTTP verification failed for ${challengeUrl}: ${error}`);
      return {
        ...(await this.prisma.securityVerification.findUnique({ where: { id: verification.id } })),
        message: `Could not reach ${challengeUrl}. Please ensure the URL is accessible.`,
      };
    }
  }

  // ─── Get current verification state ────────────────────────────

  async getVerificationState(targetId: string) {
    const target = await this.prisma.securityTarget.findUnique({
      where: { id: targetId },
      select: { verificationState: true },
    });
    return target?.verificationState ?? 'UNVERIFIED';
  }

  // ─── Instructions ──────────────────────────────────────────────

  private getInstructions(
    method: string,
    baseUrl: string,
    token: string,
    challengeValue: string | null,
  ) {
    const hostname = new URL(baseUrl).hostname;

    if (method === 'DNS_TXT') {
      return {
        type: 'DNS_TXT',
        summary: `Add a TXT record to your DNS for ${hostname}`,
        record: { type: 'TXT', name: hostname, value: challengeValue },
        note: 'DNS changes may take up to 48 hours to propagate. The challenge expires in 72 hours.',
      };
    }

    if (method === 'HTTP_TOKEN') {
      return {
        type: 'HTTP_TOKEN',
        summary: `Create a file at ${baseUrl}${HTTP_CHALLENGE_PATH}`,
        fileContent: token,
        url: `${baseUrl}${HTTP_CHALLENGE_PATH}`,
        note: 'The file must return the token as plain text with HTTP status 200. The challenge expires in 72 hours.',
      };
    }

    return null;
  }
}
