import { Module } from '@nestjs/common';
import { SecretCryptoService } from './secret-crypto.service.js';

@Module({
  providers: [SecretCryptoService],
  exports: [SecretCryptoService],
})
export class SecurityModule {}
