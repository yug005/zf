import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateChangeEventDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  monitorId?: string;

  @IsEnum(['DEPLOY', 'CONFIG', 'DNS', 'FEATURE_FLAG', 'SSL', 'SECRET', 'INFRASTRUCTURE', 'RELEASE', 'MANUAL'])
  type!: 'DEPLOY' | 'CONFIG' | 'DNS' | 'FEATURE_FLAG' | 'SSL' | 'SECRET' | 'INFRASTRUCTURE' | 'RELEASE' | 'MANUAL';

  @IsOptional()
  @IsEnum(['MANUAL', 'API', 'GITHUB', 'VERCEL', 'RAILWAY', 'SYSTEM'])
  source?: 'MANUAL' | 'API' | 'GITHUB' | 'VERCEL' | 'RAILWAY' | 'SYSTEM';

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  watchWindowMinutes?: number;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsDateString()
  happenedAt!: string;
}
