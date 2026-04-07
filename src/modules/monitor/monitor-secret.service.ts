import { Injectable, NotFoundException } from '@nestjs/common';
import { MonitorSecretKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SecretCryptoService } from '../../common/security/secret-crypto.service.js';

@Injectable()
export class MonitorSecretService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretCryptoService: SecretCryptoService,
  ) {}

  async createSecret(userId: string, name: string, value: string, kind: MonitorSecretKind) {
    const encrypted = this.secretCryptoService.encrypt(value);
    return this.prisma.monitorSecret.create({
      data: {
        userId,
        name,
        kind,
        ...encrypted,
      },
    });
  }

  async listSecrets(userId: string) {
    return this.prisma.monitorSecret.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        kind: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteSecret(userId: string, secretId: string) {
    const secret = await this.prisma.monitorSecret.findFirst({
      where: { id: secretId, userId },
      select: { id: true },
    });

    if (!secret) {
      throw new NotFoundException(`Monitor secret "${secretId}" not found.`);
    }

    await this.prisma.monitorSecret.delete({ where: { id: secretId } });
    return { success: true };
  }

  async resolveSecretValue(userId: string, secretId?: string | null): Promise<string | null> {
    if (!secretId) {
      return null;
    }

    const secret = await this.prisma.monitorSecret.findFirst({
      where: { id: secretId, userId },
    });

    if (!secret) {
      throw new NotFoundException(`Monitor secret "${secretId}" not found.`);
    }

    return this.secretCryptoService.decrypt({
      encryptedValue: secret.encryptedValue,
      iv: secret.iv,
      authTag: secret.authTag,
    });
  }
}
