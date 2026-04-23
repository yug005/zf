import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateVerificationDto {
  @IsEnum(['OWNERSHIP_DECLARATION', 'DNS_TXT', 'HTTP_TOKEN'])
  method: 'OWNERSHIP_DECLARATION' | 'DNS_TXT' | 'HTTP_TOKEN';
}

export class CheckVerificationDto {
  @IsOptional()
  @IsString()
  verificationId?: string;
}
