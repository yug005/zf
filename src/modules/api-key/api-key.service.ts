import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { PLAN_LIMITS, UNBOUNDED_USAGE_LIMIT } from '../billing/constants.js';
import { isAdminEmail } from '../../common/admin/admin.utils.js';
import crypto from 'crypto';
import { SubscriptionAccessService } from '../billing/subscription-access.service.js';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
  ) {}

  /**
   * Generates a securely random API Key and returns it (unhashed).
   * Persists only the SHA-256 hash and metadata inside the database.
   */
  async createApiKey(userId: string, dto: CreateApiKeyDto) {
    const [user, activeKeyCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, subscriptionPlan: true },
      }),
      this.prisma.apiKey.count({
        where: { userId, revokedAt: null },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'));
    const access = await this.subscriptionAccessService.syncUserStateById(userId);
    const apiKeyLimit = isAdmin
      ? UNBOUNDED_USAGE_LIMIT
      : PLAN_LIMITS[user.subscriptionPlan].maxApiKeys;

    if (activeKeyCount >= apiKeyLimit) {
      throw new BadRequestException(
        `API key limit reached for ${access.subscriptionPlan} plan (${apiKeyLimit} max). Please upgrade to create more keys.`,
      );
    }

    // Generate 32 crypto-secure bytes (64 hex characters)
    const secret = crypto.randomBytes(32).toString('hex');
    const prefix = `zf_${secret.substring(0, 6)}`;
    const fullKey = `${prefix}${secret}`;
    
    // Hash the raw string utilizing native hashing functions (fast)
    const keyHash = this.hashKey(fullKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        prefix,
        keyHash,
      },
    });

    this.logger.log(`Created new API Key ${apiKey.id} for user ${userId} (${activeKeyCount + 1}/${apiKeyLimit})`);

    // We ONLY return the raw key right here. After this, it's lost forever.
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      key: fullKey,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Fetches all API keys associated with a user, excluding the private components.
   * Only the display `prefix` is shown safely.
   */
  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Disables an API key safely by setting `revokedAt`.
   * Fast queries can now simply enforce `{ revokedAt: null }` where clauses.
   */
  async revokeApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId, revokedAt: null },
    });

    if (!key) throw new NotFoundException('Active API Key not found');

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked API key ${keyId} for user ${userId}`);
    return { success: true };
  }

  /**
   * Lookup an API key by raw incoming HTTP header string.
   * Matches via prefix index query first, then securely validates the 32 byte hash.
   */
  async validateRawKey(rawKey: string) {
    const normalizedKey = rawKey.trim();
    if (!normalizedKey) {
      return null;
    }

    if (!normalizedKey.startsWith('zf_') || normalizedKey.length < 9) {
      return this.validateLegacyKey(normalizedKey);
    }

    const prefix = normalizedKey.substring(0, 9); // "zf_" + 6 hex chars
    const candidateHashes = [
      this.hashKey(normalizedKey),
      this.hashKey(normalizedKey.substring(9)),
    ];

    // Fast indexed narrow search
    const keyRecord = await this.prisma.apiKey.findFirst({
      where: {
        prefix,
        revokedAt: null,
      },
      include: {
        user: true, // we need the associated user payload
      },
    });

    if (!keyRecord) return null;

    const storedHash = Buffer.from(keyRecord.keyHash);
    const isValid = candidateHashes.some((candidateHash) =>
      crypto.timingSafeEqual(Buffer.from(candidateHash), storedHash),
    );

    if (!isValid) return null;

    // Reject inactive users out-of-hand
    if (!keyRecord.user.isActive) return null;

    return keyRecord.user;
  }

  /**
   * Reusable secure SHA-256 function leveraging native crypto module.
   */
  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  private async validateLegacyKey(rawKey: string) {
    const candidateHash = this.hashKey(rawKey);
    const keyRecord = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: candidateHash,
        revokedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!keyRecord || !keyRecord.user.isActive) {
      return null;
    }

    return keyRecord.user;
  }
}
