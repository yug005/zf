import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type EncryptedSecret = {
  encryptedValue: string;
  iv: string;
  authTag: string;
};

@Injectable()
export class SecretCryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('MONITOR_SECRET_KEY', '').trim();
    if (!secret) {
      throw new InternalServerErrorException('MONITOR_SECRET_KEY is required for encrypted monitor secrets.');
    }
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plainText: string): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedValue: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  decrypt(input: EncryptedSecret): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(input.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(input.authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(input.encryptedValue, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
